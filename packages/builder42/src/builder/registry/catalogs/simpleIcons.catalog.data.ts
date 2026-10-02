/**
 * Datos crudos de simple-icons para el EDITOR (browser, Vite) — módulo LAZY.
 *
 * Único trabajo de este módulo: el barrel `import * as simpleIcons from
 * "simple-icons"` + la enumeración con `Object.values()` que puebla el mapa
 * `slug -> { path, hex }`. Vive separado de `simpleIcons.catalog.ts` para que
 * NADIE lo importe de forma estática — si algo lo importa arriba, Vite lo
 * fusiona de vuelta en el chunk principal del editor y este archivo deja de
 * existir como chunk propio (docs/34 §F11a).
 *
 * `simpleIcons.catalog.ts` es el ÚNICO importador, y lo hace con
 * `await import("./simpleIcons.catalog.data")` dentro de `ensure()`.
 */
import type { SimpleIconsGlyph } from "./simpleIcons.catalog";

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

/** Carga el barrel y devuelve el mapa `slug -> glifo` completo (3450 marcas). */
export async function loadSimpleIconsData(): Promise<Map<string, SimpleIconsGlyph>> {
  const simpleIconsBarrel = await import("simple-icons");
  const map = new Map<string, SimpleIconsGlyph>();
  for (const value of Object.values(simpleIconsBarrel)) {
    if (isRawSimpleIcon(value)) {
      map.set(value.slug, { path: value.path, hex: value.hex });
    }
  }
  return map;
}
