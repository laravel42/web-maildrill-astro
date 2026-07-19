import { z } from 'zod';

import { FONT_CATALOG } from './fontCatalog';

export const COLOR_SCHEMA = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional();

export const PADDING_OBJECT = z.object({
  top: z.number(),
  bottom: z.number(),
  right: z.number(),
  left: z.number(),
});

export const PADDING_SCHEMA = PADDING_OBJECT.optional().nullable();

/**
 * The valid font-family keys, derived from the single-source {@link FONT_CATALOG}.
 * Adding a font to the catalog automatically extends the enum / schema.
 *
 * The element type is widened to `string` ON PURPOSE. At runtime the array
 * holds the exact catalog keys, so `z.enum(FONT_FAMILY_NAMES)` still
 * validates against the real values. But keeping the *type* as
 * `[string, ...string[]]` (instead of a 31-member literal union) stops the
 * enum from threading 31 string literals through every block PropsSchema's
 * `z.infer`. With the literal union, the combined `TEditorBlock`
 * discriminated union exceeds TypeScript's inference-depth limit and
 * collapses a member to `{ data: unknown }`. Use {@link FontFamilyKey}
 * (from the catalog) wherever the literal union is genuinely needed.
 */
export const FONT_FAMILY_NAMES = FONT_CATALOG.map((e) => e.key) as unknown as [string, ...string[]];

export const FONT_FAMILY_SCHEMA = z.enum(FONT_FAMILY_NAMES).nullable().optional();

export const BORDER_RADIUS_SCHEMA = z.object({
  topLeft: z.number().min(0).optional(),
  topRight: z.number().min(0).optional(),
  bottomLeft: z.number().min(0).optional(),
  bottomRight: z.number().min(0).optional(),
});

export const SHAPE_SCHEMA = z
  .union([z.enum(['rectangle', 'pill']), BORDER_RADIUS_SCHEMA])
  .optional()
  .nullable();

export const BORDER_SIZE_SCHEMA = z.object({
  top: z.number().min(0).optional(),
  bottom: z.number().min(0).optional(),
  left: z.number().min(0).optional(),
  right: z.number().min(0).optional(),
});
