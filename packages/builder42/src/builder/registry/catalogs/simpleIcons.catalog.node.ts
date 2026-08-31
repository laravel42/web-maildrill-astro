/**
 * Catálogo de simple-icons para el SERVIDOR (Node).
 *
 * Estrategia "lazy": `ensure(names)` lee los archivos `.svg` del directorio
 * `simple-icons/icons/<slug>.svg` con `readFileSync`. El barrel de simple-icons
 * NO se importa (docs/34 §2.2/§3.1).
 *
 * Los archivos SVG de simple-icons tienen el formato:
 *   <svg ...><title>...</title><path d="..."/></svg>
 *
 * El `path` SVG se extrae con un regex simple (los SVG de simple-icons son
 * siempre un único `<path>` — es su contrato de diseño).
 *
 * Precalentamiento: `exportSite` llama
 *   `await simpleIconsCatalogNode.ensure(usedSocialIconSlugs(site))`
 * antes de renderizar (docs/34 §2.4).
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { GlyphCatalog } from "./types";
import type { SimpleIconsGlyph } from "./simpleIcons.catalog";
import { SIMPLE_ICON_ENTRIES } from "./generated/simpleIcons.names";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Directorio de SVGs de simple-icons: node_modules/simple-icons/icons/<slug>.svg
// En el bundle CJS del servidor, esbuild transforma import.meta.url a __filename.
const SI_ICONS_DIR = resolve(__dirname, "../../../../node_modules/simple-icons/icons");

const _cache = new Map<string, SimpleIconsGlyph>();
const _lower = new Map<string, string>(); // slug.toLowerCase() → canonical slug

for (const entry of SIMPLE_ICON_ENTRIES) {
  _lower.set(entry.slug.toLowerCase(), entry.slug);
}

/** Extrae el atributo `d` del único `<path>` de un SVG de simple-icons. */
function extractPath(svg: string): string | undefined {
  const match = /d="([^"]+)"/.exec(svg);
  return match?.[1];
}

/**
 * Implementación lazy del catálogo de simple-icons para el servidor (Node).
 * `ensure()` lee los SVG del disco para los nombres pedidos.
 */
export const simpleIconsCatalogNode: GlyphCatalog<SimpleIconsGlyph> = {
  names: () => SIMPLE_ICON_ENTRIES.map((e) => e.slug),

  get(name: string): SimpleIconsGlyph | undefined {
    if (_cache.has(name)) return _cache.get(name);
    const canonical = _lower.get(name.toLowerCase());
    if (canonical) return _cache.get(canonical);
    return undefined;
  },

  async ensure(names: readonly string[]): Promise<void> {
    for (const name of names) {
      const slug = _lower.get(name.toLowerCase()) ?? name.toLowerCase();
      if (_cache.has(slug)) continue;

      const svgPath = resolve(SI_ICONS_DIR, `${slug}.svg`);
      if (!existsSync(svgPath)) continue;

      try {
        const svg = readFileSync(svgPath, "utf-8");
        const path = extractPath(svg);
        if (path) {
          // El hex no está disponible sin leer el JSON de datos; usamos un
          // placeholder — el hex se usa solo para tints opcionales, no para el
          // render principal (que usa `fill="currentColor"`).
          _cache.set(slug, { path, hex: "000000" });
        }
      } catch {
        // Si el archivo no se puede leer, el glifo queda como undefined.
        // El render usará el icono genérico como fallback.
      }
    }
  },
};
