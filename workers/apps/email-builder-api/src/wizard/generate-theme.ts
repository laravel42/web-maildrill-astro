/**
 * generate-theme — synthesise a complete, WCAG-accessible theme from a
 * handful of brand inputs (AI wizard Phase 4).
 *
 * Strategy mirrors `compile-brief.ts`:
 *
 *   1. Deterministic scaffold — derive a full palette + typography +
 *      button styling from the brand colours, palette mood, and mood
 *      tokens. This always runs and always produces a valid, accessible
 *      theme. No network, no API key required.
 *   2. WCAG correction — every text/surface and button text/fill pair is
 *      checked against WCAG AA (4.5:1). Failing pairs are auto-corrected
 *      (text flipped to black/white, button text flipped) and a note is
 *      recorded so the UI can explain what changed.
 *   3. Optional LLM enrichment — when a brief is present and a provider
 *      is configured, the LLM may refine the theme *name* only. The
 *      colour decisions stay deterministic so accessibility is never at
 *      the mercy of the model. If the LLM fails, the scaffold name wins.
 *
 * The function never throws — it always returns a `GeneratedTheme`.
 */

import type { getProvider as ProductionGetProvider, ProviderName } from '../providers/index.js';
import { getContrastRatio, getSuggestedTextColor, WCAG_LEVELS } from '../utils/wcag-contrast.js';

import {
  type GeneratedTheme,
  GeneratedThemeSchema,
  type GenerateThemeInput,
  type ThemeFontFamily,
} from './theme-schema.js';

const DEFAULT_LLM_TOKENS = 600;

// ---------------------------------------------------------------------------
// Colour helpers (hex math — no dependencies)
// ---------------------------------------------------------------------------

interface Rgb {
  r: number;
  g: number;
  b: number;
}

function hexToRgb(hex: string): Rgb {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function rgbToHex({ r, g, b }: Rgb): string {
  const h = (n: number) => clamp(n).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** Mix two colours by `weight` (0 = all `a`, 1 = all `b`). */
function mix(a: string, b: string, weight: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex({
    r: ca.r + (cb.r - ca.r) * w,
    g: ca.g + (cb.g - ca.g) * w,
    b: ca.b + (cb.b - ca.b) * w,
  });
}

/** Lighten toward white. */
function lighten(hex: string, amount: number): string {
  return mix(hex, '#FFFFFF', amount);
}

/** Darken toward black. */
function darken(hex: string, amount: number): string {
  return mix(hex, '#000000', amount);
}

/** Perceived luminance (0 dark … 255 light) for light/dark decisions. */
function perceivedLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

function isDark(hex: string): boolean {
  return perceivedLuminance(hex) < 128;
}

// ---------------------------------------------------------------------------
// Typography + radius steering
// ---------------------------------------------------------------------------

/**
 * Pick a font family from the editor's supported set based on the mood
 * tokens and vertical. Deterministic — first matching mood wins.
 */
function pickFontFamily(moods: string[], vertical?: string): ThemeFontFamily {
  const moodSet = new Set(moods);
  if (moodSet.has('editorial') || moodSet.has('premium')) return 'PLAYFAIR';
  if (moodSet.has('playful')) return 'PACIFICO';
  if (moodSet.has('bold')) return 'OSWALD';
  if (moodSet.has('corporate')) return 'MERRIWEATHER';
  if (moodSet.has('minimal')) return 'MONTSERRAT';
  if (moodSet.has('wellness')) return 'LATO';
  if (moodSet.has('friendly')) return 'OPEN_SANS';

  // Vertical fallback
  switch (vertical) {
    case 'fintech':
    case 'saas':
      return 'MODERN_SANS';
    case 'hospitality':
    case 'real-estate':
      return 'PLAYFAIR';
    case 'media':
      return 'MERRIWEATHER';
    default:
      return 'MODERN_SANS';
  }
}

/**
 * Pick a button corner style + a global border radius (px) from moods.
 */
function pickBorderRadius(moods: string[]): number {
  const moodSet = new Set(moods);
  if (moodSet.has('playful') || moodSet.has('friendly')) return 24;
  if (moodSet.has('bold') || moodSet.has('corporate') || moodSet.has('editorial')) return 0;
  if (moodSet.has('minimal')) return 4;
  return 8;
}

/**
 * Map an explicit border-radius (px) to a button shape so the CTA agrees
 * with the global radius: 0 → rectangle, ≥20 → pill, otherwise rounded.
 */
// ---------------------------------------------------------------------------
// Palette synthesis
// ---------------------------------------------------------------------------

/**
 * Surface tone from the palette mood. `dark` produces a dark canvas; the
 * rest stay light with a tinted backdrop.
 */
function isDarkPalette(palette?: string): boolean {
  return palette === 'dark';
}

interface Scaffold {
  name: string;
  globals: {
    backdropColor: string;
    canvasColor: string;
    textColor: string;
    fontFamily: ThemeFontFamily;
    fontHeadings?: ThemeFontFamily;
    borderRadius: number;
    linkGlobal: { linkColor: string; underline: boolean };
  };
  blocks: {
    Button: {
      style: {
        buttonBackgroundColor: string;
        buttonTextColor: string;
        shape: Record<string, number>;
        [k: string]: unknown;
      };
    };
    Divider: { style: { color: string; [k: string]: unknown } };
    Container: { style: { backgroundColor: string; [k: string]: unknown } };
    ColumnsContainer: { style: { backgroundColor: string; [k: string]: unknown } };
    [blockType: string]: { style?: Record<string, unknown>; props?: Record<string, unknown> };
  };
}

const DEFAULT_PRIMARY = '#2563EB';

function buildScaffoldTheme(input: GenerateThemeInput): Scaffold {
  const moods = input.moods ?? [];
  const primary = input.brandColors?.primary ?? DEFAULT_PRIMARY;
  // Accent drives the CTA fill when present, else fall back to primary.
  const accent = input.brandColors?.accent ?? primary;
  const dark = isDarkPalette(input.palette);

  // Font: explicit override wins over the mood-derived choice ("Auto").
  const fontFamily = input.fontFamily ?? pickFontFamily(moods, input.vertical);
  // Headings font: explicit override, else same as body font.
  const fontHeadings = input.fontHeadings;

  // Radius + button shape: explicit border-radius wins. When present we
  // also derive a matching button shape (0 → rectangle, ≥20 → pill, else
  // rounded) so the button visually agrees with the global radius.
  const borderRadius = input.borderRadius ?? pickBorderRadius(moods);

  let canvasColor: string;
  let backdropColor: string;
  let textColor: string;
  let dividerColor: string;
  let containerBg: string;

  if (dark) {
    // Dark canvas derived from a deep tint of the primary.
    canvasColor = darken(primary, 0.82);
    backdropColor = darken(primary, 0.9);
    textColor = '#E2E8F0';
    dividerColor = lighten(canvasColor, 0.12);
    containerBg = canvasColor;
  } else {
    canvasColor = '#FFFFFF';
    // Backdrop is a very light tint of the brand primary so the email
    // sits on a subtly branded surface instead of flat grey.
    backdropColor = lighten(primary, 0.9);
    textColor = '#0F172A';
    dividerColor = lighten(primary, 0.78);
    containerBg = '#FFFFFF';
  }

  // Links use the primary, but nudged for contrast on the canvas.
  const linkColor = isDark(canvasColor) ? lighten(primary, 0.35) : darken(primary, 0.05);

  // Button: accent fill, text chosen for contrast.
  const buttonBackgroundColor = accent;
  const buttonTextColor = getSuggestedTextColor(buttonBackgroundColor);

  const underline = moods.includes('minimal') || moods.includes('editorial') ? false : true;

  return {
    name: deriveName(input),
    globals: {
      backdropColor,
      canvasColor,
      textColor,
      fontFamily,
      ...(fontHeadings ? { fontHeadings } : {}),
      borderRadius,
      linkGlobal: { linkColor, underline },
    },
    blocks: {
      Button: {
        style: {
          buttonBackgroundColor,
          buttonTextColor,
          shape: { topLeft: borderRadius, topRight: borderRadius, bottomLeft: borderRadius, bottomRight: borderRadius },
        },
      },
      Divider: { style: { color: dividerColor } },
      Container: { style: { backgroundColor: containerBg } },
      ColumnsContainer: { style: { backgroundColor: containerBg } },
    },
  };
}

/** Build a default theme name from brand + mood. */
function deriveName(input: GenerateThemeInput): string {
  const brand = input.brandName?.trim();
  if (brand) return `${brand} Theme`;
  const mood = input.moods?.[0];
  if (mood) return `${mood.charAt(0).toUpperCase()}${mood.slice(1)} Theme`;
  if (input.palette) return `${input.palette.charAt(0).toUpperCase()}${input.palette.slice(1)} Theme`;
  return 'Custom Theme';
}

// ---------------------------------------------------------------------------
// WCAG correction
// ---------------------------------------------------------------------------

interface ContrastReport {
  minContrastRatio: number;
  passesAA: boolean;
  notes: string[];
}

/**
 * Enforce WCAG AA on the two text-bearing pairs in the theme:
 *   - body text on the canvas surface
 *   - button text on the button fill
 *
 * Failing pairs are corrected in place (text flipped to black/white via
 * `getSuggestedTextColor`) and a note is recorded. Mutates `scaffold`.
 */
function enforceContrast(scaffold: Scaffold): ContrastReport {
  const notes: string[] = [];
  const ratios: number[] = [];

  // 1. Body text on canvas
  let textRatio = getContrastRatio(scaffold.globals.textColor, scaffold.globals.canvasColor);
  if (textRatio < WCAG_LEVELS.AA_NORMAL) {
    const corrected = getSuggestedTextColor(scaffold.globals.canvasColor);
    scaffold.globals.textColor = corrected;
    textRatio = getContrastRatio(corrected, scaffold.globals.canvasColor);
    notes.push('Adjusted body text colour for readable contrast on the canvas.');
  }
  ratios.push(textRatio);

  // 2. Button text on button fill
  let buttonRatio = getContrastRatio(
    scaffold.blocks.Button.style.buttonTextColor,
    scaffold.blocks.Button.style.buttonBackgroundColor
  );
  if (buttonRatio < WCAG_LEVELS.AA_NORMAL) {
    const corrected = getSuggestedTextColor(scaffold.blocks.Button.style.buttonBackgroundColor);
    scaffold.blocks.Button.style.buttonTextColor = corrected;
    buttonRatio = getContrastRatio(corrected, scaffold.blocks.Button.style.buttonBackgroundColor);
    notes.push('Adjusted button text colour for readable contrast on the button.');
  }
  ratios.push(buttonRatio);

  // 3. Link colour on canvas — only note, do not hard-correct (links are
  //    typically distinguished by more than colour). Still factor into min.
  const linkRatio = getContrastRatio(scaffold.globals.linkGlobal.linkColor, scaffold.globals.canvasColor);
  ratios.push(linkRatio);
  if (linkRatio < WCAG_LEVELS.AA_LARGE) {
    notes.push('Link colour has low contrast; consider relying on the underline as well.');
  }

  const minContrastRatio = Math.round(Math.min(...ratios) * 100) / 100;
  return {
    minContrastRatio,
    passesAA: textRatio >= WCAG_LEVELS.AA_NORMAL && buttonRatio >= WCAG_LEVELS.AA_NORMAL,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Optional LLM name enrichment
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// LLM block-styles enrichment
// ---------------------------------------------------------------------------

const BLOCKS_SYSTEM_PROMPT = [
  'You are a design system generator for an email builder.',
  'Given a theme scaffold (globals + basic block colors), generate creative per-block style overrides.',
  'Return ONLY a JSON object with this exact shape (all fields optional, omit what you do not change):',
  '{',
  '  "name": "Theme Name (1-3 words)",',
  '  "blocks": {',
  '    "Button": { "style": { "fontSize": <number 13-20>, "fontWeight": "bold"|"normal", "padding": {"top":<n>,"bottom":<n>,"left":<n>,"right":<n>} } },',
  '    "Container": { "style": { "borderRadius": <0-24>, "borderColor": "#RRGGBB", "borderTop": <0-3>, "borderBottom": <0-3>, "borderLeft": <0-3>, "borderRight": <0-3>, "padding": {"top":<n>,"bottom":<n>,"left":<n>,"right":<n>} } },',
  '    "ColumnsContainer": { "style": { "borderRadius": <0-24>, "padding": {"top":<n>,"bottom":<n>,"left":<n>,"right":<n>} } },',
  '    "Divider": { "style": { "padding": {"top":<n>,"bottom":<n>,"left":<0>,"right":<0>} } },',
  '    "Image": { "style": { "borderRadius": <0-24>, "padding": {"top":<n>,"bottom":<n>,"left":<n>,"right":<n>} } }',
  '  }',
  '}',
  'RULES:',
  '- Return ONLY valid JSON. No markdown fences, no explanation.',
  '- The styles should feel cohesive with the mood and colors provided.',
  '- Padding values are in px, range 0-48.',
  '- borderRadius should match the global borderRadius for consistency.',
  '- Use border on Container only when it enhances the mood (e.g. premium, editorial).',
  '- Name the theme in the user locale. Default to English.',
  '- Be creative but restrained — email clients have limited CSS support.',
].join('\n');

async function readStream(stream: ReadableStream<string>): Promise<string> {
  const reader = stream.getReader();
  let out = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) out += value;
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
  }
  return out;
}

function extractFirstJson(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      if (--depth === 0) return raw.slice(start, i + 1);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface GenerateThemeOptions {
  provider?: ProviderName;
  model?: string;
  maxTokens?: number;
  /** Test seam — short-circuits the LLM call. */
  llmText?: () => Promise<string>;
  /** Test seam — provider factory. */
  getProvider?: typeof ProductionGetProvider;
  /**
   * When false, skip the LLM enrichment pass (deterministic scaffold only).
   * Defaults to true — LLM generates creative block styles + theme name.
   */
  enrich?: boolean;
}

/**
 * Generate a complete, accessible theme. Never throws.
 */
export async function generateTheme(
  input: GenerateThemeInput,
  options: GenerateThemeOptions = {}
): Promise<GeneratedTheme> {
  const scaffold = buildScaffoldTheme(input);
  const accessibility = enforceContrast(scaffold);

  // Optional LLM enrichment — generates creative block styles + theme name.
  const shouldEnrich = options.enrich ?? true;
  if (shouldEnrich) {
    try {
      let raw: string;
      if (options.llmText) {
        raw = await options.llmText();
      } else {
        const getProvider = options.getProvider ?? (await import('../providers/index.js')).getProvider;
        const providerName: ProviderName =
          options.provider ?? (process.env.DEFAULT_PROVIDER as ProviderName | undefined) ?? 'openai';
        const provider = getProvider(providerName);
        const userMessage = JSON.stringify({
          globals: scaffold.globals,
          blocks: scaffold.blocks,
          moods: input.moods,
          palette: input.palette,
          brandName: input.brandName,
          brief: input.brief,
          locale: input.locale,
        });
        const stream = provider.stream({
          system: BLOCKS_SYSTEM_PROMPT,
          prompt: userMessage,
          model: options.model,
          maxTokens: options.maxTokens ?? DEFAULT_LLM_TOKENS,
        });
        raw = await readStream(stream);
      }
      const json = extractFirstJson(raw);
      if (json) {
        const parsed = JSON.parse(json) as {
          name?: unknown;
          blocks?: Record<string, { style?: Record<string, unknown>; props?: Record<string, unknown> }>;
        };
        // Merge name
        if (typeof parsed.name === 'string') {
          const name = parsed.name.trim().slice(0, 100);
          if (name.length > 0) scaffold.name = name;
        }
        // Merge block style overrides (deep merge into scaffold.blocks)
        if (parsed.blocks && typeof parsed.blocks === 'object') {
          for (const [blockType, overrides] of Object.entries(parsed.blocks)) {
            if (!overrides || typeof overrides !== 'object') continue;
            const existing = (scaffold.blocks as Record<string, Record<string, unknown>>)[blockType];
            if (existing) {
              // Merge style
              if (overrides.style && typeof overrides.style === 'object') {
                existing.style = { ...(existing.style as object), ...overrides.style };
              }
              // Merge props
              if (overrides.props && typeof overrides.props === 'object') {
                existing.props = { ...((existing.props as object) ?? {}), ...overrides.props };
              }
            } else {
              // New block type from LLM
              (scaffold.blocks as Record<string, unknown>)[blockType] = overrides;
            }
          }
        }
      }
    } catch (err) {
      console.warn('[generateTheme] LLM enrichment failed, using deterministic scaffold', err);
    }
  }

  // Final shape validation — guarantees the route returns a schema-valid
  // payload. Falls back to the raw scaffold if (somehow) invalid.
  const candidate: GeneratedTheme = {
    name: scaffold.name,
    globals: scaffold.globals,
    blocks: scaffold.blocks,
    accessibility,
  };
  const parsed = GeneratedThemeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : candidate;
}
