/**
 * Contrato agnóstico de entorno para catalógar glifos de iconos (docs/34 §2.2).
 *
 * El `render()` de un componente es síncrono (`renderToStaticMarkup` no admite
 * async — AGENTS §5.5), así que la carga del glifo se separa en dos pasos:
 *
 * 1. `ensure(names)` — async, carga los glifos pedidos en caché (idempotente).
 *    Se llama ANTES de renderizar, en contexto asíncrono (export, effect de React).
 * 2. `get(name)` — síncrono, devuelve el glifo si está en caché, o `undefined`.
 *    El `render()` lo llama y usa el fallback si devuelve `undefined`.
 *
 * La implementación concreta depende del entorno:
 * - Editor (browser/Vite): eager — precarga todo el catálogo al importar (el
 *   barrel ya está en el bundle inicial de Vite de todas formas).
 * - Servidor (Node): lazy — `ensure()` hace `await import(deep-path)` por icono.
 * - Tests: eager sobre un subconjunto fijo, rápido y determinista.
 */
export interface GlyphCatalog<TGlyph> {
  /**
   * Nombres para el picker. Estático, generado por codegen (docs/34 §2.3).
   * No carga datos de glifo — solo los nombres string.
   */
  names(): readonly string[];

  /**
   * Glifo ya cargado en caché, o `undefined` si aún no se ha llamado
   * `ensure([name])`. SÍNCRONO (docs/34 §2.4).
   */
  get(name: string): TGlyph | undefined;

  /**
   * Carga en caché los glifos para los nombres pedidos. Idempotente: llamar
   * de nuevo con los mismos nombres es seguro y barato (no vuelve a cargar).
   * Se invoca antes de renderizar, en contexto asíncrono.
   */
  ensure(names: readonly string[]): Promise<void>;
}
