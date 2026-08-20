/**
 * Server-side expansion of `@unsplash:N` tokens into real URLs +
 * `_unsplash` metadata, with a picsum-fallback rewriter for safety.
 *
 * Flow:
 *   1. The system prompt presents the IMAGE_POOL with short tokens
 *      `@unsplash:0`, `@unsplash:1`, ... instead of the full URLs.
 *   2. The LLM emits Image / Container blocks using those tokens as URLs.
 *   3. This module walks each parsed `{id, block}` payload before it
 *      reaches the client, expanding tokens into real Unsplash URLs and
 *      injecting `_unsplash` metadata for Image blocks.
 *   4. As a safety net, any remaining `picsum.photos` URL is also rewritten
 *      to a pool URL (round-robin) — the LLM occasionally falls back to
 *      picsum when prior context biased it that way, this guarantees the
 *      pool is honoured regardless of model compliance.
 *
 * Why tokens instead of full URLs in the prompt:
 *   - Unsplash CDN URLs are ~150–200 chars (long `ixid` query strings).
 *     The LLM was occasionally dropping characters mid-URL or mis-balancing
 *     closing braces on the surrounding `_unsplash` object, producing
 *     malformed JSON that we had to drop. Survival bias meant only the
 *     short picsum URLs reached the client.
 *   - With tokens (~12 chars), the LLM has nothing long to transcribe and
 *     full pool data lives only on the server, where it can't be corrupted.
 */

import type { PoolItem } from '../unsplash/build-image-pool.js';

export interface ExpandState {
  /**
   * Pool item ids already consumed by this request. The semantic
   * matcher prefers unused items, falling back to a least-recently-used
   * round-robin only when every item has been used at least once.
   */
  usedIds: Set<string>;
}

export interface ExpandResult {
  /** True when at least one URL was substituted. */
  changed: boolean;
  /** Per-substitution log entry. */
  changes: Array<{
    kind: 'token_expanded' | 'picsum_rewritten';
    field: 'image_url' | 'background_image';
    blockType: string;
    from: string;
    to: string;
  }>;
}

const TOKEN_RE = /^@unsplash:(\d+)$/;
const PICSUM_HOST = 'picsum.photos';
const PICSUM_SEED_RE = /picsum\.photos\/seed\/([^/?#]+)/;
const PLACEHOLD_HOST = 'placehold.co';

function isToken(value: unknown): value is string {
  return typeof value === 'string' && TOKEN_RE.test(value.trim());
}

function tokenIndex(value: string): number | null {
  const match = value.trim().match(TOKEN_RE);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function isPicsumUrl(value: unknown): value is string {
  return typeof value === 'string' && value.includes(PICSUM_HOST);
}

function isPlaceholdUrl(value: unknown): value is string {
  return typeof value === 'string' && value.includes(PLACEHOLD_HOST);
}

/**
 * Extract the semantic seed from a picsum URL — the slug between `/seed/`
 * and the next path separator.
 *
 *   `picsum.photos/seed/bot-config/320/180` → `'bot-config'`
 *
 * Returns `null` for picsum URLs without a seed (e.g. `picsum.photos/200/200`)
 * or non-picsum URLs.
 */
function extractPicsumSeed(url: string): string | null {
  const match = url.match(PICSUM_SEED_RE);
  return match ? match[1] : null;
}

/**
 * Tokenise a slug or query phrase into a normalised set of lowercase
 * words. Splits on hyphens, underscores, slashes, and whitespace; drops
 * tokens shorter than 3 characters because they rarely carry semantic
 * weight (`bg`, `c1`, `q2`, …).
 *
 *   `bot-config`            → Set { 'bot', 'config' }
 *   `whatsapp bot interface`→ Set { 'whatsapp', 'bot', 'interface' }
 */
function tokenise(input: string): Set<string> {
  const out = new Set<string>();
  for (const tok of input.toLowerCase().split(/[-_/\s]+/)) {
    const trimmed = tok.trim();
    if (trimmed.length >= 3) out.add(trimmed);
  }
  return out;
}

/**
 * Lightweight overlap score: how many seed tokens appear in the pool
 * item's query, normalised by the smaller of the two sets so a perfect
 * match scores 1 regardless of phrase length. Returns 0 when either set
 * is empty.
 */
function scoreSeedAgainstQuery(seedTokens: Set<string>, queryTokens: Set<string>): number {
  if (seedTokens.size === 0 || queryTokens.size === 0) return 0;
  let overlap = 0;
  for (const t of seedTokens) if (queryTokens.has(t)) overlap += 1;
  return overlap / Math.min(seedTokens.size, queryTokens.size);
}

/**
 * Pick the pool item that best matches the picsum seed (or the picked
 * URL when no seed is present), preferring items not yet consumed in
 * this request. Falls back to the highest-scoring item overall when the
 * pool is exhausted, and to the first pool entry when no item has any
 * token overlap with the seed (so the substitution always succeeds).
 *
 * Mutates `state.usedIds` to record the chosen item.
 */
function bestPoolMatch(pool: PoolItem[], seed: string | null, state: ExpandState): PoolItem | null {
  if (pool.length === 0) return null;
  const seedTokens = seed ? tokenise(seed) : new Set<string>();

  const scoreItem = (item: PoolItem): number =>
    scoreSeedAgainstQuery(seedTokens, tokenise(item.query));

  // First pass — prefer unused items with the highest semantic score.
  let best: { item: PoolItem; score: number } | null = null;
  for (const item of pool) {
    if (state.usedIds.has(item.id)) continue;
    const score = scoreItem(item);
    if (best === null || score > best.score) {
      best = { item, score };
    }
  }

  // Pool exhausted — every item has been used. Reuse the best overall
  // match rather than picking the first unused-by-pure-luck item.
  if (best === null) {
    for (const item of pool) {
      const score = scoreItem(item);
      if (best === null || score > best.score) {
        best = { item, score };
      }
    }
  }

  if (best) state.usedIds.add(best.item.id);
  return best?.item ?? null;
}

function poolItemAt(pool: PoolItem[], idx: number): PoolItem | null {
  if (pool.length === 0) return null;
  // Tokens that point past the pool wrap around so the document still gets
  // a valid URL even when the LLM picked a higher index than we resolved.
  return pool[idx % pool.length];
}

/**
 * Best-effort raw-URL extractor for `style.backgroundImage`. Accepts:
 *   - `https://...` (EmailBuilder's plain URL form)
 *   - `url(https://...)` / `url("...")` / `url('...')` (CSS form)
 * Returns the inner URL or `null` when the value isn't extractable.
 */
function extractBackgroundUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('url(')) {
    const m = trimmed.match(/^url\(\s*['"]?([^'")]+)['"]?\s*\)$/);
    return m ? m[1] : null;
  }
  if (trimmed.startsWith('http') || trimmed.startsWith('@unsplash:')) return trimmed;
  return null;
}

function buildUnsplashMeta(item: PoolItem) {
  return {
    photoId: item.id,
    photographerName: item.photographerName,
    photographerProfileUrl: item.photographerProfileUrl,
    unsplashUrl: item.unsplashUrl,
    downloadLocation: item.downloadLocation,
  };
}

/**
 * Walk a parsed `{id, block}` payload and expand tokens / rewrite picsum
 * URLs in place (mutating the object). Returns a summary the caller can
 * surface as a `warning` event for visibility.
 */
export function expandImageTokens(
  parsed: Record<string, unknown>,
  pool: PoolItem[],
  state: ExpandState,
): ExpandResult {
  const result: ExpandResult = { changed: false, changes: [] };

  const block = parsed.block;
  if (block === null || typeof block !== 'object') return result;
  const blockObj = block as Record<string, unknown>;
  const blockType = typeof blockObj.type === 'string' ? blockObj.type : '';
  const dataObj = (blockObj.data ?? {}) as Record<string, unknown>;

  // -------------------------------------------------------------------------
  // Image blocks: rewrite props.url, set props._unsplash from pool entry
  // -------------------------------------------------------------------------
  if (blockType === 'Image') {
    const props = (dataObj.props ?? {}) as Record<string, unknown>;
    const url = props.url;
    let item: PoolItem | null = null;
    let kind: 'token_expanded' | 'picsum_rewritten' | null = null;
    let fromUrl: string | null = null;

    if (isToken(url)) {
      const idx = tokenIndex(url);
      if (idx !== null) {
        item = poolItemAt(pool, idx);
        if (item) {
          kind = 'token_expanded';
          fromUrl = url;
          // Token-driven picks still consume the slot so the substitution
          // pass below doesn't pick the same item again later.
          state.usedIds.add(item.id);
        }
      }
    } else if ((isPicsumUrl(url) || isPlaceholdUrl(url)) && pool.length > 0) {
      const seed = typeof url === 'string' ? extractPicsumSeed(url) : null;
      item = bestPoolMatch(pool, seed, state);
      if (item) {
        kind = 'picsum_rewritten';
        fromUrl = url as string;
      }
    }

    if (item && kind && fromUrl !== null) {
      props.url = item.url;
      // Preserve a non-empty caller alt; otherwise use the pool entry's.
      if (typeof props.alt !== 'string' || props.alt.trim().length === 0) {
        props.alt = item.alt;
      }
      // Always overwrite `_unsplash` so it matches the new URL.
      props._unsplash = buildUnsplashMeta(item);
      dataObj.props = props;
      blockObj.data = dataObj;
      parsed.block = blockObj;
      result.changed = true;
      result.changes.push({ kind, field: 'image_url', blockType, from: fromUrl, to: item.url });
    }
  }

  // -------------------------------------------------------------------------
  // Container / Layout / Columns: rewrite style.backgroundImage tokens / picsum
  // -------------------------------------------------------------------------
  if (
    blockType === 'Container' ||
    blockType === 'EmailLayout' ||
    blockType === 'ColumnsContainer'
  ) {
    const style = (dataObj.style ?? {}) as Record<string, unknown>;
    const bgRaw = style.backgroundImage;
    const bgUrl = extractBackgroundUrl(bgRaw);
    if (bgUrl !== null) {
      let item: PoolItem | null = null;
      let kind: 'token_expanded' | 'picsum_rewritten' | null = null;
      if (isToken(bgUrl)) {
        const idx = tokenIndex(bgUrl);
        if (idx !== null) {
          item = poolItemAt(pool, idx);
          if (item) {
            kind = 'token_expanded';
            state.usedIds.add(item.id);
          }
        }
      } else if ((isPicsumUrl(bgUrl) || isPlaceholdUrl(bgUrl)) && pool.length > 0) {
        const seed = extractPicsumSeed(bgUrl);
        item = bestPoolMatch(pool, seed, state);
        if (item) kind = 'picsum_rewritten';
      }
      if (item && kind) {
        // Preserve `url(...)` wrapping if it was used.
        const wasUrlWrapped = typeof bgRaw === 'string' && bgRaw.trim().startsWith('url(');
        style.backgroundImage = wasUrlWrapped ? `url(${item.url})` : item.url;
        dataObj.style = style;
        blockObj.data = dataObj;
        parsed.block = blockObj;
        result.changed = true;
        result.changes.push({
          kind,
          field: 'background_image',
          blockType,
          from: bgUrl,
          to: item.url,
        });
      }
    }
  }

  return result;
}
