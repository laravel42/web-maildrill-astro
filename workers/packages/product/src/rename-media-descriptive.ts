/**
 * Rename seeded Unsplash media assets using each photo's alt_description
 * from the Unsplash API (matched via photo id embedded in storage_key).
 *
 * Prefers cheap topic/search pages (many alts per request), then fills gaps
 * with GET /photos/:id. By default only renames assets still named
 * `unsplash-<id>.jpg` (pass --all to reconsider every Unsplash asset).
 *
 * Run (loads root .env via @maildrill/config):
 *   pnpm --dir workers exec tsx packages/product/src/rename-media-descriptive.ts
 *   pnpm --dir workers exec tsx packages/product/src/rename-media-descriptive.ts --dry-run
 *   pnpm --dir workers exec tsx packages/product/src/rename-media-descriptive.ts --all
 */
import { eq } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, mediaAssets, tenants } from '@maildrill/database';
import { listMedia, updateMedia } from './media';

const TARGET_TENANT_NAME = 'team@laravel42.com';

/** Legacy search folders (pre-topics). */
const SEARCH_CATEGORIES = [
  'nature',
  'business',
  'technology',
  'food',
  'travel',
  'architecture',
  'people',
  'fashion',
  'animals',
  'sports',
] as const;

/** Library folder → Unsplash topic slug used to bulk-fetch alt text. */
const FOLDER_TOPIC_SLUG: Record<string, string> = {
  architecture: 'architecture-interior',
  fashion: 'fashion-beauty',
};

const PAGE_SIZE = 30;
const UNSPLASH_API_BASE = 'https://api.unsplash.com';
const PHOTO_ID_RE = /unsplash-([A-Za-z0-9_-]+)\.jpe?g$/i;
const ID_NAME_RE = /^unsplash-[A-Za-z0-9_-]+\.jpe?g$/i;

interface UnsplashPhoto {
  id: string;
  alt_description: string | null;
  description: string | null;
}

function unsplashHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Client-ID ${apiKey}`,
    'Accept-Version': 'v1',
    'User-Agent': `${process.env.UNSPLASH_APP_NAME ?? 'maildrill'}/media-rename`,
  };
}

class RateLimitExhausted extends Error {
  constructor() {
    super('Unsplash hourly rate limit exhausted');
  }
}

async function unsplashJson<T>(apiKey: string, url: URL): Promise<T> {
  const res = await fetch(url, { headers: unsplashHeaders(apiKey) });
  if (res.status === 403) throw new RateLimitExhausted();
  if (!res.ok) throw new Error(`${url.pathname}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

async function searchPage(apiKey: string, query: string, page: number): Promise<UnsplashPhoto[]> {
  const url = new URL(`${UNSPLASH_API_BASE}/search/photos`);
  url.searchParams.set('query', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(PAGE_SIZE));
  url.searchParams.set('content_filter', 'high');
  const body = await unsplashJson<{ results: UnsplashPhoto[] }>(apiKey, url);
  return body.results;
}

async function topicPhotosPage(
  apiKey: string,
  slug: string,
  page: number,
): Promise<UnsplashPhoto[]> {
  const url = new URL(`${UNSPLASH_API_BASE}/topics/${encodeURIComponent(slug)}/photos`);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(PAGE_SIZE));
  url.searchParams.set('order_by', 'popular');
  return unsplashJson<UnsplashPhoto[]>(apiKey, url);
}

async function fetchPhoto(apiKey: string, id: string): Promise<UnsplashPhoto | null> {
  const res = await fetch(`${UNSPLASH_API_BASE}/photos/${id}`, {
    headers: unsplashHeaders(apiKey),
  });
  if (res.status === 403) throw new RateLimitExhausted();
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`unsplash photo ${id}: HTTP ${res.status}`);
  return (await res.json()) as UnsplashPhoto;
}

/** Match createUploadTicket / updateMedia safeName rules. */
function slugify(raw: string): string {
  const base = raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'photo';
}

function descriptiveName(photo: UnsplashPhoto, ext: string): string {
  const phrase = (photo.alt_description || photo.description || '').trim();
  const slug = phrase ? slugify(phrase) : `photo-${photo.id.slice(0, 8)}`;
  return `${slug.slice(0, 100)}.${ext}`.slice(0, 120);
}

function photoIdFromKey(storageKey: string): string | null {
  const m = storageKey.match(PHOTO_ID_RE);
  return m?.[1] ?? null;
}

function extFromName(name: string): string {
  const m = name.match(/\.([a-z0-9]+)$/i);
  return (m?.[1] ?? 'jpg').toLowerCase();
}

function topicSlugForFolder(folder: string): string {
  return FOLDER_TOPIC_SLUG[folder] ?? folder;
}

async function coverFromPages(
  label: string,
  want: Set<string>,
  fetchPage: (page: number) => Promise<UnsplashPhoto[]>,
  into: Map<string, UnsplashPhoto>,
  maxPages = 8,
): Promise<void> {
  if (want.size === 0) return;
  const start = want.size;
  for (let page = 1; want.size > 0 && page <= maxPages; page++) {
    const results = await fetchPage(page);
    if (results.length === 0) break;
    for (const photo of results) {
      if (!want.has(photo.id)) continue;
      into.set(photo.id, photo);
      want.delete(photo.id);
    }
    if (results.length < PAGE_SIZE) break;
  }
  console.log(
    `${label}: covered ${start - want.size}/${start}` +
      (want.size ? ` (${want.size} still missing)` : ''),
  );
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const all = process.argv.includes('--all');
  const apiKey = process.env.UNSPLASH_API_KEY ?? '';
  if (!apiKey) throw new Error('UNSPLASH_API_KEY is not set in .env');
  void config.media.configured;

  const [target] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, TARGET_TENANT_NAME))
    .limit(1);
  if (!target) throw new Error(`target tenant "${TARGET_TENANT_NAME}" not found`);

  const assets = await listMedia(target.id);
  const byPhotoId = new Map<
    string,
    { id: string; name: string; storageKey: string; topic: string }
  >();

  const rows = await db
    .select({
      id: mediaAssets.id,
      name: mediaAssets.name,
      storageKey: mediaAssets.storageKey,
      folder: mediaAssets.folder,
      tags: mediaAssets.tags,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.tenantId, target.id));

  for (const row of rows) {
    const photoId = photoIdFromKey(row.storageKey);
    if (!photoId) continue;
    if (!all && !ID_NAME_RE.test(row.name)) continue;
    const topic =
      (row.folder?.trim() ||
        (Array.isArray(row.tags) && typeof row.tags[0] === 'string' ? row.tags[0] : '')) ??
      '';
    byPhotoId.set(photoId, {
      id: row.id,
      name: row.name,
      storageKey: row.storageKey,
      topic,
    });
  }

  console.log(
    `tenant ${target.name}: ${assets.length} assets, ${byPhotoId.size} to rename` +
      (all ? ' (--all)' : ' (unsplash-id names only)') +
      (dryRun ? ' (dry-run)' : ''),
  );

  if (byPhotoId.size === 0) {
    console.log('nothing to rename');
    return;
  }

  const descriptions = new Map<string, UnsplashPhoto>();
  const folders = [...new Set([...byPhotoId.values()].map((a) => a.topic).filter(Boolean))];

  try {
    for (const folder of folders) {
      const needed = [...byPhotoId.entries()]
        .filter(([, a]) => a.topic === folder)
        .map(([id]) => id);
      const want = new Set(needed.filter((id) => !descriptions.has(id)));
      const slug = topicSlugForFolder(folder);
      const isLegacySearch = (SEARCH_CATEGORIES as readonly string[]).includes(folder);

      if (isLegacySearch && slug === folder) {
        await coverFromPages(
          folder,
          want,
          (page) => searchPage(apiKey, folder, page),
          descriptions,
        );
      } else {
        await coverFromPages(
          `${folder} (topic:${slug})`,
          want,
          (page) => topicPhotosPage(apiKey, slug, page),
          descriptions,
        );
      }
    }
  } catch (err) {
    if (err instanceof RateLimitExhausted) {
      console.log(
        'unsplash rate limit hit during bulk fetch — filling gaps via GET where possible',
      );
    } else {
      throw err;
    }
  }

  let fetched = 0;
  for (const photoId of byPhotoId.keys()) {
    if (descriptions.has(photoId)) continue;
    try {
      const photo = await fetchPhoto(apiKey, photoId);
      fetched += 1;
      if (photo) descriptions.set(photoId, photo);
    } catch (err) {
      if (err instanceof RateLimitExhausted) {
        console.log(
          `unsplash rate limit hit after ${fetched} photo GETs — remaining keep current names`,
        );
        break;
      }
      console.log(`  ! photo ${photoId}: ${err instanceof Error ? err.message : err}`);
    }
  }

  const claimed = new Set(
    rows.filter((r) => !byPhotoId.has(photoIdFromKey(r.storageKey) ?? '')).map((r) => r.name),
  );
  // Also reserve names of assets we're not renaming this run.
  for (const r of rows) {
    const pid = photoIdFromKey(r.storageKey);
    if (pid && byPhotoId.has(pid)) continue;
    claimed.add(r.name);
  }

  const renamePlan: Array<{ id: string; from: string; to: string }> = [];

  for (const [photoId, asset] of byPhotoId) {
    const photo = descriptions.get(photoId);
    if (!photo) continue;
    const ext = extFromName(asset.name);
    const base = descriptiveName(photo, ext).replace(new RegExp(`\\.${ext}$`), '');
    let to = `${base}.${ext}`;
    let n = 2;
    while (claimed.has(to) && to !== asset.name) {
      to = `${base}-${n}.${ext}`;
      n += 1;
    }
    if (to === asset.name) {
      claimed.add(to);
      continue;
    }
    claimed.add(to);
    renamePlan.push({ id: asset.id, from: asset.name, to });
  }

  // Last resort when API is rate-limited: folder + short id (still beats unsplash-<id>).
  for (const [photoId, asset] of byPhotoId) {
    if (descriptions.has(photoId)) continue;
    if (renamePlan.some((r) => r.id === asset.id)) continue;
    const ext = extFromName(asset.name);
    const base = slugify(`${asset.topic || 'photo'}-${photoId.slice(0, 8)}`);
    let to = `${base}.${ext}`;
    let n = 2;
    while (claimed.has(to) && to !== asset.name) {
      to = `${base}-${n}.${ext}`;
      n += 1;
    }
    if (to === asset.name) {
      claimed.add(to);
      continue;
    }
    claimed.add(to);
    renamePlan.push({ id: asset.id, from: asset.name, to });
  }

  const missingDesc = byPhotoId.size - descriptions.size;
  console.log(
    `\nrenames planned: ${renamePlan.length}` +
      (missingDesc ? ` (${missingDesc} used folder+id fallback — no Unsplash alt)` : ''),
  );
  for (const row of renamePlan.slice(0, 12)) {
    console.log(`  ${row.from}  →  ${row.to}`);
  }
  if (renamePlan.length > 12) console.log(`  … +${renamePlan.length - 12} more`);

  if (dryRun) {
    console.log('\ndry-run: no writes');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const row of renamePlan) {
    try {
      const updated = await updateMedia(target.id, row.id, { name: row.to });
      if (updated) ok += 1;
      else fail += 1;
    } catch (err) {
      fail += 1;
      console.log(`  ! ${row.from}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(
    `\ndone: ${ok} renamed, ${fail} failed, ${byPhotoId.size - renamePlan.length} unchanged`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
