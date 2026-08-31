/**
 * Catálogo de iconos Lucide para el SERVIDOR (Node).
 *
 * Estrategia "lazy": `ensure(names)` hace `await import("lucide/dist/esm/icons/<slug>.mjs")`
 * por icono, cargando solo los usados en el sitio. El barrel `lucide` NO se importa
 * — queda como dependencia de runtime no bundleada (docs/34 §2.2/§3.1).
 *
 * Precalentamiento: `exportSite` llama `await lucideCatalogNode.ensure(usedIconNames(site))`
 * antes de renderizar las páginas (docs/34 §2.4).
 */
import { LUCIDE_ICON_NAMES } from "./generated/lucide.names";
import type { GlyphCatalog } from "./types";
import type { LucideGlyph } from "./lucide.catalog";

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

/** Convierte el nombre PascalCase a kebab-case para el path del módulo. */
function pascalToKebab(pascal: string): string {
  return pascal
    .replace(/([A-Z])/g, (_match, letter, offset) =>
      offset === 0 ? letter.toLowerCase() : `-${letter.toLowerCase()}`,
    );
}

const _cache = new Map<string, LucideGlyph>();
const _lower = new Map<string, string>(); // lowercase → PascalCase

// Índice lowercase → PascalCase para resolución case-insensitive (no carga datos)
for (const name of LUCIDE_ICON_NAMES) {
  _lower.set(name.toLowerCase(), name);
}

/**
 * Implementación lazy del catálogo de Lucide para el servidor (Node).
 * `ensure()` carga los glifos pedidos vía import profundo.
 */
export const lucideCatalogNode: GlyphCatalog<LucideGlyph> = {
  names: () => LUCIDE_ICON_NAMES,

  get(name: string): LucideGlyph | undefined {
    if (_cache.has(name)) return _cache.get(name);
    const pascal = _lower.get(name.toLowerCase());
    if (pascal) return _cache.get(pascal);
    return undefined;
  },

  async ensure(names: readonly string[]): Promise<void> {
    const pending: Promise<void>[] = [];

    for (const name of names) {
      const pascal = _cache.has(name)
        ? name
        : _lower.get(name.toLowerCase());

      if (!pascal) continue; // nombre desconocido, no hay módulo que cargar
      if (_cache.has(pascal)) continue; // ya en caché

      const kebab = pascalToKebab(pascal);
      pending.push(
        // Lucide expone dist/esm/icons/<kebab>.mjs — importar directamente
        // sin pasar por el barrel (docs/34 §1.1/§2.2)
        import(`lucide/dist/esm/icons/${kebab}.mjs`)
          .then((mod: Record<string, unknown>) => {
            // El módulo exporta el array de nodos bajo el nombre PascalCase
            const glyph = mod[pascal] as unknown;
            if (isLucideGlyph(glyph)) {
              _cache.set(pascal, glyph);
            }
          })
          .catch(() => {
            // Módulo no encontrado: el icono no está en la versión instalada.
            // Se ignorará en el render (usa el fallback de Star).
          }),
      );
    }

    await Promise.all(pending);
  },
};
