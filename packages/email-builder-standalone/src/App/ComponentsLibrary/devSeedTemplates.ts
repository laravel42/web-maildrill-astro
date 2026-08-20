/**
 * Dev-only one-off importer for the 462 `enhanced` templates bundled in
 * the repo-root `email-builder-templates.json`.
 *
 * Runs in the browser (capture needs a real DOM / canvas) and reuses the
 * exact same pipeline as `SaveTemplateDialog`: build the document HTML,
 * snapshot a thumbnail, then POST to `/dev/save-template`. The backend
 * renumbers ids and writes `{uuid}.ndjson` + `{uuid}.webp` under
 * `skills/email-builder/references/templates/`.
 *
 * Trigger from the dev console after `pnpm dev` + `pnpm dev:backend`:
 *
 *   await window.__seedTemplates()          // import all
 *   await window.__seedTemplates({ limit: 5 })  // smoke-test first 5
 *   await window.__seedTemplates({ force: true }) // patch usage/tags on all existing (metadata-only PUT, keeps thumbnails)
 *
 * Sequential by design (one hidden capture iframe at a time); ~10–30 min
 * for the full set. Failures are logged and skipped, never fatal.
 */

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';

import { buildSubtreeHtml } from './thumbnail/buildThumbnailHtml';
import { captureSubtreeThumbnail } from './thumbnail/captureThumbnail';

type Seed = { name: string; tags: string[]; usage?: string; design: string };
type BlockEntry = { id: string; block: unknown };
type SeedSummary = {
  total: number;
  saved: number;
  regenerated: number;
  withThumb: number;
  skipped: number;
  failed: number;
};

/**
 * BFS the flat document map from `root` so the EmailLayout is entry 0
 * (the save route rejects a non-EmailLayout first block) and only
 * reachable blocks are included. Mirrors `SaveTemplateDialog`'s walker:
 * EmailLayout children live at `data.childrenIds`; Container /
 * ColumnsContainer use `data.props.childrenIds` and
 * `data.props.columns[].childrenIds`.
 */
function collectBlocks(document: Record<string, unknown>): BlockEntry[] {
  const visited = new Set<string>();
  const ordered: BlockEntry[] = [];
  const queue: string[] = ['root'];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    const block = document[id];
    if (!block) continue;
    visited.add(id);
    ordered.push({ id, block });

    const data = ((block as { data?: Record<string, unknown> }).data ?? {}) as Record<
      string,
      unknown
    >;
    const enqueue = (ids: unknown) => {
      if (Array.isArray(ids))
        for (const cid of ids) if (typeof cid === 'string' && !visited.has(cid)) queue.push(cid);
    };
    enqueue((data as { childrenIds?: unknown }).childrenIds);
    const props = (data as { props?: Record<string, unknown> }).props;
    if (props) {
      enqueue((props as { childrenIds?: unknown }).childrenIds);
      const columns = (props as { columns?: unknown }).columns;
      if (Array.isArray(columns))
        for (const col of columns) enqueue((col as { childrenIds?: unknown })?.childrenIds);
    }
  }
  return ordered;
}

async function saveOne(
  base: string,
  name: string,
  tags: string[],
  usage: string | undefined,
  blocks: BlockEntry[],
): Promise<boolean | 'thumb'> {
  const url = `${base}/dev/save-template`;
  const payload = { name, tags, ...(usage ? { usage } : {}), blocks };

  let thumbnail: Blob | null = null;
  try {
    const docMap: Record<string, unknown> = {};
    for (const e of blocks) docMap[e.id] = e.block;
    thumbnail = await captureSubtreeThumbnail(buildSubtreeHtml(docMap as never, 'root'), {
      variant: 'template',
    });
  } catch {
    /* capture is best-effort — save without a thumbnail */
  }

  const postJson = () =>
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

  let res: Response;
  if (thumbnail) {
    const form = new FormData();
    form.set('payload', JSON.stringify(payload));
    form.set(
      'thumbnail',
      thumbnail,
      `thumbnail.${thumbnail.type === 'image/webp' ? 'webp' : 'png'}`,
    );
    res = await fetch(url, { method: 'POST', body: form });
    if (res.status === 413) res = await postJson(); // thumbnail over cap → save without it
  } else {
    res = await postJson();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(`HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  return thumbnail ? 'thumb' : true;
}

export async function seedTemplatesFromJson(
  options: { limit?: number; force?: boolean } = {},
): Promise<SeedSummary> {
  const base = resolveBackendUrl();
  const res = await fetch(`${base}/dev/template-seeds`);
  if (!res.ok) throw new Error(`failed to load seeds: HTTP ${res.status}`);
  const { seeds } = (await res.json()) as { seeds: Seed[] };
  const list = options.limit ? seeds.slice(0, options.limit) : seeds;
  const force = options.force ?? false;

  // Idempotency + auto re-capture: index existing templates by name.
  // - force=true             → delete + recreate every match (re-applies
  //                            new metadata like the `usage` axis)
  // - already has a thumbnail → skip
  // - exists WITHOUT thumbnail → delete + recreate (re-capture)
  // - not present             → create
  const existing = new Map<string, { id: string; hasThumbnail: boolean }>();
  try {
    const r = await fetch(`${base}/dev/templates`);
    if (r.ok) {
      const { templates } = (await r.json()) as {
        templates: Array<{ id: string; name: string; hasThumbnail: boolean }>;
      };
      for (const t of templates)
        existing.set(t.name.trim(), { id: t.id, hasThumbnail: t.hasThumbnail });
    }
  } catch {
    /* listing is best-effort — fall back to no dedup */
  }

  const summary: SeedSummary = {
    total: list.length,
    saved: 0,
    regenerated: 0,
    withThumb: 0,
    skipped: 0,
    failed: 0,
  };

  console.info(
    `[seedTemplates] importing ${list.length} enhanced templates${force ? ' (force re-seed)' : ''}…`,
  );

  for (let i = 0; i < list.length; i++) {
    const seed = list[i];
    const name = seed.name.trim();
    const prev = existing.get(name);
    try {
      // Fast path: the template already exists. When forcing, patch
      // only its metadata (usage + tags) via PUT — this preserves the
      // existing blocks AND thumbnail, and avoids the expensive
      // delete + re-capture cycle that overwhelmed the capture
      // pipeline (445 timeouts) on a full re-seed. When NOT forcing,
      // an existing template with a thumbnail is simply skipped.
      if (prev) {
        if (!force) {
          if (prev.hasThumbnail) {
            summary.skipped++;
            continue;
          }
          // Exists but missing thumbnail → fall through to recapture.
        } else {
          const res = await fetch(`${base}/dev/templates/${prev.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags: seed.tags, usage: seed.usage ?? '' }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(`PUT HTTP ${res.status} ${JSON.stringify(body)}`);
          }
          summary.regenerated++;
          if (prev.hasThumbnail) summary.withThumb++;
          continue;
        }
      }

      // Create path: template is new (or exists without a thumbnail and
      // needs a recapture). Parse the design and run the full capture.
      const document = JSON.parse(seed.design) as Record<string, unknown>;
      if ((document.root as { type?: string } | undefined)?.type !== 'EmailLayout') {
        throw new Error('design root is not EmailLayout');
      }
      const recapturing = prev !== undefined; // exists but missing thumbnail
      if (recapturing) {
        await fetch(`${base}/dev/templates/${prev!.id}`, { method: 'DELETE' });
      }
      const result = await saveOne(base, seed.name, seed.tags, seed.usage, collectBlocks(document));
      existing.set(name, { id: name, hasThumbnail: result === 'thumb' });
      if (recapturing) summary.regenerated++;
      else summary.saved++;
      if (result === 'thumb') summary.withThumb++;
    } catch (err) {
      summary.failed++;

      console.warn(
        `[seedTemplates] #${i + 1} "${seed.name}" failed:`,
        err instanceof Error ? err.message : err,
      );
    }
    if ((i + 1) % 25 === 0 || i + 1 === list.length) {
      console.info(
        `[seedTemplates] ${i + 1}/${list.length} — saved=${summary.saved} regen=${summary.regenerated} thumb=${summary.withThumb} skipped=${summary.skipped} failed=${summary.failed}`,
      );
    }
  }

  console.info('[seedTemplates] done', summary);
  return summary;
}
