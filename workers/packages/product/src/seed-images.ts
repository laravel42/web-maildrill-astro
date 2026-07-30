/**
 * Media-library image seeder — fills the allowlisted dev tenant's library
 * with real photos from Unsplash, filed by category/topic folder.
 *
 * Modes:
 *   (default)  Search Unsplash for the original 10 category queries × N
 *   --missing-topics
 *              GET /topics, skip topics already represented as folders,
 *              pull N photos each via GET /topics/:slug/photos
 *
 * Downloads the `regular` (~1080px) rendition, uploads through the same
 * path the app uses (createUploadTicket → PUT → confirmUpload), then sets
 * the asset folder. Download-tracking pings (API Terms §6) are best-effort.
 *
 * Idempotent by photo id: names are `unsplash-<photoId>.jpg`; re-runs only
 * top up what's missing. Rate-limit aware via X-Ratelimit / 403.
 *
 * Run (env from root .env):
 *   pnpm db:seed:images                              10 categories × 50
 *   pnpm db:seed:images --per-category=5             quick pass
 *   pnpm db:seed:images --missing-topics             Unsplash topics we lack
 *   pnpm db:seed:images --missing-topics --per-category=50
 *
 * Requires UNSPLASH_API_KEY plus configured media storage.
 */
import { eq } from "drizzle-orm";
import { db, tenants } from "@maildrill/database";
import { confirmUpload, createUploadTicket, listMedia, mediaConfigured, updateMedia } from "./media";

const TARGET_TENANT_NAME = "hello@laravel42.com";

/** Legacy search categories (pre-topics seeding). */
const CATEGORIES = [
  "nature",
  "business",
  "technology",
  "food",
  "travel",
  "architecture",
  "people",
  "fashion",
  "animals",
  "sports",
] as const;

/**
 * Unsplash topic slug → existing library folder. Topics that resolve to a
 * folder we already filled are treated as present (not "missing").
 */
const TOPIC_FOLDER_ALIASES: Record<string, string> = {
  "architecture-interior": "architecture",
  "fashion-beauty": "fashion",
};

const DEFAULT_PER_CATEGORY = 50;
/** Unsplash caps list/search pages at 30 results. */
const PAGE_SIZE = 30;
/** Parallel download+upload lanes; polite to both Unsplash CDN and S3. */
const CONCURRENCY = 8;

const UNSPLASH_API_BASE = "https://api.unsplash.com";

interface UnsplashPhoto {
  id: string;
  width: number;
  height: number;
  urls: { regular: string; small?: string; thumb?: string };
  links: { download_location: string };
}

interface UnsplashTopic {
  id: string;
  slug: string;
  title: string;
  total_photos: number;
}

function unsplashHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Client-ID ${apiKey}`,
    "Accept-Version": "v1",
    "User-Agent": `${process.env.UNSPLASH_APP_NAME ?? "maildrill"}/media-seeder`,
  };
}

class RateLimitExhausted extends Error {
  constructor() {
    super("Unsplash hourly rate limit exhausted");
  }
}

async function unsplashJson<T>(apiKey: string, url: URL): Promise<T> {
  const res = await fetch(url, { headers: unsplashHeaders(apiKey) });
  // Unsplash answers 403 (not 429) once the hourly Client-ID window is spent.
  if (res.status === 403) throw new RateLimitExhausted();
  if (!res.ok) throw new Error(`${url.pathname}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function searchPage(
  apiKey: string,
  query: string,
  page: number,
): Promise<UnsplashPhoto[]> {
  const url = new URL(`${UNSPLASH_API_BASE}/search/photos`);
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(PAGE_SIZE));
  url.searchParams.set("content_filter", "high");
  const body = await unsplashJson<{ results: UnsplashPhoto[] }>(apiKey, url);
  return body.results;
}

/** Paginate GET /topics until exhausted. */
async function listAllTopics(apiKey: string): Promise<UnsplashTopic[]> {
  const out: UnsplashTopic[] = [];
  for (let page = 1; page <= 10; page++) {
    const url = new URL(`${UNSPLASH_API_BASE}/topics`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", String(PAGE_SIZE));
    url.searchParams.set("order_by", "position");
    const batch = await unsplashJson<UnsplashTopic[]>(apiKey, url);
    if (batch.length === 0) break;
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}

async function topicPhotosPage(
  apiKey: string,
  slug: string,
  page: number,
): Promise<UnsplashPhoto[]> {
  const url = new URL(`${UNSPLASH_API_BASE}/topics/${encodeURIComponent(slug)}/photos`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(PAGE_SIZE));
  url.searchParams.set("order_by", "popular");
  return unsplashJson<UnsplashPhoto[]>(apiKey, url);
}

/** Folder key we store on the asset for a given Unsplash topic slug. */
function folderForTopic(slug: string): string {
  return TOPIC_FOLDER_ALIASES[slug] ?? slug;
}

/** API Terms §6 download ping — best-effort, never blocks or fails the run. */
async function trackDownload(apiKey: string, downloadLocation: string): Promise<void> {
  try {
    await fetch(downloadLocation, { headers: unsplashHeaders(apiKey) });
  } catch {
    /* tracking is a courtesy; seeding proceeds regardless */
  }
}

/** The `regular` rendition is 1080px wide; scale the reported dims to match. */
function regularDims(photo: UnsplashPhoto): { width: number; height: number } {
  const width = Math.min(1080, photo.width);
  return { width, height: Math.round((photo.height / photo.width) * width) };
}

async function seedOne(
  apiKey: string,
  tenantId: string,
  photo: UnsplashPhoto,
  folder: string,
): Promise<void> {
  const res = await fetch(photo.urls.regular);
  if (!res.ok) throw new Error(`download ${photo.id}: HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";

  const name = `unsplash-${photo.id}.jpg`;
  const ticket = await createUploadTicket(tenantId, {
    filename: name,
    contentType,
    sizeBytes: bytes.byteLength,
  });

  const put = await fetch(ticket.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: bytes,
  });
  if (!put.ok) throw new Error(`s3 put ${photo.id}: HTTP ${put.status}`);

  // Best-effort library twin: Unsplash `small` (~400px) is close enough for
  // Grid/List cover tiles without a Node rasterizer.
  let thumbStorageKey: string | null = null;
  const thumbSrc = photo.urls.small || photo.urls.thumb;
  if (thumbSrc) {
    try {
      const tRes = await fetch(thumbSrc);
      if (tRes.ok) {
        const tBytes = Buffer.from(await tRes.arrayBuffer());
        const tType = "image/jpeg";
        const tTicket = await createUploadTicket(tenantId, {
          filename: `unsplash-${photo.id}-thumb.jpg`,
          contentType: tType,
          sizeBytes: tBytes.byteLength,
        });
        const tPut = await fetch(tTicket.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": tType },
          body: tBytes,
        });
        if (tPut.ok) thumbStorageKey = tTicket.storageKey;
      }
    } catch {
      /* seed continues without a twin */
    }
  }

  const { width, height } = regularDims(photo);
  const asset = await confirmUpload(tenantId, {
    storageKey: ticket.storageKey,
    name,
    contentType,
    sizeBytes: bytes.byteLength,
    width,
    height,
    thumbStorageKey,
  });
  await updateMedia(tenantId, asset.id, { folder });
  void trackDownload(apiKey, photo.links.download_location);
}

/** Run tasks through a fixed-width lane pool, collecting thrown errors. */
async function runPool(tasks: Array<() => Promise<void>>, width: number): Promise<Error[]> {
  const errors: Error[] = [];
  let next = 0;
  const lane = async () => {
    while (next < tasks.length) {
      const task = tasks[next++]!;
      try {
        await task();
      } catch (err) {
        errors.push(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, tasks.length) }, lane));
  return errors;
}

type SeedJob = { key: string; label: string; folder: string; fetchPage: (page: number) => Promise<UnsplashPhoto[]> };

async function seedJobs(
  apiKey: string,
  tenantId: string,
  jobs: SeedJob[],
  perCategory: number,
  existingNames: Set<string>,
): Promise<{ seeded: number; skipped: number; failed: number }> {
  const claimed = new Set<string>();
  let seeded = 0;
  let skipped = 0;
  let failed = 0;

  for (const job of jobs) {
    const picked: UnsplashPhoto[] = [];
    try {
      for (let page = 1; picked.length < perCategory; page++) {
        const results = await job.fetchPage(page);
        if (results.length === 0) break;
        for (const photo of results) {
          if (picked.length >= perCategory) break;
          if (claimed.has(photo.id)) continue;
          claimed.add(photo.id);
          picked.push(photo);
        }
        if (results.length < PAGE_SIZE) break;
      }
    } catch (err) {
      if (err instanceof RateLimitExhausted) {
        console.log(
          `\nunsplash hourly rate limit hit — stopping early. ` +
            `Seeded ${seeded} so far; re-run after the window resets to top up.`,
        );
        break;
      }
      throw err;
    }

    const fresh = picked.filter((p) => !existingNames.has(`unsplash-${p.id}.jpg`));
    skipped += picked.length - fresh.length;

    const errors = await runPool(
      fresh.map((photo) => () => seedOne(apiKey, tenantId, photo, job.folder)),
      CONCURRENCY,
    );
    failed += errors.length;
    seeded += fresh.length - errors.length;
    for (const name of fresh.map((p) => `unsplash-${p.id}.jpg`)) existingNames.add(name);
    for (const e of errors.slice(0, 3)) console.log(`  ! ${job.key}: ${e.message}`);
    console.log(
      `${job.label}: +${fresh.length - errors.length} seeded` +
        (picked.length - fresh.length ? `, ${picked.length - fresh.length} already present` : "") +
        (errors.length ? `, ${errors.length} failed` : "") +
        ` → folder “${job.folder}”`,
    );
  }

  return { seeded, skipped, failed };
}

async function main(): Promise<void> {
  const apiKey = process.env.UNSPLASH_API_KEY ?? "";
  if (!apiKey) throw new Error("UNSPLASH_API_KEY is not set in .env");
  if (!mediaConfigured()) {
    throw new Error(
      "media storage is not configured (set AWS_REGION, MEDIA_S3_BUCKET, MEDIA_CDN_DOMAIN)",
    );
  }

  const missingTopics = process.argv.includes("--missing-topics");
  const perCatArg = process.argv.find((a) => a.startsWith("--per-category="));
  const perCategory = perCatArg
    ? Math.max(1, Number(perCatArg.split("=")[1]) || DEFAULT_PER_CATEGORY)
    : DEFAULT_PER_CATEGORY;

  const [target] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, TARGET_TENANT_NAME))
    .limit(1);
  if (!target) throw new Error(`target tenant "${TARGET_TENANT_NAME}" not found`);
  console.log(`target tenant: ${target.name} (${target.id})`);

  const library = await listMedia(target.id);
  const existingNames = new Set(library.map((a) => a.name));
  const folderCounts = new Map<string, number>();
  for (const a of library) {
    const f = a.folder?.trim();
    if (!f) continue;
    folderCounts.set(f, (folderCounts.get(f) ?? 0) + 1);
  }

  let jobs: SeedJob[] = [];

  if (missingTopics) {
    console.log("mode: missing Unsplash topics (GET /topics)");
    const topics = await listAllTopics(apiKey);
    console.log(`unsplash topics: ${topics.length}`);

    const missing = topics.filter((t) => {
      const folder = folderForTopic(t.slug);
      return (folderCounts.get(folder) ?? 0) < perCategory;
    });

    for (const t of topics) {
      const folder = folderForTopic(t.slug);
      const have = folderCounts.get(folder) ?? 0;
      const status = have >= perCategory ? "skip (have)" : "SEED";
      console.log(
        `  ${status.padEnd(12)} ${t.slug.padEnd(32)} → ${folder} (${have}/${perCategory})`,
      );
    }

    jobs = missing.map((t) => ({
      key: t.slug,
      label: t.title,
      folder: folderForTopic(t.slug),
      fetchPage: (page: number) => topicPhotosPage(apiKey, t.slug, page),
    }));
    console.log(`\ngoal: ${jobs.length} missing topics × ${perCategory} images`);
  } else {
    console.log(`mode: search categories`);
    console.log(`goal: ${CATEGORIES.length} categories × ${perCategory} images`);
    jobs = CATEGORIES.map((category) => ({
      key: category,
      label: category,
      folder: category,
      fetchPage: (page: number) => searchPage(apiKey, category, page),
    }));
  }

  if (jobs.length === 0) {
    console.log("\nnothing to seed — library already covers every Unsplash topic.");
    process.exit(0);
  }

  const { seeded, skipped, failed } = await seedJobs(
    apiKey,
    target.id,
    jobs,
    perCategory,
    existingNames,
  );

  console.log(
    `\ndone: ${seeded} seeded, ${skipped} already present, ${failed} failed ` +
      `(library total: ${(await listMedia(target.id)).length})`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
