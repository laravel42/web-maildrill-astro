/**
 * Dev-only batch tool to (re)generate Template preview thumbnails.
 *
 * Seeded/imported templates can end up without a thumbnail (the seeder
 * is best-effort, and capture failures are non-fatal). This tool lists
 * every saved template, re-renders each document off-screen via the
 * same capture pipeline the save dialog uses (`buildSubtreeHtml` +
 * `captureSubtreeThumbnail`), and PUTs the resulting WebP back IN-PLACE
 * (same uuid) so existing cards / apply references keep working.
 *
 * Mirrors `devRecaptureSectionThumbnails`, but templates have no axis:
 * the file lives at `templates/{uuid}.ndjson` and the thumbnail-only
 * PUT goes to `/dev/templates/:id` (multipart `payload` + `thumbnail`).
 *
 * Trigger from the dev console (after `pnpm dev` + `pnpm dev:backend`):
 *
 *   await window.__recaptureTemplateThumbnails()                     // all
 *   await window.__recaptureTemplateThumbnails({ onlyMissing: true }) // fill gaps
 *
 * Runs sequentially (one hidden iframe at a time). Capture failures are
 * non-fatal and counted as skipped. The optional `onProgress` callback
 * fires after each template so callers (e.g. a drawer button) can show
 * live progress.
 */

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';

import { buildSubtreeHtml } from './thumbnail/buildThumbnailHtml';
import { captureSubtreeThumbnail } from './thumbnail/captureThumbnail';

type Listing = { id: string; name: string; hasThumbnail: boolean };
export type RecaptureTemplateSummary = { total: number; captured: number; skipped: number; failed: number };

export async function recaptureTemplateThumbnails(
  options: {
    onlyMissing?: boolean;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<RecaptureTemplateSummary> {
  const base = resolveBackendUrl();
  const summary: RecaptureTemplateSummary = { total: 0, captured: 0, skipped: 0, failed: 0 };

  let list: Listing[];
  try {
    const r = await fetch(`${base}/dev/templates`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    list = ((await r.json()) as { templates: Listing[] }).templates;
  } catch (err) {
    console.warn('[recaptureTemplateThumbnails] list failed:', err);
    return summary;
  }

  if (options.onlyMissing) list = list.filter((tpl) => !tpl.hasThumbnail);
  summary.total = list.length;
  console.info(`[recaptureTemplateThumbnails] processing ${list.length} templates…`);

  let done = 0;
  for (const tpl of list) {
    const url = `${base}/dev/templates/${encodeURIComponent(tpl.id)}`;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`GET HTTP ${r.status}`);
      const { name, blocks } = (await r.json()) as { name: string; blocks: Array<{ id: string; block: unknown }> };
      if (!blocks?.length) {
        summary.skipped++;
        continue;
      }

      const docMap: Record<string, unknown> = {};
      for (const e of blocks) docMap[e.id] = e.block;
      // blocks[0] is the EmailLayout root (renumbered on save); anchor
      // the capture there so the whole document renders.
      const html = buildSubtreeHtml(docMap as Parameters<typeof buildSubtreeHtml>[0], blocks[0].id);
      const blob = await captureSubtreeThumbnail(html, { variant: 'template' });
      if (!blob) {
        summary.skipped++;
        console.warn(`[recaptureTemplateThumbnails] capture returned null for "${name}"`);
        continue;
      }

      const form = new FormData();
      // Re-send the name to satisfy the update schema (thumbnail-only
      // update); blocks are left untouched.
      form.set('payload', JSON.stringify({ name }));
      form.set('thumbnail', blob, `thumbnail.${blob.type === 'image/webp' ? 'webp' : 'png'}`);
      const put = await fetch(url, { method: 'PUT', body: form });
      if (!put.ok) throw new Error(`PUT HTTP ${put.status}`);
      summary.captured++;
    } catch (err) {
      summary.failed++;
      console.warn(`[recaptureTemplateThumbnails] "${tpl.name}" failed:`, err instanceof Error ? err.message : err);
    } finally {
      done++;
      options.onProgress?.(done, summary.total);
    }
  }

  console.info('[recaptureTemplateThumbnails] done', summary);
  return summary;
}
