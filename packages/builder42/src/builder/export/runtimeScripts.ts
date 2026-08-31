import type { BuilderPage, BuilderSite } from "../model/types";
import { withBasePath } from "./links";
import type { RuntimeSourceProvider } from "./runtimeSource";
import { pageUsesUIRuntime, usedActionModuleIds, usedBehaviorModuleIds } from "./usage";

/** Provider vacío: todos los getters devuelven `undefined` (igual que runtime no construido). */
const NULL_RUNTIME_SOURCE: RuntimeSourceProvider = {
  getBundle: () => undefined,
  getEnhanceLoader: () => undefined,
  getUIRuntime: () => undefined,
};

/** `src` (con basePath) del loader, para inyectar en el `<head>` de una página. */
export function enhanceScriptSrcFor(site: BuilderSite, pageHasBehaviors: boolean): string | undefined {
  if (!pageHasBehaviors) return undefined;
  return withBasePath(site.meta.basePath, "/assets/js/enhance.js");
}

/** `src` (con basePath) del micro-runtime ui.js, para el `<head>` (docs/15 §1). */
export function uiScriptSrcFor(site: BuilderSite, pageHasUI: boolean): string | undefined {
  if (!pageHasUI) return undefined;
  return withBasePath(site.meta.basePath, "/assets/js/ui.js");
}

/**
 * Bloques `<script type="module">` con el runtime JS opt-in EMBEBIDO inline
 * (docs/21 §3.1). A diferencia del export a disco (que enlaza `/assets/js/*.js`
 * vía `renderHead`), el preview en `<iframe srcdoc>` es autocontenido: no hay
 * servidor que sirva archivos, así que el código del runtime va inline.
 *
 * `runtimeSource` es agnóstico de entorno (`RuntimeSourceProvider`, docs/33
 * §2.1): default al provider de Vite para que los callers actuales (editor)
 * y los tests existentes sigan funcionando sin cambios; el servidor (Node)
 * pasa `nodeRuntimeSourceProvider` explícitamente.
 */
export function inlineRuntimeScripts(
  page: BuilderPage,
  runtimeSource: RuntimeSourceProvider = NULL_RUNTIME_SOURCE,
): string {
  const scripts: string[] = [];
  const pageModuleIds = new Set([...usedBehaviorModuleIds(page), ...usedActionModuleIds(page)]);

  if (pageModuleIds.size > 0) {
    for (const moduleId of pageModuleIds) {
      const bundle = runtimeSource.getBundle(moduleId);
      if (bundle) scripts.push(`<script type="module">${bundle}</script>`);
    }
    const enhanceLoaderSource = runtimeSource.getEnhanceLoader();
    if (enhanceLoaderSource) {
      scripts.push(`<script type="module">${enhanceLoaderSource}</script>`);
    }
  }

  const uiRuntimeSource = runtimeSource.getUIRuntime();
  if (pageUsesUIRuntime(page) && uiRuntimeSource) {
    scripts.push(`<script type="module">${uiRuntimeSource}</script>`);
  }

  return scripts.join("\n");
}
