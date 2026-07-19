import { z } from 'zod';

import { type ThemeJson, themeJsonSchema } from './themeJsonSchema';

/**
 * L42-306 — Theme bundle schema.
 *
 * A theme bundle is a portable JSON object that snapshots both the
 * `EmailLayout` root globals (color palette, font family, link styles,
 * etc.) AND the per-block-type overrides stored under `root.data.theme`.
 *
 * Applied as a strict replacement: keys present in the bundle overwrite
 * the live document; keys absent from the bundle's `globals` are
 * removed (so the document falls back to the EmailLayout schema
 * defaults). This keeps "Apply theme" deterministic regardless of the
 * document's starting state.
 *
 * Identity is server-minted UUID v4. The `name` is metadata only —
 * cannot be relied on for uniqueness, two bundles may share a name.
 *
 * The schema deliberately does NOT include a `version` field; the
 * package version covers compatibility (decision #4 in
 * `plan-theme-export-import.md`).
 */

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * UUID v4 validator (lowercase, hyphenated). Server-minted via
 * `crypto.randomUUID()`; clients never propose ids on POST.
 */
export const themeBundleIdSchema = z.string().regex(UUID_V4_REGEX, 'must be a lowercase UUID v4');

/**
 * Minimal ISO 8601 UTC validator. We don't need the full RFC 3339 here
 * — the server is the only writer, and it always emits the
 * `toISOString()` shape. The regex catches accidental locale strings
 * or epoch numbers at the boundary.
 */
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const isoDatetimeSchema = z.string().regex(ISO_DATETIME_REGEX, 'must be ISO 8601 UTC (e.g. 2026-05-25T18:00:00.000Z)');

/**
 * Mirror of the color shape used by `EmailLayoutPropsSchema`. Inlined
 * here to keep `@eb/document-core` independent of the editor package.
 */
const COLOR_SCHEMA = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional();

/**
 * Globals snapshot. Every key is optional — a bundle only carries the
 * globals the user actually edited. `fontFamily` is permissive
 * (`string`) here because the canonical enum lives in the editor
 * package; the editor validates the merged result on apply.
 */
export const themeBundleGlobalsSchema = z
  .object({
    backdropColor: COLOR_SCHEMA,
    borderColor: COLOR_SCHEMA,
    borderRadius: z.number().nullable().optional(),
    canvasColor: COLOR_SCHEMA,
    textColor: COLOR_SCHEMA,
    fontFamily: z.string().nullable().optional(),
    linkGlobal: z
      .object({
        linkColor: COLOR_SCHEMA,
        underline: z.boolean(),
      })
      .nullable()
      .optional(),
  })
  .partial();

export type ThemeBundleGlobals = z.infer<typeof themeBundleGlobalsSchema>;

/**
 * Keys the bundle considers "globals". Used by `applyThemeBundle` to
 * scrub the live root before re-applying, so absent bundle keys revert
 * to schema defaults. KEEP IN SYNC with `themeBundleGlobalsSchema`.
 */
export const THEME_BUNDLE_GLOBAL_KEYS = [
  'backdropColor',
  'borderColor',
  'borderRadius',
  'canvasColor',
  'textColor',
  'fontFamily',
  'linkGlobal',
] as const;

/**
 * The "payload" half of a bundle — the part that actually mutates a
 * document. Metadata (`id`, `name`, ...) is stripped on apply.
 */
export const themeBundlePayloadSchema = z.object({
  globals: themeBundleGlobalsSchema.optional(),
  blocks: themeJsonSchema.shape.blocks,
});

export type ThemeBundlePayload = z.infer<typeof themeBundlePayloadSchema>;

/**
 * Full bundle (metadata + payload). This is what the backend persists
 * and what the client sends on POST/PUT (minus server-set fields).
 */
export const themeBundleSchema = z.object({
  id: themeBundleIdSchema,
  createdAt: isoDatetimeSchema,
  updatedAt: isoDatetimeSchema,
  name: z.string().trim().min(1, 'name is required').max(100, 'name must be at most 100 characters'),
  description: z.string().max(280, 'description must be at most 280 characters').optional(),
  globals: themeBundleGlobalsSchema.optional(),
  blocks: themeJsonSchema.shape.blocks,
});

export type ThemeBundle = z.infer<typeof themeBundleSchema>;

/**
 * Build the payload half of a bundle from a live `EmailLayout`'s
 * `data`. Pulls every key listed in `THEME_BUNDLE_GLOBAL_KEYS` plus
 * `data.theme.blocks`. Skips `undefined` values (= "never set"); keeps
 * `null` values (= "explicitly cleared").
 *
 * Returns an empty object when the document has no edited globals and
 * no per-block overrides. Callers wrap this with metadata before
 * persisting.
 */
export function extractThemeBundlePayload(rootData: unknown): ThemeBundlePayload {
  const out: ThemeBundlePayload = {};
  if (!rootData || typeof rootData !== 'object' || Array.isArray(rootData)) {
    return out;
  }
  const data = rootData as Record<string, unknown>;

  const globals: Record<string, unknown> = {};
  for (const key of THEME_BUNDLE_GLOBAL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
      globals[key] = data[key];
    }
  }
  if (Object.keys(globals).length > 0) {
    out.globals = globals as ThemeBundleGlobals;
  }

  const theme = data.theme as ThemeJson | undefined;
  if (theme?.blocks && Object.keys(theme.blocks).length > 0) {
    // Shallow clone so callers can't mutate the live document via the bundle.
    out.blocks = { ...theme.blocks };
  }

  return out;
}

/**
 * Apply a bundle to a copy of `rootData`. Strict replacement
 * semantics:
 *
 *  - Every key in `THEME_BUNDLE_GLOBAL_KEYS` is overwritten when present
 *    in `bundle.globals`, and **deleted** otherwise so the document
 *    falls back to the EmailLayout schema's `.default(...)` value.
 *  - `data.theme.blocks` is replaced with `bundle.blocks` when present;
 *    when absent or empty, the `theme` slot is removed.
 *
 * Pure function — does not mutate `rootData`. The metadata fields on
 * `bundle` (id, name, ...) are intentionally ignored.
 */
export function applyThemeBundle(
  rootData: unknown,
  bundle: Pick<ThemeBundle, 'globals' | 'blocks'>
): Record<string, unknown> {
  const base: Record<string, unknown> =
    rootData && typeof rootData === 'object' && !Array.isArray(rootData)
      ? { ...(rootData as Record<string, unknown>) }
      : {};

  for (const key of THEME_BUNDLE_GLOBAL_KEYS) {
    if (bundle.globals && Object.prototype.hasOwnProperty.call(bundle.globals, key)) {
      base[key] = (bundle.globals as Record<string, unknown>)[key];
    } else {
      delete base[key];
    }
  }

  const existingTheme =
    base.theme && typeof base.theme === 'object' && !Array.isArray(base.theme)
      ? ({ ...(base.theme as ThemeJson) } as ThemeJson)
      : undefined;

  if (bundle.blocks && Object.keys(bundle.blocks).length > 0) {
    base.theme = { ...(existingTheme ?? {}), blocks: { ...bundle.blocks } } as ThemeJson;
  } else if (existingTheme) {
    delete (existingTheme as { blocks?: unknown }).blocks;
    if (Object.keys(existingTheme).length === 0) {
      delete base.theme;
    } else {
      base.theme = existingTheme;
    }
  } else {
    delete base.theme;
  }

  return base;
}
