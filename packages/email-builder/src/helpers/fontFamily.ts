import { z } from 'zod';

import {
  ALL_GOOGLE_FONTS_HREF,
  buildGoogleFontsHref,
  collectDocumentFonts,
  FONT_CATALOG,
  FONT_FAMILY_NAMES,
  FONT_FAMILY_SCHEMA,
} from '@eb/document-core';

import { useRootData } from '../Reader/renderContext';

export {
  FONT_FAMILY_SCHEMA,
  FONT_FAMILY_NAMES,
  FONT_CATALOG,
  ALL_GOOGLE_FONTS_HREF,
  buildGoogleFontsHref,
  collectDocumentFonts,
};

export type FontFamilyName = z.infer<typeof FONT_FAMILY_SCHEMA>;

/**
 * CSS resolution table for font-family keys, derived 1:1 from the
 * single-source {@link FONT_CATALOG} in `@eb/document-core`. Adding a font
 * to the catalog automatically extends this list — there is no separate
 * hardcoded array to keep in sync.
 */
export const FONT_FAMILIES = FONT_CATALOG.map(({ key, label, value }) => ({ key, label, value }));

export const DEFAULT_FONT = {
  FAMILY: 'MODERN_SANS',
  SIZE: 16,
} as const;

function getValueFont(fontFamily: FontFamilyName | undefined | null): string | undefined {
  if (!fontFamily) return undefined;
  return FONT_FAMILIES.find((f) => f.key === fontFamily)?.value;
}

/**
 * Resolve a font-family key to its CSS value, store-free.
 *
 * Resolution order:
 *   1. the explicit `fontFamily` of the block,
 *   2. the document root's `fontFamily` (`rootFont`, supplied by the
 *      caller — in the editor via the Zustand snapshot, in the Reader
 *      via `RootDataProvider`),
 *   3. the package default (`MODERN_SANS`),
 *   4. `'inherit'`.
 *
 * No global store is read here, so it is safe to call from Node
 * (`react-dom/server`).
 */
export function getFontFamily(fontFamily: FontFamilyName | undefined | null, rootFont?: FontFamilyName | null): string {
  return (
    getValueFont(fontFamily) ??
    getValueFont(rootFont) ??
    getValueFont(DEFAULT_FONT.FAMILY as FontFamilyName) ??
    'inherit'
  );
}

/**
 * Hook flavour of {@link getFontFamily} that pulls the root-font
 * fallback from {@link RootDataContext} (provided by `Reader` / the
 * editor canvas). Block components should prefer this over reading any
 * store.
 */
export function useFontFamily(fontFamily: FontFamilyName | undefined | null): string {
  const root = useRootData<{ fontFamily?: FontFamilyName }>();
  return getFontFamily(fontFamily, root?.fontFamily ?? null);
}
