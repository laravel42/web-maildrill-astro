/**
 * Dev-only batch tool to (re)generate Section preview thumbnails.
 *
 * Seeded/imported sections ship without a thumbnail (the seeder POSTs
 * JSON only, no DOM render). This tool lists every saved section,
 * re-renders each subtree off-screen via the same capture pipeline the
 * save dialog uses (`buildSubtreeHtml` + `captureSubtreeThumbnail`), and
 * PUTs the resulting WebP back IN-PLACE (same uuid) so existing cards /
 * drag-and-drop references keep working.
 *
 * Trigger from the dev console (after `pnpm dev` + `pnpm dev:backend`):
 *
 *   await window.__recaptureSectionThumbnails()                    // all
 *   await window.__recaptureSectionThumbnails({ role: 'pricing' }) // one role
 *   await window.__recaptureSectionThumbnails({ onlyMissing: true })// fill gaps
 *
 * Runs sequentially (one hidden iframe at a time). Capture failures are
 * non-fatal and counted as skipped.
 */

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';

import { buildSubtreeHtml } from './thumbnail/buildThumbnailHtml';
import { captureSubtreeThumbnail } from './thumbnail/captureThumbnail';

type Listing = { role: string; id: string; name: string; hasThumbnail: boolean };
type Summary = { total: number; captured: number; skipped: number; failed: number };

export async function recaptureSectionThumbnails(
  options: { role?: string; onlyMissing?: boolean } = {}
): Promise<Summary> {
  const base = resolveBackendUrl();
  const summary: Summary = { total: 0, captured: 0, skipped: 0, failed: 0 };

  let list: Listing[];
  try {
    const r = await fetch(`${base}/dev/sections`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    list = ((await r.json()) as { sections: Listing[] }).sections;
  } catch (err) {
    console.warn('[recaptureSectionThumbnails] list failed:', err);
    return summary;
  }

  if (options.role) list = list.filter((s) => s.role === options.role);
  if (options.onlyMissing) list = list.filter((s) => !s.hasThumbnail);
  summary.total = list.length;
  console.info(`[recaptureSectionThumbnails] processing ${list.length} sections…`);

  for (const s of list) {
    const url = `${base}/dev/sections/${encodeURIComponent(s.role)}/${encodeURIComponent(s.id)}`;
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
      const html = buildSubtreeHtml(docMap as Parameters<typeof buildSubtreeHtml>[0], blocks[0].id);
      const blob = await captureSubtreeThumbnail(html, { fitHeight: true });
      if (!blob) {
        summary.skipped++;
        console.warn(`[recaptureSectionThumbnails] capture returned null for ${s.role}/${name}`);
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
      console.warn(
        `[recaptureSectionThumbnails] "${s.role}/${s.name}" failed:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.info('[recaptureSectionThumbnails] done', summary);
  return summary;
}
