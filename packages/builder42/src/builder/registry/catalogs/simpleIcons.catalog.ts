/**
 * Catálogo de simple-icons para el EDITOR (browser, Vite).
 *
 * Estrategia "eager": precarga todo el catálogo al importar usando el barrel
 * `import * as simpleIcons from "simple-icons"`. Este módulo SOLO se importa
 * en el grafo del editor — el servidor usa `simpleIcons.catalog.node.ts` que
 * no usa el barrel (docs/34 §1.1/§2.2).
 *
 * El barrel aquí es aceptable porque el editor ya necesita los datos SVG para
 * renderizar los iconos en el canvas: el peso ya se pagaba con el import directo
 * en `SocialLinks.tsx`. Al moverlo a este catálogo centralizado, el barrel
 * queda en un solo lugar (no disperso en múltiples componentes).
 *
 * El glifo de simple-icons es el SVG `path` string con `fill="currentColor"`.
 */
import * as simpleIconsBarrel from "simple-icons";
import type { GlyphCatalog } from "./types";
import { SIMPLE_ICON_ENTRIES } from "./generated/simpleIcons.names";

/** Glifo de simple-icons: el atributo `d` del `<path>` SVG y el color hex oficial. */
export interface SimpleIconsGlyph {
  /** Atributo `d` del `<path>` SVG. Se renderiza con `fill="currentColor"`. */
  path: string;
  /** Color hex oficial de la marca (sin el `#`). Para tints opcionales. */
  hex: string;
}

interface RawSimpleIcon {
  title: string;
  slug: string;
  hex: string;
  path: string;
}

function isRawSimpleIcon(value: unknown): value is RawSimpleIcon {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.slug === "string" &&
    typeof v.path === "string" &&
    typeof v.hex === "string" &&
    typeof v.title === "string"
  );
}

// Carga eager desde el barrel (solo en el editor)
const _cache = new Map<string, SimpleIconsGlyph>();
for (const value of Object.values(simpleIconsBarrel)) {
  if (isRawSimpleIcon(value)) {
    _cache.set(value.slug, { path: value.path, hex: value.hex });
  }
}

/**
 * Implementación eager del catálogo de simple-icons para el editor.
 * `ensure()` es una no-op (los datos ya están en caché al importar).
 */
export const simpleIconsCatalog: GlyphCatalog<SimpleIconsGlyph> = {
  names: () => SIMPLE_ICON_ENTRIES.map((e) => e.slug),

  get(name: string): SimpleIconsGlyph | undefined {
    return _cache.get(name.toLowerCase());
  },

  async ensure(_names: readonly string[]): Promise<void> {
    // No-op: el catálogo completo ya está cargado.
  },
};
