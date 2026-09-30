/**
 * Catálogo de simple-icons para el EDITOR (browser, Vite).
 *
 * Estrategia "lazy" (docs/34 §F11a): el barrel `import * as simpleIcons from
 * "simple-icons"` + su enumeración con `Object.values()` viven en
 * `simpleIcons.catalog.data.ts`, un módulo separado que SOLO se importa con
 * `await import()` desde `ensure()` — nunca de forma estática. Esa marca de
 * 3450 iconos es un único string literal de ~5 MB (78% del chunk comprimido
 * del editor); moverla a su propio chunk evita que la pague quien nunca abre
 * el picker de redes sociales ni exporta un sitio con `social-links`.
 *
 * `ensure()` dispara UNA carga global (el barrel trae las 3450 marcas de una
 * vez, no hay forma de pedir un subconjunto) y es idempotente: llamadas
 * concurrentes comparten la misma promesa en vuelo. `subscribe()`/
 * `getVersion()` son el enganche para que un componente React (el que decide
 * disparar `ensure()`, fuera de este módulo — ver `catalogs/types.ts`) se
 * vuelva a renderizar cuando el catálogo llega. Antes de que llegue, `get()`
 * devuelve `undefined` y el `render()` de cada consumidor cae al icono
 * genérico ya existente (sin esto no habría regresión visible: es el mismo
 * fallback que hoy renderiza cualquier marca no reconocida).
 *
 * El glifo de simple-icons es el SVG `path` string con `fill="currentColor"`.
 */
import type { GlyphCatalog } from "./types";
import { SIMPLE_ICON_ENTRIES } from "./generated/simpleIcons.names";

/** Glifo de simple-icons: el atributo `d` del `<path>` SVG y el color hex oficial. */
export interface SimpleIconsGlyph {
  /** Atributo `d` del `<path>` SVG. Se renderiza con `fill="currentColor"`. */
  path: string;
  /** Color hex oficial de la marca (sin el `#`). Para tints opcionales. */
  hex: string;
}

const _cache = new Map<string, SimpleIconsGlyph>();

// Estado de la carga lazy: idempotente, sin cargas concurrentes duplicadas.
let _loadPromise: Promise<void> | null = null;
let _version = 0;
const _listeners = new Set<() => void>();

function notifyListeners(): void {
  _version += 1;
  for (const listener of _listeners) listener();
}

/**
 * Versión del catálogo: cambia una única vez, cuando el barrel termina de
 * cargar y `_cache` se puebla. Pensado para `useSyncExternalStore` (el valor
 * en sí no importa, solo que cambie para forzar el re-render).
 */
export function getSimpleIconsVersion(): number {
  return _version;
}

/** Suscribe un listener a la llegada del catálogo. Devuelve la función de baja. */
export function subscribeSimpleIcons(listener: () => void): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/** `true` si el barrel ya terminó de cargar y `_cache` está poblada. */
export function isSimpleIconsLoaded(): boolean {
  return _cache.size > 0;
}

/**
 * Implementación lazy del catálogo de simple-icons para el editor (browser).
 * `ensure()` importa dinámicamente `simpleIcons.catalog.data.ts` (el barrel)
 * la primera vez que se llama; llamadas siguientes (con los mismos u otros
 * nombres — el barrel no permite pedir un subconjunto) reutilizan la carga
 * en curso o ya resuelta.
 */
export const simpleIconsCatalog: GlyphCatalog<SimpleIconsGlyph> = {
  names: () => SIMPLE_ICON_ENTRIES.map((e) => e.slug),

  get(name: string): SimpleIconsGlyph | undefined {
    return _cache.get(name.toLowerCase());
  },

  async ensure(_names: readonly string[]): Promise<void> {
    if (_cache.size > 0) return;
    if (!_loadPromise) {
      _loadPromise = import("./simpleIcons.catalog.data").then(({ loadSimpleIconsData }) =>
        loadSimpleIconsData(),
      ).then((map) => {
        for (const [slug, glyph] of map) _cache.set(slug, glyph);
        notifyListeners();
      }).catch((err) => {
        // Si la carga falla (p. ej. una desconexión a mitad del chunk de
        // ~5 MB), no dejamos la promesa fallida en caché: sin esto, toda
        // llamada futura a `ensure()` esperaría la MISMA promesa rechazada
        // y el catálogo quedaría muerto para el resto de la sesión, sin
        // forma de reintentar. Se limpia ANTES de relanzar para que un
        // reintento posterior dispare una carga nueva de verdad.
        _loadPromise = null;
        throw err;
      });
    }
    await _loadPromise;
  },
};
