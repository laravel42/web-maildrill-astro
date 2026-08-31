/**
 * Catálogo de iconos Lucide para el EDITOR (browser, Vite).
 *
 * Estrategia "eager": precarga TODO el catálogo al importar. El barrel de Lucide
 * ya está en el bundle inicial de Vite, así que este módulo no añade peso extra
 * al editor — el costo de tree-shaking ya lo pagó el bundler. La ventaja:
 * `get()` siempre devuelve el glifo sin necesidad de `ensure()` previo.
 *
 * El barrel `import * as lucideIcons from "lucide"` solo aparece en ESTE módulo,
 * que vive en `catalogs/` (no importado por el servidor). El servidor usa
 * `lucideCatalog.node.ts` con imports profundos (docs/34 §2.2).
 *
 * Los NOMBRES siguen llegando de `catalogs/generated/lucide.names.ts` (codegen)
 * para que el picker no dependa de este módulo y sea consistente con el servidor.
 */
import * as lucideIcons from "lucide";
import type { GlyphCatalog } from "./types";
import { LUCIDE_ICON_NAMES } from "./generated/lucide.names";

// Los datos de Lucide son arrays de [tagName, attrs][]
export type LucideIconNode = [string, Record<string, string | number>];
export type LucideGlyph = LucideIconNode[];

function isLucideGlyph(value: unknown): value is LucideGlyph {
  if (!Array.isArray(value) || value.length === 0) return false;
  return value.every(
    (item) =>
      Array.isArray(item) &&
      item.length === 2 &&
      typeof item[0] === "string" &&
      typeof item[1] === "object" &&
      item[1] !== null,
  );
}

// Carga eager del catálogo completo al importar el módulo
const _cache = new Map<string, LucideGlyph>();
const _lower = new Map<string, string>(); // lowercase → PascalCase

for (const [key, value] of Object.entries(lucideIcons)) {
  if (isLucideGlyph(value)) {
    _cache.set(key, value);
    _lower.set(key.toLowerCase(), key);
  }
}

/**
 * Implementación eager del catálogo de Lucide para el editor (browser/Vite).
 * `ensure()` es una no-op (los datos ya están en caché al importar).
 */
export const lucideCatalog: GlyphCatalog<LucideGlyph> = {
  names: () => LUCIDE_ICON_NAMES,

  get(name: string): LucideGlyph | undefined {
    if (_cache.has(name)) return _cache.get(name);
    // Intento case-insensitive
    const pascal = _lower.get(name.toLowerCase());
    if (pascal) return _cache.get(pascal);
    return undefined;
  },

  async ensure(_names: readonly string[]): Promise<void> {
    // No-op: el catálogo completo ya está cargado.
  },
};
