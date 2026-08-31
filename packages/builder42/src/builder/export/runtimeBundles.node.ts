/**
 * Implementación del contrato `RuntimeSourceProvider` (docs/33 §2.1) para
 * Node (servidor): lee los mismos artefactos que `runtimeBundles.vite.ts`
 * (`src/runtime/dist/*.js`, generados por `scripts/build-runtime.mjs`), pero
 * vía `fs.readFileSync` en vez de `import.meta.glob` (feature de Vite, no
 * disponible en Node — este archivo es precisamente lo que elimina ese
 * bloqueador, docs/33 §2/§2.1).
 *
 * Lectura perezosa y cacheada en memoria: el directorio se lee una sola vez,
 * en la primera llamada a cualquier getter — nunca en tiempo de import del
 * módulo (evita fallar el import si `src/runtime/dist/` no existe todavía,
 * p. ej. build del runtime no corrido) ni en cada llamada (evita golpear el
 * filesystem repetidamente).
 *
 * Si el directorio no existe o está vacío, se comporta igual que el provider
 * de Vite cuando el glob da `{}`: todos los getters devuelven `undefined`, el
 * caller decide qué hacer (docs/10 §11).
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { RuntimeSourceProvider } from "./runtimeSource";

// Este módulo se distribuye como fuente ESM (Vite/Vitest) hoy, y se bundleará
// a CJS para el servidor (docs/33 §3.1) — esbuild reescribe `import.meta.url`
// a algo equivalente a `__filename` también en su salida CJS, así que este
// patrón es válido en ambos formatos de salida.
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// `src/builder/export/` → `src/runtime/dist/` (dos niveles arriba + `runtime/dist`).
const RUNTIME_DIST_DIR = join(__dirname, "../../runtime/dist");

interface RuntimeCache {
  bundles: Map<string, string>;
  enhanceLoader: string | undefined;
  uiRuntime: string | undefined;
}

let cache: RuntimeCache | undefined;

function loadCache(): RuntimeCache {
  if (cache) return cache;

  const bundles = new Map<string, string>();
  let enhanceLoader: string | undefined;
  let uiRuntime: string | undefined;

  if (existsSync(RUNTIME_DIST_DIR)) {
    for (const fileName of readdirSync(RUNTIME_DIST_DIR)) {
      const match = /([^/]+)\.js$/.exec(fileName);
      const moduleId = match?.[1];
      if (!moduleId) continue;

      const contents = readFileSync(join(RUNTIME_DIST_DIR, fileName), "utf-8");
      if (moduleId === "enhance") {
        enhanceLoader = contents;
      } else if (moduleId === "ui") {
        uiRuntime = contents;
      } else {
        bundles.set(moduleId, contents);
      }
    }
  }

  cache = { bundles, enhanceLoader, uiRuntime };
  return cache;
}

/** Implementación de `RuntimeSourceProvider` para el servidor (Node, `fs`). */
export const nodeRuntimeSourceProvider: RuntimeSourceProvider = {
  getBundle: (moduleId: string) => loadCache().bundles.get(moduleId),
  getEnhanceLoader: () => loadCache().enhanceLoader,
  getUIRuntime: () => loadCache().uiRuntime,
};
