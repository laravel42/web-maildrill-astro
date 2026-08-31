/**
 * Puente entre los bundles pre-compilados del runtime (`src/runtime/dist/*.js`,
 * generados por `scripts/build-runtime.mjs`) y el pipeline de export
 * (docs/10 §11.2 punto 3). Lee el JS ya bundleado como TEXTO — cero bundling en
 * el navegador; `exportSite` sigue siendo puro (P8): no importa nada de
 * `src/runtime/` como código, solo su salida como string.
 *
 * `import.meta.glob(..., { query: "?raw", eager: true })` es una feature de
 * Vite: en tiempo de build del EDITOR (no del sitio exportado) empaqueta el
 * contenido de cada archivo como string literal. Si `src/runtime/dist/` no
 * existe aún (p. ej. no se corrió `build-runtime.mjs`), el glob devuelve `{}`
 * y `runtimeBundles` queda vacío — el caller decide qué hacer (docs/10 §11).
 *
 * Implementación del contrato `RuntimeSourceProvider` (docs/33 §2.1) para el
 * editor. La contraparte en Node (servidor) vive en `runtimeBundles.node.ts`.
 */

import type { RuntimeSourceProvider } from "./runtimeSource";

const rawModules = import.meta.glob("../../runtime/dist/*.js", {
  query: "?raw",
  eager: true,
}) as Record<string, { default: string }>;

/** `moduleId → código JS` (p. ej. `"carousel" → "...minified js..."`). */
export const runtimeBundles: Record<string, string> = Object.fromEntries(
  Object.entries(rawModules)
    .map(([path, mod]) => {
      const match = /([^/]+)\.js$/.exec(path);
      const moduleId = match?.[1];
      return moduleId ? [moduleId, mod.default] : null;
    })
    .filter((entry): entry is [string, string] => entry !== null)
    // El loader (`enhance.js`) y el micro-runtime (`ui.js`) no son "moduleId" de
    // behavior: se manejan aparte.
    .filter(([moduleId]) => moduleId !== "enhance" && moduleId !== "ui"),
);

/** Código del loader (`enhance.js`), o `undefined` si no se generó el build. */
export const enhanceLoaderSource: string | undefined = rawModules["../../runtime/dist/enhance.js"]?.default;

/** Código del micro-runtime (`ui.js`), o `undefined` si no se generó el build (docs/15 §1). */
export const uiRuntimeSource: string | undefined = rawModules["../../runtime/dist/ui.js"]?.default;

/** JS de un `moduleId` de behavior, o `undefined` si no está bundleado. */
export function getRuntimeBundle(moduleId: string): string | undefined {
  return runtimeBundles[moduleId];
}

/** Implementación de `RuntimeSourceProvider` para el editor (Vite). */
export const viteRuntimeSourceProvider: RuntimeSourceProvider = {
  getBundle: getRuntimeBundle,
  getEnhanceLoader: () => enhanceLoaderSource,
  getUIRuntime: () => uiRuntimeSource,
};
