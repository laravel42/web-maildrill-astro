/**
 * Email-client support facts, as data.
 *
 * Compatibility rules are only as good as the matrix behind them, so the
 * claims live here in one auditable place rather than being scattered as
 * hard-coded strings across rule files. Every entry names the clients that
 * fail, what the recipient actually sees, and the workaround — a finding that
 * says "Outlook doesn't support this" without saying what breaks and what to
 * do instead is not actionable.
 *
 * Scope note: these describe *rendering engines*, not brands. "Outlook
 * (Windows)" means the Word-based engine used by Outlook 2007-2021 and
 * Microsoft 365 desktop on Windows; Outlook for Mac, Outlook on the web, and
 * the mobile apps use WebKit/Blink and are largely unaffected.
 */

/** Rendering engines referenced by the matrix. */
export const CLIENTS = {
  outlookWindows: 'Outlook 2007-2021 / M365 (Windows, Word engine)',
  outlookWeb: 'Outlook.com',
  gmailWeb: 'Gmail (web)',
  gmailApp3p: 'Gmail app with a non-Gmail account (GANGA)',
  appleMail: 'Apple Mail / iOS Mail',
  yahoo: 'Yahoo Mail',
  samsung: 'Samsung Mail',
} as const;

export type ClientId = keyof typeof CLIENTS;

export function clientNames(ids: ClientId[]): string[] {
  return ids.map((id) => CLIENTS[id]);
}

export type SupportFact = {
  /** CSS property or technique. */
  feature: string;
  /** Engines that do not honour it. */
  failsIn: ClientId[];
  /** What the recipient sees when it fails. */
  effect: string;
  /** How to author around it. */
  workaround: string;
};

/**
 * The facts rules cite. Keyed so a rule can pull one and stay in sync with
 * the wording used everywhere else.
 */
export const SUPPORT: Record<string, SupportFact> = {
  borderRadius: {
    feature: 'border-radius',
    failsIn: ['outlookWindows'],
    effect: 'Rounded corners render square.',
    workaround:
      'Accept the square fallback, or use a VML rounded-rectangle for buttons. Do not rely on the radius to carry the design.',
  },
  overflowHidden: {
    feature: 'overflow: hidden',
    failsIn: ['outlookWindows'],
    effect:
      'Backgrounds are not clipped to rounded corners, so colour bleeds past the rounded edge.',
    workaround:
      'Keep the clipped area and its background the same colour so the bleed is invisible.',
  },
  objectFit: {
    feature: 'object-fit / object-position',
    failsIn: ['outlookWindows', 'gmailWeb', 'gmailApp3p', 'yahoo'],
    effect:
      'The image is stretched to the declared box instead of being cropped, so it renders distorted.',
    workaround: 'Crop the source asset to the target aspect ratio and drop the fixed height.',
  },
  mediaQueries: {
    feature: '<style> media queries',
    failsIn: ['gmailApp3p'],
    effect:
      'The whole <style> block is stripped, so mobile overrides never apply — columns stay side by side and the canvas keeps its desktop width.',
    workaround:
      'Make the desktop layout survivable on a narrow screen: keep columns at 2, keep each column wide enough to read, and avoid depending on the stacked layout for legibility.',
  },
  webFonts: {
    feature: 'Web fonts (@font-face / Google Fonts <link>)',
    failsIn: ['outlookWindows', 'gmailWeb', 'gmailApp3p', 'outlookWeb', 'yahoo'],
    effect:
      'The font falls back to the next entry in the stack, changing text metrics and re-wrapping lines.',
    workaround:
      'Pick a family whose stack names a web-safe fallback with similar metrics, and never let a line break carry meaning.',
  },
  backgroundImage: {
    feature: 'background-image / CSS gradients',
    failsIn: ['outlookWindows'],
    effect: 'The background does not paint; any text over it falls back to the underlying colour.',
    workaround:
      'Add a VML fallback, or set a solid background-color that keeps foreground text readable on its own.',
  },
  displayInlineBlock: {
    feature: 'display: inline-block',
    failsIn: ['outlookWindows'],
    effect:
      'The element is laid out as a block, so a shrink-to-fit pill stretches to the full container width.',
    workaround:
      'Give the element an explicit width, or centre it with an align attribute on a wrapping table.',
  },
  maxWidth: {
    feature: 'max-width',
    failsIn: ['outlookWindows'],
    effect: 'The element expands to its container instead of being capped.',
    workaround: 'Pair every max-width with an explicit width attribute on the element.',
  },
  imagesOffByDefault: {
    feature: 'Automatic image loading',
    failsIn: ['outlookWindows', 'gmailWeb', 'yahoo'],
    effect:
      'Images are blocked until the recipient opts in; only alt text and background colours are visible.',
    workaround:
      'Give every image meaningful alt text and never let an image be the only carrier of a message or CTA.',
  },
};

/* ------------------------------------------------------------------ */
/* font risk                                                           */
/* ------------------------------------------------------------------ */

export type FontRisk = 'none' | 'low' | 'medium' | 'high';

export type FontFact = {
  key: string;
  label: string;
  /** False for system stacks that need no download and therefore never swap. */
  webFont: boolean;
  /** Named web-safe fallback in the stack, if any. */
  fallback: string | null;
  category: 'system' | 'sans' | 'serif' | 'mono' | 'display';
  /** How far the rendering drifts in clients that ignore the web font. */
  risk: FontRisk;
};

/**
 * Font facts, inlined from the editor's `@eb/document-core` FONT_CATALOG so
 * this backend keeps no workspace dependency on the editor packages. Keep in
 * sync with that catalog.
 *
 * `risk` grades the *fallback*, not the font. A web font whose stack names
 * Arial or Georgia degrades predictably; one that falls back to a bare
 * `sans-serif` or `cursive` generic can re-wrap every line, and a condensed
 * display face like Oswald falling back to Arial changes line counts
 * dramatically because the substitute is far wider.
 */
export const FONT_FACTS: Record<string, FontFact> = {
  INHERIT: {
    key: 'INHERIT',
    label: 'Inherit',
    webFont: false,
    fallback: null,
    category: 'system',
    risk: 'none',
  },
  MODERN_SANS: {
    key: 'MODERN_SANS',
    label: 'Modern sans',
    webFont: false,
    fallback: 'Arial',
    category: 'system',
    risk: 'none',
  },
  WIDE_SANS: {
    key: 'WIDE_SANS',
    label: 'Wide sans',
    webFont: false,
    fallback: 'Verdana',
    category: 'system',
    risk: 'none',
  },
  COMPACT_SANS: {
    key: 'COMPACT_SANS',
    label: 'Compact sans',
    webFont: false,
    fallback: 'Tahoma',
    category: 'system',
    risk: 'none',
  },
  CLASSIC_SERIF: {
    key: 'CLASSIC_SERIF',
    label: 'Classic serif',
    webFont: false,
    fallback: 'Georgia',
    category: 'system',
    risk: 'none',
  },

  ROBOTO: {
    key: 'ROBOTO',
    label: 'Roboto',
    webFont: true,
    fallback: null,
    category: 'sans',
    risk: 'medium',
  },
  OPEN_SANS: {
    key: 'OPEN_SANS',
    label: 'Open Sans',
    webFont: true,
    fallback: null,
    category: 'sans',
    risk: 'medium',
  },
  LATO: {
    key: 'LATO',
    label: 'Lato',
    webFont: true,
    fallback: null,
    category: 'sans',
    risk: 'medium',
  },
  MONTSERRAT: {
    key: 'MONTSERRAT',
    label: 'Montserrat',
    webFont: true,
    fallback: null,
    category: 'sans',
    risk: 'medium',
  },
  POPPINS: {
    key: 'POPPINS',
    label: 'Poppins',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  INTER: {
    key: 'INTER',
    label: 'Inter',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  NUNITO: {
    key: 'NUNITO',
    label: 'Nunito',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  RALEWAY: {
    key: 'RALEWAY',
    label: 'Raleway',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  WORK_SANS: {
    key: 'WORK_SANS',
    label: 'Work Sans',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  SOURCE_SANS: {
    key: 'SOURCE_SANS',
    label: 'Source Sans 3',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  MULISH: {
    key: 'MULISH',
    label: 'Mulish',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  RUBIK: {
    key: 'RUBIK',
    label: 'Rubik',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  KARLA: {
    key: 'KARLA',
    label: 'Karla',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  DM_SANS: {
    key: 'DM_SANS',
    label: 'DM Sans',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  FIGTREE: {
    key: 'FIGTREE',
    label: 'Figtree',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  PT_SANS: {
    key: 'PT_SANS',
    label: 'PT Sans',
    webFont: true,
    fallback: 'Arial',
    category: 'sans',
    risk: 'low',
  },
  OSWALD: {
    key: 'OSWALD',
    label: 'Oswald',
    webFont: true,
    fallback: null,
    category: 'display',
    risk: 'high',
  },

  MERRIWEATHER: {
    key: 'MERRIWEATHER',
    label: 'Merriweather',
    webFont: true,
    fallback: null,
    category: 'serif',
    risk: 'medium',
  },
  PLAYFAIR: {
    key: 'PLAYFAIR',
    label: 'Playfair',
    webFont: true,
    fallback: null,
    category: 'serif',
    risk: 'medium',
  },
  LORA: {
    key: 'LORA',
    label: 'Lora',
    webFont: true,
    fallback: 'Georgia',
    category: 'serif',
    risk: 'low',
  },
  PT_SERIF: {
    key: 'PT_SERIF',
    label: 'PT Serif',
    webFont: true,
    fallback: 'Georgia',
    category: 'serif',
    risk: 'low',
  },
  SOURCE_SERIF: {
    key: 'SOURCE_SERIF',
    label: 'Source Serif 4',
    webFont: true,
    fallback: 'Georgia',
    category: 'serif',
    risk: 'low',
  },
  ROBOTO_SLAB: {
    key: 'ROBOTO_SLAB',
    label: 'Roboto Slab',
    webFont: true,
    fallback: 'Georgia',
    category: 'serif',
    risk: 'low',
  },
  BITTER: {
    key: 'BITTER',
    label: 'Bitter',
    webFont: true,
    fallback: 'Georgia',
    category: 'serif',
    risk: 'low',
  },
  CRIMSON: {
    key: 'CRIMSON',
    label: 'Crimson Text',
    webFont: true,
    fallback: 'Georgia',
    category: 'serif',
    risk: 'low',
  },

  ROBOTO_MONO: {
    key: 'ROBOTO_MONO',
    label: 'Roboto Mono',
    webFont: true,
    fallback: 'Courier New',
    category: 'mono',
    risk: 'low',
  },
  JETBRAINS_MONO: {
    key: 'JETBRAINS_MONO',
    label: 'JetBrains Mono',
    webFont: true,
    fallback: 'Courier New',
    category: 'mono',
    risk: 'low',
  },

  PACIFICO: {
    key: 'PACIFICO',
    label: 'Pacifico',
    webFont: true,
    fallback: null,
    category: 'display',
    risk: 'high',
  },
  DANCING_SCRIPT: {
    key: 'DANCING_SCRIPT',
    label: 'Dancing Script',
    webFont: true,
    fallback: null,
    category: 'display',
    risk: 'high',
  },
  CAVEAT: {
    key: 'CAVEAT',
    label: 'Caveat',
    webFont: true,
    fallback: null,
    category: 'display',
    risk: 'high',
  },
};

/** Every valid font-family key, in catalog order. */
export const FONT_FAMILY_KEYS: string[] = Object.keys(FONT_FACTS);

export function fontFact(key: string | null | undefined): FontFact | null {
  if (!key) return null;
  return FONT_FACTS[key] ?? null;
}

/* ------------------------------------------------------------------ */
/* thresholds                                                          */
/* ------------------------------------------------------------------ */

/**
 * Numeric limits the rules test against, gathered so they can be reviewed as
 * a set and tuned without hunting through rule bodies.
 */
export const THRESHOLDS = {
  /** Apple's HIG and WCAG 2.5.5 both land near 44px for a touch target. */
  minTapTargetPx: 44,
  /** Below this, body copy is unreadable on a phone without zooming. */
  minBodyFontSizePx: 14,
  /** iOS auto-zooms text under this in some clients. */
  comfortableBodyFontSizePx: 16,
  /** A column narrower than this cannot hold a readable line of text. */
  minColumnWidthPx: 120,
  /** Beyond ~75 characters a line becomes hard to track back from. */
  maxLineLengthChars: 75,
  /** Under ~40 characters a line fragments the reading rhythm. */
  minLineLengthChars: 40,
  /** Gmail clips the message and shows "View entire message" past this. */
  gmailClipBytes: 102_400,
  /** Image-heavy mail correlates with spam filtering. */
  maxImageAreaRatio: 0.6,
  /** A template thinner than this reads as unfinished. */
  minBlockCount: 6,
  /** Past this the email is a landing page, not an email. */
  maxBlockCount: 60,
  /** More than a handful of competing calls to action splits intent. */
  maxPrimaryCtas: 3,
  /** Distinct colours before a palette stops reading as deliberate. */
  maxPaletteSize: 8,
  /** Distinct type sizes before the scale stops reading as a system. */
  maxFontSizes: 7,
  /** Distinct families before typography reads as inconsistent. */
  maxFontFamilies: 3,
  /** Nesting past this is usually accidental rather than structural. */
  maxNestingDepth: 8,
} as const;
