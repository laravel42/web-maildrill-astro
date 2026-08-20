/**
 * Attach searchable tags to seeded Unsplash media assets.
 *
 * Sources (merged, de-duplicated):
 *   1. Meaningful tokens from the descriptive filename / Unsplash alt text
 *   2. Unsplash photo tags from search / GET /photos/:id (when API allows)
 *   3. The asset folder (topic) as a high-signal tag
 *
 * Run (root .env loaded via @maildrill/config):
 *   pnpm --dir workers exec tsx packages/product/src/tag-media-descriptive.ts
 *   pnpm --dir workers exec tsx packages/product/src/tag-media-descriptive.ts --dry-run
 *   pnpm --dir workers exec tsx packages/product/src/tag-media-descriptive.ts --offline
 *   pnpm --dir workers exec tsx packages/product/src/tag-media-descriptive.ts --regroup
 */
import { eq } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, mediaAssets, tenants } from '@maildrill/database';
import { updateMedia } from './media';
import { canonicalizeTag, groupSimilarTags, MIN_TAG_ASSETS, regroupLibraryTags } from './tag-group';

const TARGET_TENANT_NAME = 'hello@laravel42.com';
const CATEGORIES = [
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

const PAGE_SIZE = 30;
const MAX_TAGS = 6;
const UNSPLASH_API_BASE = 'https://api.unsplash.com';
const PHOTO_ID_RE = /unsplash-([A-Za-z0-9_-]+)\.jpe?g$/i;

/** Low-value filler — keep colors, subjects, places, actions. */
const STOP = new Set([
  'a',
  'an',
  'the',
  'of',
  'on',
  'in',
  'at',
  'to',
  'for',
  'and',
  'or',
  'with',
  'near',
  'beside',
  'from',
  'into',
  'onto',
  'by',
  'during',
  'daytime',
  'photo',
  'photography',
  'image',
  'picture',
  'against',
  'under',
  'over',
  'between',
  'among',
  'its',
  'their',
  'his',
  'her',
  'this',
  'that',
  'these',
  'those',
  'some',
  'several',
  'next',
  'while',
  'using',
  'holding',
  'standing',
  'sitting',
  'lying',
  'walking',
  'looking',
  'surrounded',
  'assorted',
  'various',
  'close',
  'up',
  'macro',
  'low',
  'angle',
  'view',
  'shot',
  'jpg',
  'jpeg',
  'png',
  'through',
  'open',
  'each',
  'other',
  'four',
  'five',
  'six',
  'rests',
  'performs',
  'laying',
  'viewed',
  'colored',
  'coloured',
]);

interface UnsplashTag {
  type?: string;
  title?: string;
}

interface UnsplashPhoto {
  id: string;
  alt_description: string | null;
  description: string | null;
  tags?: UnsplashTag[];
}

function unsplashHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Client-ID ${apiKey}`,
    'Accept-Version': 'v1',
    'User-Agent': `${process.env.UNSPLASH_APP_NAME ?? 'maildrill'}/media-tag`,
  };
}

class RateLimitExhausted extends Error {
  constructor() {
    super('Unsplash hourly rate limit exhausted');
  }
}

async function searchPage(apiKey: string, query: string, page: number): Promise<UnsplashPhoto[]> {
  const url = new URL(`${UNSPLASH_API_BASE}/search/photos`);
  url.searchParams.set('query', query);
  url.searchParams.set('page', String(page));
  url.searchParams.set('per_page', String(PAGE_SIZE));
  url.searchParams.set('content_filter', 'high');

  const res = await fetch(url, { headers: unsplashHeaders(apiKey) });
  if (res.status === 403) throw new RateLimitExhausted();
  if (!res.ok) throw new Error(`unsplash search ${query} p${page}: HTTP ${res.status}`);
  const body = (await res.json()) as { results: UnsplashPhoto[] };
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
  const res = await fetch(url, { headers: unsplashHeaders(apiKey) });
  if (res.status === 403) throw new RateLimitExhausted();
  if (!res.ok) throw new Error(`unsplash topic ${slug} p${page}: HTTP ${res.status}`);
  return (await res.json()) as UnsplashPhoto[];
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

function photoIdFromKey(storageKey: string): string | null {
  return storageKey.match(PHOTO_ID_RE)?.[1] ?? null;
}

function normalizeTag(raw: string): string | null {
  const t = canonicalizeTag(raw);
  if (!t) return null;
  if (STOP.has(t)) return null;
  if (/^\d+$/.test(t)) return null;
  return t;
}

/** Pull subject tokens from a descriptive slug or sentence. */
export function tagsFromText(text: string): string[] {
  const cleaned = text
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of cleaned.split(/\s+/)) {
    const tag = normalizeTag(part);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

function tagsFromUnsplash(photo: UnsplashPhoto): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of photo.tags ?? []) {
    const tag = normalizeTag(t.title ?? '');
    if (!tag || seen.has(tag)) continue;
    // Prefer search/editorial tags; skip noisy camera EXIF-ish if any
    if (t.type === 'search' || t.type === 'landing_page' || !t.type) {
      seen.add(tag);
      out.push(tag);
    }
  }
  return out;
}

/**
 * Merge sources: folder first (always kept, even if it would be DROP'd as a
 * free tag — e.g. experimental / wallpapers topics), then Unsplash, then
 * filename tokens.
 */
export function mergeTags(parts: {
  folder?: string | null;
  unsplash?: string[];
  fromName?: string[];
}): string[] {
  const folderSlug = parts.folder?.trim().toLowerCase() || null;
  // Prefer spaced form for hyphenated topic folders ("street photography").
  const folderTag = folderSlug ? folderSlug.replace(/-/g, ' ') : null;

  const rest = groupSimilarTags(
    [...(parts.unsplash ?? []), ...(parts.fromName ?? [])]
      .map((t) => normalizeTag(t))
      .filter((t): t is string => Boolean(t)),
    MAX_TAGS - (folderTag ? 1 : 0),
  ).filter((t) => t !== folderTag && t !== folderSlug);

  if (!folderTag) return rest;
  return [folderTag, ...rest].slice(0, MAX_TAGS);
}

async function regroupExisting(
  tenantId: string,
  rows: Array<{ id: string; name: string; tags: string[]; folder?: string | null }>,
  dryRun: boolean,
  protect: string[] = [],
): Promise<void> {
  const fromLists = rows.map((row) => row.tags ?? []);
  const protectSet = [
    ...protect,
    ...rows.map((r) => r.folder).filter((f): f is string => Boolean(f)),
  ];
  const {
    tags: toLists,
    freq,
    pruned,
  } = regroupLibraryTags(fromLists, MAX_TAGS, MIN_TAG_ASSETS, protectSet);

  const keep = [...freq.entries()].filter(([, n]) => n >= MIN_TAG_ASSETS);
  console.log(
    `corpus: ${freq.size} tags after alias → keep ${keep.length} (≥${MIN_TAG_ASSETS} images), prune ${pruned.length}`,
  );
  if (pruned.length) {
    console.log(`  pruned: ${pruned.slice(0, 40).join(', ')}${pruned.length > 40 ? ', …' : ''}`);
  }

  const plan = rows
    .map((row, i) => ({
      id: row.id,
      name: row.name,
      from: fromLists[i] ?? [],
      tags: toLists[i] ?? [],
    }))
    .filter((row) => JSON.stringify(row.from) !== JSON.stringify(row.tags));

  console.log(`regroup plans: ${plan.length}`);
  for (const row of plan.slice(0, 10)) {
    console.log(`  ${row.name.slice(0, 40)}`);
    console.log(`    was [${row.from.join(', ')}]`);
    console.log(`    now [${row.tags.join(', ')}]`);
  }
  if (plan.length > 10) console.log(`  … +${plan.length - 10} more`);

  if (dryRun) {
    console.log('\ndry-run: no writes');
    return;
  }

  let ok = 0;
  for (const row of plan) {
    const updated = await updateMedia(tenantId, row.id, { tags: row.tags });
    if (updated) ok += 1;
  }
  console.log(`\ndone: ${ok} regrouped`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const offline = process.argv.includes('--offline');
  const regroup = process.argv.includes('--regroup');
  const apiKey = process.env.UNSPLASH_API_KEY ?? '';
  void config.media.configured;

  if (!regroup && !offline && !apiKey) {
    throw new Error('UNSPLASH_API_KEY is not set (or pass --offline / --regroup)');
  }

  const [target] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.name, TARGET_TENANT_NAME))
    .limit(1);
  if (!target) throw new Error(`target tenant "${TARGET_TENANT_NAME}" not found`);

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

  if (regroup) {
    const protect = rows.map((r) => r.folder).filter((f): f is string => Boolean(f));
    await regroupExisting(target.id, rows, dryRun, protect);
    return;
  }

  const untaggedOnly = !process.argv.includes('--all');
  const byPhotoId = new Map<
    string,
    { id: string; name: string; folder: string | null; tags: string[] }
  >();
  for (const row of rows) {
    const photoId = photoIdFromKey(row.storageKey);
    if (!photoId) continue;
    if (untaggedOnly && (row.tags?.length ?? 0) > 0) continue;
    byPhotoId.set(photoId, {
      id: row.id,
      name: row.name,
      folder: row.folder,
      tags: row.tags ?? [],
    });
  }

  console.log(
    `tenant ${target.name}: ${byPhotoId.size} assets to tag` +
      (untaggedOnly ? ' (untagged only)' : ' (--all)') +
      (offline ? ' (offline)' : '') +
      (dryRun ? ' (dry-run)' : ''),
  );

  const photos = new Map<string, UnsplashPhoto>();

  if (!offline) {
    const folders = [
      ...new Set([...byPhotoId.values()].map((a) => a.folder).filter(Boolean)),
    ] as string[];
    for (const category of folders) {
      const needed = [...byPhotoId.entries()]
        .filter(([, a]) => (a.folder ?? '') === category)
        .map(([id]) => id);
      const want = new Set(needed.filter((id) => !photos.has(id)));
      if (want.size === 0) continue;
      const useSearch = (CATEGORIES as readonly string[]).includes(category);
      try {
        for (let page = 1; want.size > 0 && page <= 8; page++) {
          const results = useSearch
            ? await searchPage(apiKey, category, page)
            : await topicPhotosPage(apiKey, category, page);
          if (results.length === 0) break;
          for (const photo of results) {
            if (!want.has(photo.id)) continue;
            photos.set(photo.id, photo);
            want.delete(photo.id);
          }
          if (results.length < PAGE_SIZE) break;
        }
        console.log(
          `${category}: bulk covered ${needed.length - want.size}/${needed.length}` +
            (want.size ? ` (${want.size} missing)` : ''),
        );
      } catch (err) {
        if (err instanceof RateLimitExhausted) {
          console.log(
            'unsplash rate limit during bulk fetch — filling gaps via GET where possible',
          );
          break;
        }
        throw err;
      }
    }

    let fetched = 0;
    for (const photoId of byPhotoId.keys()) {
      const existing = photos.get(photoId);
      if (existing?.tags && existing.tags.length > 0) continue;
      try {
        const photo = await fetchPhoto(apiKey, photoId);
        fetched += 1;
        if (photo) photos.set(photoId, photo);
      } catch (err) {
        if (err instanceof RateLimitExhausted) {
          console.log(
            `unsplash rate limit after ${fetched} photo GETs — using filename tags for the rest`,
          );
          break;
        }
        console.log(`  ! photo ${photoId}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  const draft: Array<{ id: string; name: string; tags: string[] }> = [];
  for (const [photoId, asset] of byPhotoId) {
    const photo = photos.get(photoId);
    const tags = mergeTags({
      folder: asset.folder,
      unsplash: photo ? tagsFromUnsplash(photo) : [],
      fromName: tagsFromText(photo?.alt_description || photo?.description || asset.name),
    });
    if (tags.length === 0) continue;
    draft.push({ id: asset.id, name: asset.name, tags });
  }

  // Frequency corpus = new drafts + already-tagged library rows (stable min-3).
  const protect = rows.map((r) => r.folder).filter((f): f is string => Boolean(f));
  const corpusLists = [
    ...draft.map((row) => row.tags),
    ...rows
      .filter((r) => (r.tags?.length ?? 0) > 0 && !draft.some((d) => d.id === r.id))
      .map((r) => r.tags ?? []),
  ];
  const { tags: prunedCorpus, pruned } = regroupLibraryTags(
    corpusLists,
    MAX_TAGS,
    MIN_TAG_ASSETS,
    protect,
  );
  const plan = draft.map((row, i) => ({
    ...row,
    tags: prunedCorpus[i] ?? [],
  }));
  if (pruned.length) {
    console.log(`\npruned ${pruned.length} tags appearing on <${MIN_TAG_ASSETS} images`);
  }

  console.log(`\ntag plans: ${plan.length}`);
  for (const row of plan.slice(0, 10)) {
    console.log(`  ${row.name.slice(0, 48)}  →  [${row.tags.join(', ')}]`);
  }
  if (plan.length > 10) console.log(`  … +${plan.length - 10} more`);

  if (dryRun) {
    console.log('\ndry-run: no writes');
    return;
  }

  let ok = 0;
  let fail = 0;
  for (const row of plan) {
    try {
      const updated = await updateMedia(target.id, row.id, { tags: row.tags });
      if (updated) ok += 1;
      else fail += 1;
    } catch (err) {
      fail += 1;
      console.log(`  ! ${row.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\ndone: ${ok} tagged, ${fail} failed`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
