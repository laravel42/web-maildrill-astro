import { z } from 'zod';

/**
 * Phase 2a — theme JSON schema (simplified, no tokens).
 *
 * The theme lives at `EmailLayout.data.theme` and stores per-block-type
 * overrides for `style` and `props`. It is the second level of the
 * resolution chain implemented by `resolveBlockProp`:
 *
 *   1. block.data.{style|props}.<key>            ← explicit per-block (wins)
 *   2. theme.blocks[type].{style|props}.<key>    ← per-type override
 *   3. block schema default                      ← caller's responsibility
 *
 * Any value at level 1 or 2 may be either a literal `T` or a responsive
 * wrapper `{ desktop?: T; mobile?: T }`. The wrapper is collapsed at
 * resolve time using the active viewport. The schema deliberately treats
 * inner values as opaque (`unknown`) so it doesn't have to mirror every
 * block's prop typing — each block already owns its own Zod schema.
 *
 * The shape is intentionally minimal and forward-compatible; future
 * additions (e.g. tokens) can extend the top-level object without
 * breaking documents authored against this schema.
 */

const BlockOverrideSchema = z
  .object({
    style: z.record(z.string(), z.unknown()).optional(),
    props: z.record(z.string(), z.unknown()).optional(),
  })
  .partial();

export const themeJsonSchema = z.object({
  blocks: z.record(z.string(), BlockOverrideSchema).optional(),
});

export type ThemeJson = z.infer<typeof themeJsonSchema>;

export type BlockThemeOverride = z.infer<typeof BlockOverrideSchema>;

/**
 * Convenience helper for the `T | { desktop?: T; mobile?: T }` shape that
 * the resolver accepts at level 1 and level 2 of the chain.
 */
export type ResponsiveValue<T> = T | { desktop?: T; mobile?: T };
