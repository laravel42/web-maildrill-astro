import type { ThemeJson } from './themeJsonSchema';

export type Viewport = 'desktop' | 'mobile';

export type BlockSection = 'style' | 'props';

/**
 * Minimal block shape understood by the resolver. Kept loose so it
 * matches every concrete block type without coupling document-core to
 * any specific schema in `@eb/block-*`.
 */
export interface ResolvableBlock {
  type: string;
  data?:
    | ({
        style?: Record<string, unknown> | null;
        props?: Record<string, unknown> | null;
      } & Record<string, unknown>)
    | null;
}

/**
 * Resolve a single style/props key for a block, walking the two explicit
 * levels of the resolution chain:
 *
 *   1. `block.data.<section>.<key>`                       (explicit)
 *   2. `theme.blocks[block.type].<section>.<key>`         (theme override)
 *
 * If the value is a `{ desktop?, mobile? }` wrapper it is collapsed to
 * the variant matching `viewport`, falling back to the other variant
 * when the preferred one is missing.
 *
 * Returns `undefined` when no value is found at either level — callers
 * are expected to fall through to their own schema default (level 3 of
 * the chain). This matches the block-editor convention where a missing
 * value means "use the block's own default".
 *
 * NOTE: `null` and `undefined` block values are both treated as "not
 * explicitly set" and fall through to the theme. This matches the
 * NDJSON convention applied by `extractEditedFields` at save time.
 * Other falsy values (`0`, `''`, `false`) are honored as explicit.
 */
export function resolveBlockProp<T = unknown>(
  block: ResolvableBlock,
  section: BlockSection,
  key: string,
  theme: ThemeJson | undefined | null,
  viewport: Viewport,
): T | undefined {
  // Level 1 — block.data
  const blockSection = block?.data?.[section] as Record<string, unknown> | null | undefined;
  if (blockSection && Object.prototype.hasOwnProperty.call(blockSection, key)) {
    const value = blockSection[key];
    if (value !== undefined && value !== null) {
      return pickResponsive<T>(value, viewport);
    }
  }

  // Level 2 — theme.blocks[type]
  const themeBlocks = theme?.blocks;
  if (themeBlocks) {
    const themeBlock = themeBlocks[block.type] as
      { style?: Record<string, unknown>; props?: Record<string, unknown> } | undefined;
    const themeSection = themeBlock?.[section];
    if (themeSection && Object.prototype.hasOwnProperty.call(themeSection, key)) {
      const value = themeSection[key];
      if (value !== undefined && value !== null) {
        return pickResponsive<T>(value, viewport);
      }
    }
  }

  return undefined;
}

/**
 * Collapse a `Responsive<T>` wrapper to its `viewport` variant. A value
 * is recognised as a wrapper iff it is a plain object whose keys are a
 * non-empty subset of `{ desktop, mobile }`. Any other shape (including
 * empty `{}`) is returned as-is so that genuine prop objects like
 * `{ top, right, bottom, left }` are not mis-detected.
 *
 * If the preferred variant is missing or `null`/`undefined`, the helper
 * falls back to the other variant. Returns `undefined` when both are
 * unset.
 */
export function pickResponsive<T = unknown>(value: unknown, viewport: Viewport): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) return value as T;

  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return value as T;

  const isResponsive = keys.every((k) => k === 'desktop' || k === 'mobile');
  if (!isResponsive) return value as T;

  const preferred = obj[viewport];
  if (preferred !== undefined && preferred !== null) return preferred as T;

  const fallback = viewport === 'mobile' ? obj.desktop : obj.mobile;
  return (fallback ?? undefined) as T | undefined;
}
