/**
 * Build the IMAGE_POOL injected into the AI generation system prompt.
 *
 * Pipeline (per user prompt):
 *   1. {@link queriesFromPrompt} → 3-7 search queries.
 *   2. For each query, call `client.searchPhotos` in parallel and take the
 *      top `photosPerQuery` results.
 *   3. Flatten, dedupe by `photo.id`, keep the original query order so the
 *      "hero" query (always the first query) maps to the first pool slots.
 *   4. Return a `PoolBuildResult` carrying the items + observability metadata.
 *
 * Failure handling:
 *   - A failure in one search does NOT poison the whole pool. We use
 *     `Promise.allSettled` so the worst case is fewer items than requested.
 *   - When the pool ends up empty (config error, total upstream outage),
 *     the caller is expected to fall back to the legacy picsum rules in the
 *     system prompt — the route layer enforces that.
 *
 * Quota:
 *   - Each successful `searchPhotos` call counts as 1 against the `'ai'`
 *     daily budget. The caller charges the budget BEFORE calling this
 *     module so two concurrent requests can't both pass the same check.
 *     This module just performs the upstream calls.
 */

import {
  createUnsplashClient,
  type SearchPhotosParams,
  type UnsplashClient,
  UnsplashConfigError,
  UnsplashUpstreamError,
} from './client.js';
import type { UnsplashPhotoDTO } from './dto.js';
import {
  queriesFromPrompt as defaultQueriesFromPrompt,
  type QueriesFromPromptOptions,
  type QueriesFromPromptResult,
} from './queries-from-prompt.js';

// Pool size defaults — sized for the 95th-percentile content-rich email
// (newsletter / launch / onboarding) that needs 8–14 distinct images.
// Below 4 photos/query the round-robin substitution wraps; below 6
// queries the semantic coverage drops noticeably for prompts that span
// multiple visual themes (e.g. "header + hero + testimonials + casos
// de éxito + bot demo + footer"). 7×4 = 28 unique items leaves enough
// headroom for the substitution dedup to never reuse a photo.
const DEFAULT_PHOTOS_PER_QUERY = 4;
const DEFAULT_QUERY_COUNT = 7;

/**
 * Single entry in the pool. The shape is the contract between this module
 * and the system-prompt formatter — keep it stable.
 *
 * Fields prefixed with `data*` are persisted on the generated `Image`
 * block as the `_unsplash` metadata object so we can fire the
 * `download_location` ping when the user applies the template.
 */
export interface PoolItem {
  /** Stable Unsplash photo id. */
  id: string;
  /** URL the LLM will paste into the Image block (regular size, ~1080px wide). */
  url: string;
  /** Pre-computed accessible alt text. */
  alt: string;
  /** Photo width in pixels (for orientation hints to the LLM). */
  width: number;
  /** Photo height in pixels (for orientation hints to the LLM). */
  height: number;
  /** Dominant colour from Unsplash (used by the LLM as a paired backgroundColor). */
  color: string | null;
  /** Photographer-supplied description, when present. */
  description: string | null;
  /** Photographer name (for `_unsplash.photographerName`). */
  photographerName: string;
  /** Profile URL with UTMs. */
  photographerProfileUrl: string;
  /** Tracking URL — fired exactly once per real insertion via `/api/images/track`. */
  downloadLocation: string;
  /** Unsplash homepage URL with UTMs. */
  unsplashUrl: string;
  /** Which query produced this item (debug/observability). */
  query: string;
}

export interface PoolBuildResult {
  /** Final, deduplicated pool items. May be empty when upstream is down. */
  items: PoolItem[];
  /** Queries actually used to build the pool. */
  queries: string[];
  /** Where the queries came from. Mirrors {@link QueriesFromPromptResult.source}. */
  querySource: QueriesFromPromptResult['source'];
  /** `X-Ratelimit-Remaining` from the LAST upstream response (best-effort). */
  rateLimitRemaining: number | null;
  /** Per-query error messages (if any). Useful for `/health` and tests. */
  errors: Array<{ query: string; message: string }>;
}

export interface BuildImagePoolOptions {
  /** Number of queries to derive from the prompt. Defaults to 5. */
  queryCount?: number;
  /** Number of photos to take from each query. Defaults to 3. */
  photosPerQuery?: number;
  /** Default orientation hint forwarded to Unsplash. Optional. */
  orientation?: SearchPhotosParams['orientation'];
  /** Test seam — Unsplash client. Defaults to `createUnsplashClient()`. */
  client?: UnsplashClient;
  /** Test seam — query extractor. Defaults to the production module. */
  queriesFromPrompt?: typeof defaultQueriesFromPrompt;
  /** Forwarded to {@link queriesFromPrompt}. */
  queriesOptions?: QueriesFromPromptOptions;
  /** Optional logger for observability. Defaults to `console`. */
  logger?: { warn: (...args: unknown[]) => void };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Build a pool item from an upstream DTO. The DTO is already trimmed to the
 * fields we care about by the client layer; this is a pure projection.
 */
function toPoolItem(photo: UnsplashPhotoDTO, query: string): PoolItem {
  return {
    id: photo.id,
    // `urls.regular` is ~1080px wide and includes `auto=format&q=80`, which
    // is the right default for an email body. The LLM may also choose
    // `urls.full` for full-bleed hero backgrounds — see the system prompt
    // rules. We keep one canonical URL on the pool item; if a future need
    // for `full` arises we can add it without breaking the contract.
    url: photo.urls.regular,
    alt: photo.alt,
    width: photo.width,
    height: photo.height,
    color: photo.color,
    description: photo.description,
    photographerName: photo.user.name,
    photographerProfileUrl: photo.user.profileUrl,
    downloadLocation: photo.links.downloadLocation,
    unsplashUrl: photo.unsplashUrl,
    query,
  };
}

export async function buildImagePool(
  userPrompt: string,
  options: BuildImagePoolOptions = {}
): Promise<PoolBuildResult> {
  const queryCount = clamp(options.queryCount ?? DEFAULT_QUERY_COUNT, 1, 10);
  const photosPerQuery = clamp(options.photosPerQuery ?? DEFAULT_PHOTOS_PER_QUERY, 1, 10);
  const logger = options.logger ?? console;

  const queriesResult = await (options.queriesFromPrompt ?? defaultQueriesFromPrompt)(userPrompt, {
    count: queryCount,
    ...options.queriesOptions,
  });

  // No queries → no pool. Caller falls back to picsum rules.
  if (queriesResult.queries.length === 0) {
    return {
      items: [],
      queries: [],
      querySource: queriesResult.source,
      rateLimitRemaining: null,
      errors: [],
    };
  }

  let client: UnsplashClient;
  try {
    client = options.client ?? createUnsplashClient();
  } catch (error) {
    if (error instanceof UnsplashConfigError) {
      // Upstream client could not be built (no API key) — return empty pool.
      return {
        items: [],
        queries: queriesResult.queries,
        querySource: queriesResult.source,
        rateLimitRemaining: null,
        errors: [{ query: '*', message: 'unsplash_not_configured' }],
      };
    }
    throw error;
  }

  // Fan out — one searchPhotos per query, in parallel.
  const settled = await Promise.allSettled(
    queriesResult.queries.map((query) =>
      client.searchPhotos({
        query,
        perPage: photosPerQuery,
        orientation: options.orientation,
      })
    )
  );

  const errors: PoolBuildResult['errors'] = [];
  const seen = new Set<string>();
  const items: PoolItem[] = [];
  let rateLimitRemaining: number | null = null;

  settled.forEach((outcome, index) => {
    const query = queriesResult.queries[index];
    if (outcome.status === 'rejected') {
      const reason = outcome.reason;
      const message =
        reason instanceof UnsplashUpstreamError
          ? `${reason.status} ${reason.message}`
          : reason instanceof Error
            ? reason.message
            : 'unknown error';
      logger.warn('[buildImagePool] search failed', { query, message });
      errors.push({ query, message });
      return;
    }

    const response = outcome.value;
    if (response.rateLimitRemaining !== null) {
      rateLimitRemaining = response.rateLimitRemaining;
    }
    for (const photo of response.results.slice(0, photosPerQuery)) {
      if (seen.has(photo.id)) continue;
      seen.add(photo.id);
      items.push(toPoolItem(photo, query));
    }
  });

  return {
    items,
    queries: queriesResult.queries,
    querySource: queriesResult.source,
    rateLimitRemaining,
    errors,
  };
}

/**
 * Render the pool into a compact, deterministic block that can be inlined
 * in the system prompt. Each pool entry is keyed by a short token
 * (`@unsplash:N`) that the LLM uses as the URL value in `Image` blocks
 * and `Container` background images. The backend expands the token into
 * the real URL + `_unsplash` metadata server-side (see
 * `routes/expand-image-tokens.ts`).
 *
 * Why tokens instead of full URLs:
 *   Unsplash CDN URLs are ~150–200 chars (long `ixid` query strings).
 *   Asking the LLM to transcribe them caused frequent JSON corruption —
 *   missing closing braces on the `_unsplash` sub-object, dropped
 *   characters mid-URL — and the corrupted lines had to be dropped.
 *   Survival bias meant only the short picsum URLs reached the client.
 *   Tokens are ~12 chars, fit on a single line and cannot be corrupted.
 *
 * Sample output:
 *
 *   IMAGE_POOL — use the SHORT TOKEN as the URL value. The backend will
 *   expand it to the real Unsplash URL and inject `_unsplash` metadata.
 *
 *   [@unsplash:0] streetwear flatlay — 1080×720
 *   [@unsplash:1] urban fashion model — 1080×720
 *   [@unsplash:2] sneaker store interior — 1080×720
 */
export function formatPoolForPrompt(pool: PoolItem[]): string {
  if (pool.length === 0) return '';

  const lines: string[] = [];
  lines.push(
    'IMAGE_POOL — use the SHORT TOKEN @unsplash:N as the URL value. The backend expands it to the real Unsplash URL and injects `_unsplash` metadata server-side. Do NOT paste the long Unsplash URL directly — use the token only.'
  );
  lines.push('');
  pool.forEach((item, idx) => {
    lines.push(
      `[@unsplash:${idx}] ${item.query} — ${item.width}×${item.height}` + (item.color ? ` — color ${item.color}` : '')
    );
  });
  return lines.join('\n');
}
