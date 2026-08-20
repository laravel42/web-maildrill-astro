import {
  type BlockSection,
  type ResolvableBlock,
  resolveBlockProp,
  type Viewport,
} from './resolveBlockProp';
import type { ThemeJson } from './themeJsonSchema';

/**
 * Per-block-type schema defaults — typically obtained by calling
 * `getSchemaDefaults(BlockSchema)` on the block's Zod schema. The shape
 * mirrors `block.data` (only `style` and `props` are read by the
 * resolver). Pass via `resolveBlockData`'s optional `schemaDefaults`
 * argument to wire level 3 of the resolution chain — the block's
 * shipped baseline.
 */
export type BlockSchemaDefaults = {
  style?: Record<string, unknown>;
  props?: Record<string, unknown>;
};

/**
 * Phase 2b — block-level theme resolution.
 *
 * Returns a shallow-cloned block whose `data.style` and `data.props` are
 * the result of merging the resolution chain key-by-key:
 *
 *   1. block.data.<section>.<key>            (explicit, wins)
 *   2. theme.blocks[type].<section>.<key>    (theme override)
 *   3. schemaDefaults.<section>.<key>        (block schema default,
 *                                             recovered via
 *                                             `getSchemaDefaults`)
 *   ↓ otherwise the key is omitted from the merged result and the
 *     block's render path falls through to whatever literal fallback
 *     remains (these are progressively removed as schemas grow
 *     defaults).
 *
 * `Responsive<T>` wrappers ({ desktop?, mobile? }) at level 1 / level 2
 * are collapsed to the variant matching `viewport`, with cross-viewport
 * fallback when only one variant is set. Schema defaults at level 3 are
 * always literals (Zod doesn't represent responsive defaults).
 *
 * Fast path: when there is no theme override for the block's type AND
 * no schema defaults AND no Responsive<T> wrapper to collapse, the
 * original block reference is returned unchanged so React reconciliation
 * sees a stable identity.
 *
 * Other top-level fields of `data` (e.g. `childrenIds`, `markdown`,
 * `html`) are passed through untouched — only the `style` and `props`
 * sections are theme-aware.
 */
export function resolveBlockData<TBlock extends ResolvableBlock>(
  block: TBlock,
  theme: ThemeJson | undefined | null,
  viewport: Viewport,
  schemaDefaults?: BlockSchemaDefaults | null,
): TBlock {
  if (!block || !block.data) return block;

  const themeBlock = theme?.blocks?.[block.type] as
    { style?: Record<string, unknown>; props?: Record<string, unknown> } | undefined;
  const hasThemeOverride = themeBlock !== undefined;
  const hasSchemaDefaults = schemaDefaults !== undefined && schemaDefaults !== null;

  const blockData = block.data as Record<string, unknown>;
  let nextData: Record<string, unknown> | null = null;

  for (const section of SECTIONS) {
    const blockSection = blockData[section] as Record<string, unknown> | null | undefined;
    const themeSection = themeBlock?.[section];
    const defaultsSection = hasSchemaDefaults ? schemaDefaults?.[section] : undefined;

    const blockKeys = blockSection ? Object.keys(blockSection) : [];
    const themeKeys = themeSection ? Object.keys(themeSection) : [];
    const defaultsKeys = defaultsSection ? Object.keys(defaultsSection) : [];
    if (blockKeys.length === 0 && themeKeys.length === 0 && defaultsKeys.length === 0) continue;

    // Quick path: no theme override AND no schema defaults AND no
    // responsive wrappers in the block section → keep the original
    // reference so React reconciliation stays stable.
    if (!hasThemeOverride && defaultsKeys.length === 0 && !sectionNeedsCollapse(blockSection)) {
      continue;
    }

    const merged: Record<string, unknown> = {};
    const allKeys = new Set<string>([...defaultsKeys, ...themeKeys, ...blockKeys]);
    for (const key of allKeys) {
      const resolved = resolveBlockProp(block, section, key, theme, viewport);
      if (resolved !== undefined) {
        merged[key] = resolved;
        continue;
      }
      // Level 3 — schema default. Honors falsy primitives (0, '', false)
      // as explicit, only excludes `undefined`.
      if (defaultsSection && Object.prototype.hasOwnProperty.call(defaultsSection, key)) {
        const fallback = defaultsSection[key];
        if (fallback !== undefined) merged[key] = fallback;
      }
    }

    if (nextData === null) nextData = { ...blockData };
    nextData[section] = merged;
  }

  if (nextData === null) return block;
  return { ...block, data: nextData as TBlock['data'] };
}

const SECTIONS: readonly BlockSection[] = ['style', 'props'];

/**
 * True iff the section contains any value that looks like a
 * `Responsive<T>` wrapper, in which case we must rebuild the section
 * even without a theme override so the wrapper is collapsed to a
 * literal for the active viewport.
 */
function sectionNeedsCollapse(section: Record<string, unknown> | null | undefined): boolean {
  if (!section) return false;
  for (const key of Object.keys(section)) {
    if (isResponsiveWrapper(section[key])) return true;
  }
  return false;
}

function isResponsiveWrapper(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 0) return false;
  return keys.every((k) => k === 'desktop' || k === 'mobile');
}
