/**
 * thumbnailStatus — lightweight pub/sub for per-item thumbnail generation
 * state in local mode.
 *
 * The lazy generator marks every item that still needs a preview as
 * "pending" up-front, then clears them one-by-one as each capture
 * finishes. A LibraryCard subscribes via `useThumbnailStatusVersion()` so
 * it can render a Skeleton while its preview is queued/generating and swap
 * to the real image the moment it's ready — all without a full listing
 * refetch (which the monotonic `componentsLibraryRefreshNonce` would
 * trigger for the whole grid on every single capture).
 */

import { useSyncExternalStore } from 'react';

const pending = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version += 1;
  for (const listener of listeners) listener();
}

export function subscribeThumbnailStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getThumbnailStatusVersion(): number {
  return version;
}

/** Mark a batch of ids as awaiting generation (cards show a skeleton). */
export function markThumbnailsPending(ids: Iterable<string>): void {
  let changed = false;
  for (const id of ids) {
    if (!pending.has(id)) {
      pending.add(id);
      changed = true;
    }
  }
  if (changed) emit();
}

/** Clear a single id once its capture finished (or failed) — card refreshes. */
export function markThumbnailDone(id: string): void {
  if (pending.delete(id)) emit();
}

/** Safety net: drop all pending flags (e.g. when a generation run ends). */
export function clearThumbnailsPending(): void {
  if (pending.size > 0) {
    pending.clear();
    emit();
  }
}

export function isThumbnailPending(id: string): boolean {
  return pending.has(id);
}

/**
 * React hook — re-renders the caller whenever any thumbnail's pending
 * state changes. The returned version is incidental; call it for the
 * subscription side effect (the card then re-reads `getLocalThumbnail`
 * and `isThumbnailPending`).
 */
export function useThumbnailStatusVersion(): number {
  return useSyncExternalStore(
    subscribeThumbnailStatus,
    getThumbnailStatusVersion,
    getThumbnailStatusVersion,
  );
}
