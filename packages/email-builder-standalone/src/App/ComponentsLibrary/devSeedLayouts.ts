/**
 * Dev-only seeder for prebuilt Layouts — STRUCTURAL-ONLY subtrees whose
 * every block is a `Container` or `ColumnsContainer` (no content). The
 * backend derives the `shape` axis from the root block (`Container` →
 * `container`; `ColumnsContainer` → `columns-{columnsCount}`), renumbers
 * ids and writes `{uuid}.ndjson` under `references/layouts/{shape}/`.
 *
 * Mirrors `devSeedSections` / `devSeedThemes`: runs in the browser and
 * POSTs each layout to `/dev/save-layout`.
 *
 * Trigger from the dev console after `pnpm dev` + `pnpm dev:backend`:
 *
 *   await window.__seedLayouts()                       // seed all
 *   await window.__seedLayouts({ shape: 'columns-2' }) // one axis
 *   await window.__seedLayouts({ force: true })        // overwrite same-name
 *
 * Layouts carry no content, so the "wow" is in the COMPOSITION: 2–3
 * levels of nesting (band → columns → cards), gradient and
 * background-image bands, asymmetric corner radii, top-accent and glass
 * cards, and mobile-responsive column stacking. Each layout is a
 * polished, ready-to-fill skeleton — the empty cells are intentional
 * drop targets. Idempotent by (shape, name).
 */

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';
import { DEFAULT_IMAGE_PLACEHOLDER } from '../../documents/editor/EditorContext';

type LayoutShape = 'container' | 'columns-2' | 'columns-3';

type BlockEntry = { id: string; block: unknown };
type Pad = { top: number; right: number; bottom: number; left: number };

// Structural-only node tree — Containers and ColumnsContainers only.
type Node =
  | { t: 'container'; style?: object; children: Node[] }
  | { t: 'cols'; style?: object; props: object; columns: Node[][] };

const IMG = DEFAULT_IMAGE_PLACEHOLDER;

const WHITE = '#FFFFFF';
const BORDER = '#E2E8F0';
const SOFT = '#F1F5F9';
const SLATE = '#F8FAFC';
const INK = '#0F172A';
const ACCENT = '#6366F1';
const GRAD_INDIGO = 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)';
const GRAD_SUNSET = 'linear-gradient(135deg, #F97316 0%, #DB2777 100%)';
const GRAD_TEAL = 'linear-gradient(135deg, #0EA5E9 0%, #14B8A6 100%)';

const pad = (top: number, right: number, bottom: number, left: number): Pad => ({
  top,
  right,
  bottom,
  left,
});
const round = (r: number) => ({ topLeft: r, topRight: r, bottomLeft: r, bottomRight: r });
const bg = (url: string = IMG): string => `url("${url}") no-repeat center center / cover`;

// --- Node builders ---------------------------------------------------------

const container = (children: Node[] = [], style: object = {}): Node => ({
  t: 'container',
  children,
  style,
});
const cols = (
  columnsCount: 2 | 3,
  fixedWidths: (number | null)[],
  columns: Node[][],
  style: object = {},
  props: object = {},
): Node => ({
  t: 'cols',
  style,
  props: { fixedWidths, columnsCount, layout: 'layout-custom', contentAlignment: 'top', ...props },
  columns,
});
const colsStack = (
  columnsCount: 2 | 3,
  fixedWidths: (number | null)[],
  columns: Node[][],
  style: object = {},
  props: object = {},
): Node =>
  cols(columnsCount, fixedWidths, columns, style, {
    stackColumnsOnMobile: true,
    contentAlignmentMobile: 'top',
    ...props,
  });

// --- Card / band style presets ---------------------------------------------

const SECTION = pad(40, 40, 40, 40);
const SECTION_M = pad(28, 20, 28, 20);

const cardStyle = (): object => ({
  backgroundColor: WHITE,
  borderColor: BORDER,
  borderTop: 1,
  borderBottom: 1,
  borderLeft: 1,
  borderRight: 1,
  shape: round(16),
  padding: pad(28, 24, 28, 24),
  mobilePadding: pad(20, 18, 20, 18),
});
const glassStyle = (): object => ({ ...cardStyle(), backgroundColor: SOFT });
const corneredStyle = (
  corners: { topLeft?: number; topRight?: number; bottomLeft?: number; bottomRight?: number } = {
    topLeft: 24,
    bottomRight: 24,
  },
): object => ({
  ...cardStyle(),
  shape: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0, ...corners },
});
const topAccentStyle = (color: string = ACCENT): object => ({
  backgroundColor: WHITE,
  borderColor: color,
  borderTop: 4,
  borderBottom: 1,
  borderLeft: 1,
  borderRight: 1,
  shape: { topLeft: 0, topRight: 0, bottomLeft: 16, bottomRight: 16 },
  padding: pad(28, 24, 28, 24),
  mobilePadding: pad(22, 18, 22, 18),
});
const gradientStyle = (grad: string = GRAD_INDIGO): object => ({
  backgroundColor: ACCENT,
  background: grad,
  shape: round(20),
  padding: pad(48, 32, 48, 32),
  mobilePadding: pad(32, 20, 32, 20),
});
const imageStyle = (tint: string = INK, url: string = IMG): object => ({
  backgroundColor: tint,
  background: bg(url),
  shape: round(20),
  padding: pad(56, 32, 56, 32),
  mobilePadding: pad(40, 20, 40, 20),
});

// Empty card cells (structural drop targets) in a few finishes.
const card = (): Node => container([], cardStyle());
const glass = (): Node => container([], glassStyle());
const topCard = (color?: string): Node => container([], topAccentStyle(color));
const gradCard = (grad?: string): Node => container([], gradientStyle(grad));
const imgCard = (tint?: string): Node => container([], imageStyle(tint));
const cornered = (corners?: {
  topLeft?: number;
  topRight?: number;
  bottomLeft?: number;
  bottomRight?: number;
}): Node => container([], corneredStyle(corners));

// --- Catalog (complex, 2–3 levels deep) ------------------------------------

type LayoutDef = { shape: LayoutShape; name: string; description?: string; node: Node };

const LAYOUTS: LayoutDef[] = [
  // ===== container — bands + nested cards/grids =====
  {
    shape: 'container',
    name: 'Gradient hero band',
    description: 'Indigo→violet band wrapping a centered white card.',
    node: container([card()], {
      ...gradientStyle(GRAD_INDIGO),
      padding: pad(56, 40, 56, 40),
      mobilePadding: SECTION_M,
    }),
  },
  {
    shape: 'container',
    name: 'Spotlight (image overlay)',
    description: 'Background-image band with dark tint + inset card.',
    node: container([card()], {
      ...imageStyle('#0F172A'),
      padding: pad(64, 40, 64, 40),
      mobilePadding: pad(44, 20, 44, 20),
    }),
  },
  {
    shape: 'container',
    name: 'Feature grid 2×2',
    description: 'Section wrapping two 2-column card rows (deep nest).',
    node: container(
      [
        colsStack(2, [50, 50, null], [[card()], [card()]]),
        colsStack(2, [50, 50, null], [[card()], [card()]]),
      ],
      { backgroundColor: SLATE, padding: SECTION, mobilePadding: SECTION_M },
    ),
  },
  {
    shape: 'container',
    name: 'Stacked sections',
    description: 'Three stacked cards inside a soft section.',
    node: container([card(), card(), card()], {
      backgroundColor: SLATE,
      padding: SECTION,
      mobilePadding: SECTION_M,
    }),
  },
  {
    shape: 'container',
    name: 'Split callout',
    description: 'Accent-tinted band with a 2-column card split.',
    node: container(
      [colsStack(2, [60, 40, null], [[card()], [card()]], {}, { contentAlignment: 'middle' })],
      {
        backgroundColor: '#EEF2FF',
        shape: round(20),
        padding: pad(36, 32, 36, 32),
        mobilePadding: SECTION_M,
      },
    ),
  },

  // ===== columns-2 — splits, shells, nested columns =====
  {
    shape: 'columns-2',
    name: 'Hero split',
    description: 'Text card + media card, 60/40, stacks on mobile.',
    node: colsStack(
      2,
      [60, 40, null],
      [[card()], [imgCard()]],
      { padding: pad(8, 0, 8, 0) },
      { contentAlignment: 'middle' },
    ),
  },
  {
    shape: 'columns-2',
    name: 'Sidebar shell',
    description: 'Narrow sidebar card + main column of two stacked cards.',
    node: colsStack(
      2,
      [32, 68, null],
      [[glass()], [container([card(), card()], { padding: pad(0, 0, 0, 0) })]],
    ),
  },
  {
    shape: 'columns-2',
    name: 'Media + text',
    description: 'Image card beside a content card, 45/55.',
    node: colsStack(2, [45, 55, null], [[imgCard()], [card()]], {}, { contentAlignment: 'middle' }),
  },
  {
    shape: 'columns-2',
    name: 'Magazine',
    description: 'Nested 2-up grid in the main column + aside card.',
    node: colsStack(
      2,
      [66, 34, null],
      [
        [colsStack(2, [50, 50, null], [[card()], [card()]])],
        [cornered({ topRight: 24, bottomLeft: 24 })],
      ],
    ),
  },

  // ===== columns-3 — bento, pricing, gallery, features =====
  {
    shape: 'columns-3',
    name: 'Bento grid',
    description: 'Mixed-finish trio: gradient · image · glass.',
    node: colsStack(3, [33, 34, 33], [[gradCard(GRAD_INDIGO)], [imgCard()], [gradCard(GRAD_TEAL)]]),
  },
  {
    shape: 'columns-3',
    name: 'Pricing trio',
    description: 'Two top-accent tiers around a highlighted gradient tier.',
    node: colsStack(
      3,
      [33, 34, 33],
      [[topCard()], [gradCard(GRAD_SUNSET)], [topCard()]],
      {},
      { contentAlignment: 'middle' },
    ),
  },
  {
    shape: 'columns-3',
    name: 'Gallery grid',
    description: 'Three background-image cards.',
    node: colsStack(3, [33, 34, 33], [[imgCard()], [imgCard()], [imgCard()]]),
  },
  {
    shape: 'columns-3',
    name: 'Feature trio',
    description: 'Three top-accent feature cards, stack on mobile.',
    node: colsStack(3, [33, 34, 33], [[topCard()], [topCard()], [topCard()]]),
  },
];

type SeedSummary = { total: number; saved: number; skipped: number; failed: number };

/**
 * Flatten a structural node tree into `{id, block}[]` with the root at
 * index 0. Only emits Container / ColumnsContainer blocks (no content),
 * so `/dev/save-layout` accepts the subtree.
 */
function flatten(root: Node): BlockEntry[] {
  const entries: BlockEntry[] = [];
  let counter = 0;
  const walk = (node: Node): string => {
    const id = `seed-${++counter}`;
    const entry: BlockEntry = { id, block: null };
    entries.push(entry);
    if (node.t === 'container') {
      entry.block = {
        type: 'Container',
        data: { style: node.style ?? {}, props: { childrenIds: node.children.map(walk) } },
      };
    } else {
      const colArrays = node.columns.map((col) => col.map(walk));
      while (colArrays.length < 3) colArrays.push([]);
      entry.block = {
        type: 'ColumnsContainer',
        data: {
          style: node.style ?? {},
          props: { ...node.props, columns: colArrays.map((ids) => ({ childrenIds: ids })) },
        },
      };
    }
    return id;
  };
  walk(root);
  return entries;
}

export async function seedLayouts(
  options: { shape?: LayoutShape; limit?: number; force?: boolean } = {},
): Promise<SeedSummary> {
  const base = resolveBackendUrl();
  let list = options.shape ? LAYOUTS.filter((l) => l.shape === options.shape) : LAYOUTS;
  if (options.limit) list = list.slice(0, options.limit);

  // Index existing layouts by (shape, name). In force mode we delete the
  // matching file first (so the prebuilt defaults overwrite older copies);
  // otherwise a matching name is skipped (idempotent seeding).
  const existing = new Map<string, { shape: string; id: string }>();
  try {
    const r = await fetch(`${base}/dev/layouts`);
    if (r.ok) {
      const { layouts } = (await r.json()) as {
        layouts: Array<{ shape: string; name: string; id: string }>;
      };
      for (const l of layouts)
        existing.set(`${l.shape}/${l.name.trim()}`, { shape: l.shape, id: l.id });
    }
  } catch {
    /* best-effort dedup */
  }

  const summary: SeedSummary = { total: list.length, saved: 0, skipped: 0, failed: 0 };
  console.info(`[seedLayouts] seeding ${list.length} layouts${options.force ? ' (force)' : ''}…`);

  for (const def of list) {
    const prev = existing.get(`${def.shape}/${def.name}`);
    if (prev && !options.force) {
      summary.skipped++;
      continue;
    }
    try {
      if (prev && options.force) {
        await fetch(
          `${base}/dev/layouts/${encodeURIComponent(prev.shape)}/${encodeURIComponent(prev.id)}`,
          {
            method: 'DELETE',
          },
        );
      }
      const blocks = flatten(def.node);
      const res = await fetch(`${base}/dev/save-layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: def.name,
          ...(def.description ? { description: def.description } : {}),
          tags: [def.shape],
          blocks,
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
        `[seedLayouts] "${def.shape}/${def.name}" failed:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.info('[seedLayouts] done', summary);
  return summary;
}
