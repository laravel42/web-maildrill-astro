/**
 * Fachada pública del export de sitio. La implementación está dividida en
 * módulos por concern (base, pageCss, usage, renderPage, seo, etc.); este
 * archivo solo re-exporta para mantener compat con los consumers y los tests
 * que importan de `./site`.
 *
 * Para código NUEVO, importar del módulo específico:
 *   import { exportSite } from "./index";
 *   import { exportPage } from "./renderPage";
 *
 * Este facade es el punto de entrada del EDITOR (Vite). Inyecta automáticamente
 * `viteRuntimeSourceProvider` como default de `runtimeSource`, de modo que los
 * callers del editor (`SiteFileActions`, `Canvas`, `PreviewFrame`) llamen sin
 * pasar el provider y aun así obtengan los bundles del runtime. El servidor Node
 * importa desde `./index` y `./renderPage` directamente y pasa
 * `nodeRuntimeSourceProvider`.
 */
import { exportSite as _exportSite, type ExportOptions, type ExportSiteResult } from "./index";
import { exportPagePreview as _exportPagePreview, exportPage } from "./renderPage";
import { viteRuntimeSourceProvider } from "./runtimeBundles.vite";
import type { BuilderSite, BuilderPage } from "../model/types";

/**
 * Versión del editor: `runtimeSource` hace default al provider de Vite
 * (`import.meta.glob`) cuando no se pasa. Comportamiento idéntico al
 * previo antes de docs/33.
 */
export function exportSite(site: BuilderSite, opts: ExportOptions = {}): ExportSiteResult {
  return _exportSite(site, { runtimeSource: viteRuntimeSourceProvider, ...opts });
}

/**
 * Versión del editor: inyecta el provider de Vite para los scripts inline del preview.
 */
export function exportPagePreview(
  page: BuilderPage,
  site: BuilderSite,
  locale?: string,
): ReturnType<typeof _exportPagePreview> {
  return _exportPagePreview(page, site, locale, viteRuntimeSourceProvider);
}

export type { ExportOptions, ExportedFile, ExportSiteResult } from "./index";
export type { ExportWarning } from "./warnings";
// `exportPage` no necesita wrapping: no usa runtimeSource, emite src externos (no inline).
export { exportPage };
export { baseCss } from "./base";
export { pageCss } from "./pageCss";
export {
  usedFontFamilyKeys,
  fontLinks,
  usedBehaviorModuleIds,
  usedBehaviorModuleIdsForSite,
  usedActionModuleIds,
  usedActionModuleIdsForSite,
  pageUsesUIRuntime,
  siteUsesUIRuntime,
  themePersistScriptForSite,
} from "./usage";
export { usedBehaviorsCss } from "./behaviorsCss";
export { usedComponentsCss } from "./componentsCss";
export { minifyCss, minifyHtml } from "./minify";
