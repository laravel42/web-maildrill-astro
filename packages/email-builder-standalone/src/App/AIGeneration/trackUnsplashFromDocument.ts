/**
 * Walks an AI-generated `TEditorConfiguration`, finds every Image block
 * carrying `_unsplash` metadata, deduplicates by `downloadLocation`, and
 * fires the API Terms §6 download-tracking ping for each unique URL.
 *
 * This is invoked from `AIGenerationDialog.handleApply` so we only count a
 * "use" against the photographer's analytics when the user actually
 * commits the generated template — not while previewing or discarding.
 *
 * Failure handling:
 *   - The underlying `trackUnsplashDownload` is fire-and-forget and
 *     swallows network errors. This wrapper additionally swallows any
 *     traversal error so a malformed block can never break Apply.
 *   - When `_unsplash` is missing on a block (e.g. the LLM dropped it for
 *     a picsum fallback, or the user is refining an old template), the
 *     block is silently skipped.
 */

import { resolveBackendUrl, trackUnsplashDownload } from '../../components/UnsplashImagePicker/unsplash-api';
import type { TEditorConfiguration } from '../../documents/editor/core';

interface UnsplashMetadataLike {
  downloadLocation?: unknown;
}

interface ImageLikeBlock {
  type?: unknown;
  data?: { props?: { _unsplash?: UnsplashMetadataLike | null } | null } | null;
}

/**
 * Returns the deduplicated list of `downloadLocation` URLs found on Image
 * blocks in the document. Exported separately so tests can assert on the
 * collection without observing fetch side effects.
 */
export function collectUnsplashDownloadLocations(document: TEditorConfiguration | null | undefined): string[] {
  if (!document || typeof document !== 'object') return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const block of Object.values(document) as ImageLikeBlock[]) {
    if (!block || typeof block !== 'object') continue;
    if (block.type !== 'Image') continue;
    const metadata = block.data?.props?._unsplash;
    if (!metadata || typeof metadata !== 'object') continue;
    const location = (metadata as UnsplashMetadataLike).downloadLocation;
    if (typeof location !== 'string') continue;
    if (!location.startsWith('https://api.unsplash.com/')) continue;
    if (seen.has(location)) continue;
    seen.add(location);
    result.push(location);
  }

  return result;
}

export interface TrackUnsplashOptions {
  /** Backend base URL override. Defaults to {@link resolveBackendUrl}. */
  backendUrl?: string;
  /**
   * Test seam — defaults to the production tracker. Tests assert on the
   * call list without mocking `fetch` directly.
   */
  trackOne?: (backendUrl: string, downloadLocation: string) => void;
}

/**
 * Fire-and-forget tracker. Walks the document, dedupes, and pings the
 * backend once per unique `downloadLocation`. Returns the list of URLs
 * that were sent so callers can log or surface a count if useful — the
 * pings themselves do not return a value.
 */
export function trackUnsplashFromDocument(
  document: TEditorConfiguration | null | undefined,
  options: TrackUnsplashOptions = {}
): string[] {
  let locations: string[];
  try {
    locations = collectUnsplashDownloadLocations(document);
  } catch {
    // Defensive — a malformed block must never break Apply.
    return [];
  }

  if (locations.length === 0) return [];

  const backendUrl = options.backendUrl ?? resolveBackendUrl();
  const track = options.trackOne ?? trackUnsplashDownload;

  for (const location of locations) {
    try {
      track(backendUrl, location);
    } catch {
      // `trackUnsplashDownload` already swallows fetch errors; this guard
      // covers a misbehaving custom test seam.
    }
  }

  return locations;
}
