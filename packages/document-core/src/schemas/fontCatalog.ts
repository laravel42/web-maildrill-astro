/**
 * Single source of truth for the editor's font catalog.
 *
 * Every font the builder supports is declared exactly once here, with:
 *   - `key`    — the stable enum value persisted in documents
 *                (`EmailLayout.data.fontFamily`, `*.style.fontFamily`, theme
 *                overrides). Drives {@link FONT_FAMILY_NAMES} /
 *                {@link FONT_FAMILY_SCHEMA}.
 *   - `label`  — the human-readable name shown in the inspector dropdown.
 *   - `value`  — the CSS `font-family` stack, ALWAYS ending in a web-safe
 *                fallback so clients that don't load web fonts (Gmail,
 *                Outlook Desktop Windows) still render a sensible face.
 *   - `google` — the Google Fonts `css2` `family=` spec (everything after
 *                `family=`), or `null` for system stacks (`MODERN_SANS`) and
 *                `INHERIT`, which require no download.
 *
 * Web fonts are progressive enhancement: only Apple Mail, Outlook for Mac
 * and the mobile apps actually load them; the rest fall back to the stack.
 *
 * Adding a font is a ONE-LINE change here — the enum, the CSS resolver
 * (`FONT_FAMILIES` in `@eb/email-builder`), the editor canvas `<link>`, the
 * hover-preview `<link>`, and the export's dynamic `<link>` all derive from
 * this list. No URL needs to be edited by hand anywhere.
 *
 * This module is Node-safe (no React, no DOM, no zod) so it can run inside
 * the server-side HTML renderer and the MCP.
 */

export type FontCatalogEntry = {
  /** Stable enum value persisted in documents. */
  key: string;
  /** Human-readable label for the inspector dropdown. */
  label: string;
  /** CSS `font-family` stack, web-safe fallback last. */
  value: string;
  /**
   * Google Fonts `css2` `family=` spec (the part after `family=`, e.g.
   * `Roboto:wght@400;700`). `null` for system / inherited stacks that
   * need no network download.
   */
  google: string | null;
};

/**
 * The catalog. Order here is the order shown in the inspector dropdown:
 * inherited / system first, then sans-serif, serif, monospace, and
 * display / handwriting faces.
 */
export const FONT_CATALOG = [
  // --- System / inherited (no download) -----------------------------------
  { key: 'INHERIT', label: 'Inherit', value: 'inherit', google: null },
  {
    key: 'MODERN_SANS',
    label: 'Modern sans',
    value: '"Helvetica Neue", "Arial Nova", "Nimbus Sans", Arial, sans-serif',
    google: null,
  },
  {
    key: 'WIDE_SANS',
    label: 'Wide sans',
    value: 'Verdana, Geneva, Tahoma, sans-serif',
    google: null,
  },
  {
    key: 'COMPACT_SANS',
    label: 'Compact sans',
    value: 'Tahoma, Verdana, Geneva, sans-serif',
    google: null,
  },
  {
    key: 'CLASSIC_SERIF',
    label: 'Classic serif',
    value: 'Georgia, "Times New Roman", Times, serif',
    google: null,
  },

  // --- Sans-serif ---------------------------------------------------------
  {
    key: 'ROBOTO',
    label: 'Roboto',
    value: '"Roboto", sans-serif',
    google: 'Roboto:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'OPEN_SANS',
    label: 'Open Sans',
    value: '"Open Sans", sans-serif',
    google: 'Open+Sans:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'LATO',
    label: 'Lato',
    value: '"Lato", sans-serif',
    google: 'Lato:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'MONTSERRAT',
    label: 'Montserrat',
    value: '"Montserrat", sans-serif',
    google: 'Montserrat:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'POPPINS',
    label: 'Poppins',
    value: '"Poppins", Arial, sans-serif',
    google: 'Poppins:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'INTER',
    label: 'Inter',
    value: '"Inter", Arial, sans-serif',
    google: 'Inter:wght@400;700',
  },
  {
    key: 'NUNITO',
    label: 'Nunito',
    value: '"Nunito", Arial, sans-serif',
    google: 'Nunito:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'RALEWAY',
    label: 'Raleway',
    value: '"Raleway", Arial, sans-serif',
    google: 'Raleway:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'WORK_SANS',
    label: 'Work Sans',
    value: '"Work Sans", Arial, sans-serif',
    google: 'Work+Sans:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'SOURCE_SANS',
    label: 'Source Sans 3',
    value: '"Source Sans 3", Arial, sans-serif',
    google: 'Source+Sans+3:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'MULISH',
    label: 'Mulish',
    value: '"Mulish", Arial, sans-serif',
    google: 'Mulish:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'RUBIK',
    label: 'Rubik',
    value: '"Rubik", Arial, sans-serif',
    google: 'Rubik:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'KARLA',
    label: 'Karla',
    value: '"Karla", Arial, sans-serif',
    google: 'Karla:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'DM_SANS',
    label: 'DM Sans',
    value: '"DM Sans", Arial, sans-serif',
    google: 'DM+Sans:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'FIGTREE',
    label: 'Figtree',
    value: '"Figtree", Arial, sans-serif',
    google: 'Figtree:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'PT_SANS',
    label: 'PT Sans',
    value: '"PT Sans", Arial, sans-serif',
    google: 'PT+Sans:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'OSWALD',
    label: 'Oswald',
    value: '"Oswald", sans-serif',
    google: 'Oswald:wght@400;700',
  },

  // --- Serif --------------------------------------------------------------
  {
    key: 'MERRIWEATHER',
    label: 'Merriweather',
    value: '"Merriweather", serif',
    google: 'Merriweather:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'PLAYFAIR',
    label: 'Playfair',
    value: '"Playfair", serif',
    google: 'Playfair:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'LORA',
    label: 'Lora',
    value: '"Lora", Georgia, serif',
    google: 'Lora:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'PT_SERIF',
    label: 'PT Serif',
    value: '"PT Serif", Georgia, serif',
    google: 'PT+Serif:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'SOURCE_SERIF',
    label: 'Source Serif 4',
    value: '"Source Serif 4", Georgia, serif',
    google: 'Source+Serif+4:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'ROBOTO_SLAB',
    label: 'Roboto Slab',
    value: '"Roboto Slab", Georgia, serif',
    google: 'Roboto+Slab:wght@400;700',
  },
  {
    key: 'BITTER',
    label: 'Bitter',
    value: '"Bitter", Georgia, serif',
    google: 'Bitter:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'CRIMSON',
    label: 'Crimson Text',
    value: '"Crimson Text", Georgia, serif',
    google: 'Crimson+Text:ital,wght@0,400;0,700;1,400;1,700',
  },

  // --- Monospace ----------------------------------------------------------
  {
    key: 'ROBOTO_MONO',
    label: 'Roboto Mono',
    value: '"Roboto Mono", "Courier New", monospace',
    google: 'Roboto+Mono:ital,wght@0,400;0,700;1,400;1,700',
  },
  {
    key: 'JETBRAINS_MONO',
    label: 'JetBrains Mono',
    value: '"JetBrains Mono", "Courier New", monospace',
    google: 'JetBrains+Mono:ital,wght@0,400;0,700;1,400;1,700',
  },

  // --- Display / handwriting ---------------------------------------------
  {
    key: 'PACIFICO',
    label: 'Pacifico',
    value: '"Pacifico", cursive',
    google: 'Pacifico',
  },
  {
    key: 'DANCING_SCRIPT',
    label: 'Dancing Script',
    value: '"Dancing Script", cursive',
    google: 'Dancing+Script:wght@400;700',
  },
  {
    key: 'CAVEAT',
    label: 'Caveat',
    value: '"Caveat", cursive',
    google: 'Caveat:wght@400;700',
  },
] as const satisfies readonly FontCatalogEntry[];

/** Union of every valid font-family key. */
export type FontFamilyKey = (typeof FONT_CATALOG)[number]['key'];

/** Keys that map to a downloadable Google font (everything except system/inherit). */
const GOOGLE_FONT_KEYS = new Set<string>(FONT_CATALOG.filter((e) => e.google).map((e) => e.key));

/**
 * Map of legacy Quill `ql-font-<token>` class tokens to catalog keys.
 * NotionText bodies authored before the Tiptap migration embed these
 * classes inline; {@link collectDocumentFonts} scans for them so the
 * export still subsets the right web fonts.
 */
const QL_FONT_TOKEN_TO_KEY: Record<string, string> = {
  lato: 'LATO',
  merriweather: 'MERRIWEATHER',
  montserrat: 'MONTSERRAT',
  'open-sans': 'OPEN_SANS',
  oswald: 'OSWALD',
  pacifico: 'PACIFICO',
  playfair: 'PLAYFAIR',
  roboto: 'ROBOTO',
  'roboto-mono': 'ROBOTO_MONO',
  'roboto-slab': 'ROBOTO_SLAB',
};

/**
 * Build a Google Fonts `css2` stylesheet URL for the given font keys.
 *
 * - System / inherited keys (`MODERN_SANS`, `INHERIT`) and unknown keys are
 *   ignored.
 * - Families are emitted in catalog order (deterministic — stable across
 *   document mutations, friendly to HTTP caching and tests).
 * - Returns `null` when no key resolves to a downloadable font, so callers
 *   can omit the `<link>` entirely.
 */
export function buildGoogleFontsHref(keys: Iterable<string>): string | null {
  const requested = new Set<string>(keys);
  const specs = FONT_CATALOG.filter((e) => e.google && requested.has(e.key)).map((e) => e.google as string);
  if (specs.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${specs.map((s) => `family=${s}`).join('&')}&display=swap`;
}

/**
 * The `<link>` URL that loads EVERY downloadable font in the catalog.
 * Used by the editor canvas / previews, where the user can switch to any
 * font at any time, so all faces must be available eagerly.
 */
export const ALL_GOOGLE_FONTS_HREF: string = buildGoogleFontsHref(FONT_CATALOG.map((e) => e.key)) ?? '';

function collectQlFontTokens(html: string, acc: Set<string>): void {
  const re = /ql-font-([a-z0-9-]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const key = QL_FONT_TOKEN_TO_KEY[match[1]];
    if (key && GOOGLE_FONT_KEYS.has(key)) acc.add(key);
  }
}

function collectFromValue(value: unknown, acc: Set<string>): void {
  if (value == null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) collectFromValue(item, acc);
    return;
  }
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if ((key === 'fontFamily' || key === 'fontHeadings') && typeof val === 'string') {
      if (GOOGLE_FONT_KEYS.has(val)) acc.add(val);
    } else if (key === 'html' && typeof val === 'string') {
      collectQlFontTokens(val, acc);
    } else {
      collectFromValue(val, acc);
    }
  }
}

/**
 * Walk an email document and return the catalog keys of every downloadable
 * font it actually references — across block `style.fontFamily`, the root
 * `EmailLayout.data.fontFamily`, theme overrides
 * (`theme.blocks[type].style.fontFamily`, `theme.globals.fontHeadings`),
 * and legacy `ql-font-*` classes embedded in NotionText HTML.
 *
 * The result is returned in catalog order and feeds
 * {@link buildGoogleFontsHref} so the HTML export only loads the fonts the
 * email needs (no wasted bytes for the other ~28 faces).
 *
 * Node-safe: walks the plain document object, no DOM required.
 */
export function collectDocumentFonts(document: unknown): string[] {
  const acc = new Set<string>();
  if (document && typeof document === 'object') {
    for (const block of Object.values(document as Record<string, unknown>)) {
      collectFromValue(block, acc);
    }
  }
  return FONT_CATALOG.filter((e) => acc.has(e.key)).map((e) => e.key);
}
