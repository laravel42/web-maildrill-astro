/**
 * Dev-only seeder for prebuilt Primitives — single, non-container blocks
 * across three primitive axes (`button`, `notion-text`, `social-media`).
 * Mirrors `devSeedThemes` / `devSeedSections`: runs in the browser and
 * POSTs each primitive to `/dev/save-primitive`. The backend derives
 * the `type` axis from `blocks[0].block.type`, renumbers ids and writes
 * `{uuid}.ndjson` under `references/primitives/{type}/`.
 *
 * Trigger from the dev console after `pnpm dev` + `pnpm dev:backend`:
 *
 *   await window.__seedPrimitives()                    // seed all
 *   await window.__seedPrimitives({ type: 'button' })  // one axis
 *   await window.__seedPrimitives({ force: true })     // overwrite same-name
 *
 * The catalog itself (data + builders) lives in `primitivesCatalog.ts` —
 * shared with `BlocksCategoryContent.tsx`, which renders it as
 * drag/click-to-insert accordions in the Blocks tab, no backend involved.
 *
 * Idempotent by (type, name): existing primitives with the same name
 * are skipped (or deleted + recreated under `force`).
 */

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';

import { PRIMITIVES, type PrimitiveType } from './primitivesCatalog';

type SeedSummary = { total: number; saved: number; skipped: number; failed: number };

export async function seedPrimitives(
  options: { type?: PrimitiveType; limit?: number; force?: boolean } = {},
): Promise<SeedSummary> {
  const base = resolveBackendUrl();
  let list = options.type ? PRIMITIVES.filter((p2) => p2.type === options.type) : PRIMITIVES;
  if (options.limit) list = list.slice(0, options.limit);

  // Index existing primitives by (type, name). In force mode we delete the
  // matching file first (so the prebuilt defaults overwrite older copies);
  // otherwise a matching name is skipped (idempotent seeding).
  const existing = new Map<string, { type: string; id: string }>();
  try {
    const r = await fetch(`${base}/dev/primitives`);
    if (r.ok) {
      const { primitives } = (await r.json()) as {
        primitives: Array<{ type: string; name: string; id: string }>;
      };
      for (const item of primitives)
        existing.set(`${item.type}/${item.name.trim()}`, { type: item.type, id: item.id });
    }
  } catch {
    /* best-effort dedup */
  }

  const summary: SeedSummary = { total: list.length, saved: 0, skipped: 0, failed: 0 };
  console.info(
    `[seedPrimitives] seeding ${list.length} primitives${options.force ? ' (force)' : ''}…`,
  );

  for (const def of list) {
    const prev = existing.get(`${def.type}/${def.name}`);
    if (prev && !options.force) {
      summary.skipped++;
      continue;
    }
    try {
      if (prev && options.force) {
        await fetch(
          `${base}/dev/primitives/${encodeURIComponent(prev.type)}/${encodeURIComponent(prev.id)}`,
          {
            method: 'DELETE',
          },
        );
      }
      const res = await fetch(`${base}/dev/save-primitive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: def.name,
          ...(def.description ? { description: def.description } : {}),
          tags: [def.type],
          blocks: [{ id: 'seed-1', block: def.block }],
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(`HTTP ${res.status} ${JSON.stringify(b)}`);
      }
      summary.saved++;
    } catch (err) {
      summary.failed++;
      console.warn(
        `[seedPrimitives] "${def.type}/${def.name}" failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.info('[seedPrimitives] done', summary);
  return summary;
}
