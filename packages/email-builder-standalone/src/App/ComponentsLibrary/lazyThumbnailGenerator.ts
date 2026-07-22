/**
 * lazyThumbnailGenerator — generates and persists preview thumbnails
 * for local Components Library items that don't have one yet.
 *
 *   - Runs only in `componentsStorage='local'` mode, and only one pass
 *     at a time (`running` guard).
 *   - Processes Sections, Layouts and Templates (Primitives render
 *     inline, so they never need a static capture).
 *   - Two phases: first it collects every item missing a thumbnail and
 *     marks them all pending (their cards render a skeleton); then it
 *     captures them ONE BY ONE, yielding to the browser before each
 *     heavy capture so skeletons paint and input stays responsive, and
 *     clearing each card's pending flag the instant its image is stored
 *     (incremental — cards fill in as they finish, not all at the end).
 *   - Honours `pauseThumbnailGeneration` / `resumeThumbnailGeneration`
 *     (polled every 500 ms) so heavy interaction can suspend capture.
 */

import type { TReaderDocument } from '@eb/email-builder';

import { bumpComponentsLibraryRefresh, getComponentsStorageMode } from '../../documents/editor/EditorContext';

import { hasLocalThumbnail, setLocalThumbnail } from './localLibraryStore';
import { buildSubtreeHtml } from './thumbnail/buildThumbnailHtml';
import { captureSubtreeThumbnail } from './thumbnail/captureThumbnail';
import { clearThumbnailsPending, markThumbnailDone, markThumbnailsPending } from './thumbnailStatus';

const CAPTURE_TIMEOUT_MS = 6000;

let running = false;
let paused = false;

export function pauseThumbnailGeneration(): void {
  paused = true;
}

export function resumeThumbnailGeneration(): void {
  paused = false;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Yield a frame back to the browser so it can paint pending skeletons and
 * process input before the next (main-thread-blocking) html-to-image
 * capture. Prefer requestAnimationFrame — it guarantees a paint — and fall
 * back to a macrotask where rAF isn't available.
 */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

type StoredItem = { id: string; blocks?: Array<{ id: string; block: unknown }> };

function readArray(key: string): StoredItem[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as StoredItem[]) : [];
  } catch {
    return [];
  }
}

type CaptureJob = {
  id: string;
  anchor: string;
  docMap: Record<string, unknown>;
  variant: 'subtree' | 'template';
};

export async function generateMissingThumbnails(): Promise<void> {
  if (running || getComponentsStorageMode() !== 'local') return;
  running = true;
  let generated = 0;

  try {
    const targets = [
      { storageKey: 'eb:lib:sections', variant: 'subtree' as const, isTemplate: false },
      { storageKey: 'eb:lib:layouts', variant: 'subtree' as const, isTemplate: false },
      { storageKey: 'eb:lib:templates', variant: 'template' as const, isTemplate: true },
    ];

    // Phase 1 — collect every item still missing a thumbnail and mark them
    // all pending up-front, so their cards immediately render a skeleton.
    const jobs: CaptureJob[] = [];
    for (const { storageKey, variant, isTemplate } of targets) {
      for (const item of readArray(storageKey)) {
        if (hasLocalThumbnail(item.id) || !item.blocks?.length) continue;
        const docMap: Record<string, unknown> = {};
        for (const entry of item.blocks) docMap[entry.id] = entry.block;
        jobs.push({ id: item.id, anchor: isTemplate ? 'root' : item.blocks[0].id, docMap, variant });
      }
    }
    if (jobs.length === 0) return;
    markThumbnailsPending(jobs.map((job) => job.id));

    // Phase 2 — capture one at a time. Yield before each capture so the
    // skeletons paint, then clear that card's pending flag the moment its
    // image is stored (or the capture fails) so it swaps in incrementally.
    for (const job of jobs) {
      while (paused) await delay(500);
      await yieldToBrowser();

      try {
        const html = buildSubtreeHtml(job.docMap as TReaderDocument, job.anchor);
        const blob = await captureSubtreeThumbnail(html, {
          timeoutMs: CAPTURE_TIMEOUT_MS,
          variant: job.variant,
        });
        if (blob) {
          const dataUrl = await blobToDataUrl(blob);
          setLocalThumbnail(job.id, dataUrl);
          generated++;
        }
      } catch {
        // Best-effort — skip failed captures, keep going.
      } finally {
        // Clears the skeleton: the card re-reads getLocalThumbnail and shows
        // the image if stored, or the "No preview" placeholder if it failed.
        markThumbnailDone(job.id);
      }
    }
  } finally {
    running = false;
    clearThumbnailsPending();
    if (generated > 0) bumpComponentsLibraryRefresh();
  }
}
