/**
 * Server-side enforcement that rewrites `picsum.photos` URLs to Unsplash
 * URLs from the resolved IMAGE_POOL.
 *
 * Why this exists: the LLM is told to use the IMAGE_POOL when one is
 * available, but every generation we ship still includes a couple of
 * picsum URLs. The few-shot examples and the legacy BASE_INSTRUCTIONS
 * both nudge the model toward picsum — those nudges win often enough to
 * matter. Rewriting the URLs at stream time guarantees the pool is used
 * regardless of LLM compliance, and the `_unsplash` metadata for Image
 * blocks is filled with the matching pool entry so the §6 download ping
 * fires correctly when the user applies the template.
 *
 * Scope:
 *   - `Image.data.props.url` containing `picsum.photos` → replaced with
 *     the next pool URL (round-robin) and `_unsplash` is populated.
 *   - `Container.data.style.backgroundImage` (string or `url(...)`) →
 *     replaced when it points at picsum. Backgrounds don't carry per-block
 *     `_unsplash` metadata; the frontend records credits for the URL on
 *     Apply.
 *   - Anything else is left untouched.
 *
 * `RewriteState` is a plain counter the caller threads across calls so
 * each block in the stream gets a different pool entry until the pool is
 * exhausted, then wraps.
 */

import type { PoolItem } from '../unsplash/build-image-pool.js';

export interface RewriteState {
  /** Round-robin index into the pool. Mutated in place. */
  cursor: number;
}

export interface RewriteResult {
  /** True when at least one URL was replaced. */
  rewritten: boolean;
  /** Block ids of the rewrites that happened (for logging / warnings). */
  affected: Array<{ kind: 'image_url' | 'background_image'; from: string; to: string }>;
}

const PICSUM_HOSTS = ['picsum.photos'];

function isPicsumUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  return PICSUM_HOSTS.some((host) => url.includes(host));
}

/**
 * Best-effort extractor for `style.backgroundImage` raw URLs. The CSS spec
 * allows `url("...")`, `url('...')`, `url(...)` — and EmailBuilder also
 * accepts plain `https://...` strings. We test both.
 */
function extractBackgroundUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.startsWith('url(')) {
    const match = trimmed.match(/^url\(\s*['"]?([^'")]+)['"]?\s*\)$/);
    return match ? match[1] : null;
  }
  if (trimmed.startsWith('http')) return trimmed;
  return null;
}

function nextPoolItem(pool: PoolItem[], state: RewriteState): PoolItem {
  const item = pool[state.cursor % pool.length];
  state.cursor += 1;
  return item;
}

/**
 * Walk a parsed `{id, block}` payload and replace picsum URLs in place
 * (mutating the object) with pool-sourced URLs. Returns a summary so the
 * caller can emit a `warning` event for visibility.
 */
export function rewritePicsumToPool(
  parsed: Record<string, unknown>,
  pool: PoolItem[],
  state: RewriteState,
): RewriteResult {
  const result: RewriteResult = { rewritten: false, affected: [] };
  if (pool.length === 0) return result;

  const block = parsed.block;
  if (block === null || typeof block !== 'object') return result;
  const blockObj = block as Record<string, unknown>;
  const blockType = blockObj.type;
  const dataObj = (blockObj.data ?? {}) as Record<string, unknown>;

  // -------------------------------------------------------------------------
  // Image blocks: rewrite props.url
  // -------------------------------------------------------------------------
  if (blockType === 'Image') {
    const props = (dataObj.props ?? {}) as Record<string, unknown>;
    if (isPicsumUrl(props.url)) {
      const item = nextPoolItem(pool, state);
      const fromUrl = props.url;
      props.url = item.url;
      // Preserve any caller-set alt; otherwise use the pool entry's alt.
      if (typeof props.alt !== 'string' || props.alt.trim().length === 0) {
        props.alt = item.alt;
      }
      // Always overwrite the _unsplash metadata so it matches the new URL.
      props._unsplash = {
        photoId: item.id,
        photographerName: item.photographerName,
        photographerProfileUrl: item.photographerProfileUrl,
        unsplashUrl: item.unsplashUrl,
        downloadLocation: item.downloadLocation,
      };
      dataObj.props = props;
      blockObj.data = dataObj;
      parsed.block = blockObj;
      result.rewritten = true;
      result.affected.push({ kind: 'image_url', from: String(fromUrl), to: item.url });
    }
  }

  // -------------------------------------------------------------------------
  // Container blocks: rewrite style.backgroundImage when it points to picsum
  // -------------------------------------------------------------------------
  if (
    blockType === 'Container' ||
    blockType === 'EmailLayout' ||
    blockType === 'ColumnsContainer'
  ) {
    const style = (dataObj.style ?? {}) as Record<string, unknown>;
    const bgRaw = style.backgroundImage;
    const bgUrl = extractBackgroundUrl(bgRaw);
    if (bgUrl !== null && isPicsumUrl(bgUrl)) {
      const item = nextPoolItem(pool, state);
      style.backgroundImage = item.url;
      dataObj.style = style;
      blockObj.data = dataObj;
      parsed.block = blockObj;
      result.rewritten = true;
      result.affected.push({ kind: 'background_image', from: bgUrl, to: item.url });
    }
  }

  return result;
}
