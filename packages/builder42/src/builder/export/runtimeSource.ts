/**
 * Contrato agnóstico de entorno para obtener el runtime JS pre-compilado
 * (`src/runtime/dist/*.js`, generado por `scripts/build-runtime.mjs`) como
 * texto (docs/33 §2.1).
 *
 * `exportSite`/`inlineRuntimeScripts` (el "core" del export, P8) no saben
 * CÓMO se leyeron esos bundles — solo consumen este contrato, igual que P4
 * ("el core no conoce los tipos"): aquí el core no conoce el ENTORNO
 * (Vite en el editor vs. Node en el servidor, docs/33 §2/§7).
 *
 * Implementaciones:
 * - `runtimeBundles.vite.ts` — editor, vía `import.meta.glob` (comportamiento
 *   idéntico al `runtimeBundles.ts` original, sin cambios).
 * - `runtimeBundles.node.ts` — servidor, vía `fs.readFileSync` sobre los
 *   mismos artefactos en disco.
 *
 * Cualquier getter puede devolver `undefined` si el build del runtime no se
 * corrió (`src/runtime/dist/` vacío o ausente) — el caller decide qué hacer,
 * igual que el comportamiento previo con el glob vacío (docs/10 §11).
 */
export interface RuntimeSourceProvider {
  /** JS bundleado de un moduleId de behavior, o undefined si no existe. */
  getBundle(moduleId: string): string | undefined;
  /** Loader `enhance.js`. */
  getEnhanceLoader(): string | undefined;
  /** Micro-runtime `ui.js` (tier 1, docs/15 §1). */
  getUIRuntime(): string | undefined;
}
