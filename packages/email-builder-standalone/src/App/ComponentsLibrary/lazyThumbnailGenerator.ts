/**
 * lazyThumbnailGenerator — generates and persists preview thumbnails
 * for local Components Library items that don't have one yet.
 *
 * Reconstructed faithfully from the published `email-builder-online`
 * dist (`lazyThumbnailGenerator-*.js`):
 *   - Runs only in `componentsStorage='local'` mode, and only one pass
 *     at a time (`running` guard).
 *   - Processes Sections, Layouts and Templates (Primitives render
 *     inline, so they never need a static capture).
 *   - For each item missing a thumbnail, it rebuilds the reader doc
 *     map, anchors at `'root'` for templates or `blocks[0].id` for
 *     subtrees, renders via `buildSubtreeHtml`, captures with a 6 s
 *     timeout, stores the data URL, and throttles 200 ms between items.
 *   - Honours `pauseThumbnailGeneration` / `resumeThumbnailGeneration`
 *     (polled every 500 ms) so heavy interaction can suspend capture.
 *   - Refreshes the drawer once at the end if anything was generated.
 */

import type { TReaderDocument } from '@eb/email-builder';

import { bumpComponentsLibraryRefresh, getComponentsStorageMode } from '../../documents/editor/EditorContext';

import { hasLocalThumbnail, setLocalThumbnail } from './localLibraryStore';
import { buildSubtreeHtml } from './thumbnail/buildThumbnailHtml';
import { captureSubtreeThumbnail } from './thumbnail/captureThumbnail';

const THROTTLE_MS = 200;
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

export async function generateMissingThumbnails(): Promise<void> {
  if (running || getComponentsStorageMode() !== 'local') return;
  running = true;
  let generated = 0;

  try {
    const targets = [
      { storageKey: 'eb:lib:sections', isTemplate: false },
      { storageKey: 'eb:lib:layouts', isTemplate: false },
      { storageKey: 'eb:lib:templates', isTemplate: true },
    ];

    for (const { storageKey, isTemplate } of targets) {
      const items = readArray(storageKey);
      for (const item of items) {
        if (hasLocalThumbnail(item.id) || !item.blocks?.length) continue;

        // Suspend while paused (e.g. during heavy interaction).
        while (paused) await delay(500);

        try {
          const docMap: Record<string, unknown> = {};
          for (const entry of item.blocks) docMap[entry.id] = entry.block;
          const anchor = isTemplate ? 'root' : item.blocks[0].id;
          const html = buildSubtreeHtml(docMap as TReaderDocument, anchor);
          const blob = await captureSubtreeThumbnail(html, { timeoutMs: CAPTURE_TIMEOUT_MS });
          if (blob) {
            const dataUrl = await blobToDataUrl(blob);
            setLocalThumbnail(item.id, dataUrl);
            generated++;
          }
        } catch {
          // Best-effort — skip failed captures, keep going.
        }

        await delay(THROTTLE_MS);
      }
    }
  } finally {
    running = false;
    if (generated > 0) bumpComponentsLibraryRefresh();
  }
}
