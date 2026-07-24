import { z } from 'zod';

import { FONT_FAMILY_NAMES } from './font-families.js';

import { PaletteEnum, VerticalEnum } from './brief-schema.js';

/**
 * Mood tokens emitted by the wizard's tone step. Mirrors `MOOD_CHIPS`
 * on the frontend. Kept permissive (the brief schema treats moods as
 * free strings) but enumerated here so the generator can switch on them.
 */
export const MOOD_TOKENS = [
  'friendly',
  'premium',
  'bold',
  'minimal',
  'playful',
  'wellness',
  'corporate',
  'editorial',
] as const;

/**
 * Theme generation schemas (L42 — AI wizard Phase 4).
 *
 * The wizard's "Theme" target collects a handful of brand inputs (brand
 * colours, mood, vertical, palette direction) and asks the backend to
 * synthesise a complete, WCAG-accessible theme. The output is shaped to
 * drop directly into the editor's existing theme pipeline:
 * `ThemeBundlePayload` = `{ globals, blocks }`, applied via
 * `applyThemePreset()` and persistable via `saveTheme()`.
 *
 * Keeping the output schema here (instead of importing from
 * `@eb/document-core`) keeps the backend free of an editor-package
 * dependency and lets us pin the exact font-family enum the editor
 * accepts. The editor re-validates the merged result on apply.
 */

const HEX_COLOR = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a #RRGGBB color');

/**
 * Font-family keys accepted by the editor's `EmailLayoutPropsSchema`.
 * Derived from the single-source `FONT_FAMILY_NAMES` (the font catalog in
 * `@eb/document-core`), excluding `INHERIT` (the wizard always picks an
 * explicit font). Because this comes from the same catalog the editor
 * uses, the enum can never drift out of sync — adding a font to the
 * catalog automatically makes it a valid theme font here.
 */
const THEME_FONT_KEYS = FONT_FAMILY_NAMES.filter((k) => k !== 'INHERIT') as [string, ...string[]];

export const ThemeFontFamilyEnum = z.enum(THEME_FONT_KEYS);

export type ThemeFontFamily = z.infer<typeof ThemeFontFamilyEnum>;

/**
 * Button corner style. Mirrors the `shape` union in
 * `@eb/block-button` (`'rectangle' | 'pill'` plus a numeric radius).
 * The wizard only emits the two named shapes for predictability.
 */
export const ButtonShapeEnum = z.enum(['rectangle', 'rounded', 'pill']);

export type ButtonShape = z.infer<typeof ButtonShapeEnum>;

// ---------------------------------------------------------------------------
// Input — what the wizard POSTs to /api/generate-theme
// ---------------------------------------------------------------------------

export const GenerateThemeInputSchema = z.object({
  /**
   * Brand colours from the wizard's StepThemeColors. All optional — the
   * generator fills the gaps deterministically. `primary` drives links,
   * buttons, and accents when present.
   */
  brandColors: z
    .object({
      primary: HEX_COLOR.optional(),
      secondary: HEX_COLOR.optional(),
      accent: HEX_COLOR.optional(),
    })
    .optional(),
  /** Optional brand name — only used to label the generated theme. */
  brandName: z.string().trim().max(80).optional(),
  /** Mood hints (friendly, premium, minimal …). Steer typography + radius. */
  moods: z.array(z.enum(MOOD_TOKENS)).max(4).optional(),
  /** Industry vertical — secondary steering signal for typography. */
  vertical: VerticalEnum.optional(),
  /** Palette mood (warm/cool/mono/pastel/dark/neutral). Drives surface tone. */
  palette: PaletteEnum.optional(),
  /**
   * Explicit font-family override for body text. When omitted, the
   * generator derives a font from the mood/vertical ("Auto").
   */
  fontFamily: ThemeFontFamilyEnum.optional(),
  /**
   * Explicit font-family override for headings. When omitted, falls back
   * to fontFamily (same font for body and headings).
   */
  fontHeadings: ThemeFontFamilyEnum.optional(),
  /**
   * Explicit border-radius override in px. When omitted, the generator
   * derives a radius from the mood ("Auto").
   */
  borderRadius: z.number().int().min(0).max(48).optional(),
  /** Free-text brief for the optional LLM enrichment pass. */
  brief: z.string().trim().max(800).optional(),
  /** UI locale — hint for the LLM to name the theme in the user's language. */
  locale: z.string().trim().max(35).optional(),
});

export type GenerateThemeInput = z.infer<typeof GenerateThemeInputSchema>;

// ---------------------------------------------------------------------------
// Output — a ThemeBundlePayload-compatible object
// ---------------------------------------------------------------------------

const ThemeGlobalsSchema = z.object({
  backdropColor: HEX_COLOR,
  canvasColor: HEX_COLOR,
  textColor: HEX_COLOR,
  fontFamily: ThemeFontFamilyEnum,
  fontHeadings: ThemeFontFamilyEnum.optional(),
  borderRadius: z.number().int().min(0).max(48).optional(),
  linkGlobal: z.object({
    linkColor: HEX_COLOR,
    underline: z.boolean(),
  }),
});

export type ThemeGlobals = z.infer<typeof ThemeGlobalsSchema>;

const ThemeBlocksSchema = z.record(
  z.string(),
  z.object({
    style: z.record(z.string(), z.unknown()).optional(),
    props: z.record(z.string(), z.unknown()).optional(),
  })
);

export type ThemeBlocks = z.infer<typeof ThemeBlocksSchema>;

/**
 * The full generated payload. `globals` + `blocks` map 1:1 onto the
 * editor's `ThemeBundlePayload`. `name` and `accessibility` are metadata
 * the wizard surfaces in the summary step (and feeds to "Save to
 * library"); they are stripped before the payload is applied.
 */
export const GeneratedThemeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  globals: ThemeGlobalsSchema,
  blocks: ThemeBlocksSchema,
  /** Per-pair WCAG contrast report so the UI can show an a11y badge. */
  accessibility: z.object({
    /** Lowest contrast ratio among the checked pairs (text, button). */
    minContrastRatio: z.number(),
    /** True when every checked pair meets WCAG AA (≥4.5 normal text). */
    passesAA: z.boolean(),
    /** Human-readable notes about any auto-corrections applied. */
    notes: z.array(z.string()).default([]),
  }),
});

export type GeneratedTheme = z.infer<typeof GeneratedThemeSchema>;
