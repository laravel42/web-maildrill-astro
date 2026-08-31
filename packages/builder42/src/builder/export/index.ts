import type { BuilderSite } from "../model/types";
import { tokensToCss } from "../model/tokens";
import { themesToCss } from "../model/theme";
import { assetImgPath, assetToBytes } from "../model/assets";
import {
  pageCssName,
  pageOutputPath,
  pageOutputPathForLocale,
} from "./links";
import type { RuntimeSourceProvider } from "./runtimeSource";
import { baseCss } from "./base";
import { usedBehaviorsCss } from "./behaviorsCss";
import { usedComponentsCss } from "./componentsCss";
import { minifyCss, minifyHtml } from "./minify";
import { exportPage } from "./renderPage";
import { buildRobots, buildSitemap } from "./seo";
import {
  siteUsesUIRuntime,
  usedActionModuleIdsForSite,
  usedBehaviorModuleIdsForSite,
} from "./usage";
import { selfHostedFontFiles, type ResolvedFontAssets } from "./selfHostedFonts";
import { createExportWarningsCollector, type ExportWarning } from "./warnings";

export interface ExportOptions {
  /** Minifica HTML y CSS. Default: true (docs/07 §8). */
  minify?: boolean;
  /**
   * Fuente del runtime JS pre-compilado (docs/33 §2.1).
   *
   * - **Editor (Vite):** pasar `viteRuntimeSourceProvider` de `runtimeBundles.vite.ts`.
   *   El facade `export/site.ts` lo inyecta automáticamente para los callers del editor.
   * - **Servidor (Node):** pasar `nodeRuntimeSourceProvider` de `runtimeBundles.node.ts`.
   * - Si se omite (default), los bundles del runtime no se incluyen en el output
   *   (equivalente a un build del runtime vacío — cero-JS). Útil en tests y en entornos
   *   donde los behaviors no son relevantes.
   */
  runtimeSource?: RuntimeSourceProvider;
  /**
   * Bytes de los `.woff2` de Google Fonts YA DESCARGADOS, para self-hosting
   * en el sitio exportado (docs/48, decisión D3 — ver `selfHostedFonts.ts`).
   *
   * Ausente (default): comportamiento actual sin cambios — las webfonts se
   * enlazan vía `<link>` externo a `fonts.googleapis.com` (`usage.ts` →
   * `fontLinks`). Es lo que usan el editor y la descarga de ZIP local.
   *
   * Presente: cada página emite `@font-face` apuntando a
   * `assets/fonts/*.woff2` (archivos que este mismo `exportSite` agrega al
   * resultado) en vez del `<link>` externo — cero peticiones a Google desde
   * el sitio publicado. Lo pasa el servidor (`buildSiteFiles`,
   * `server/src/services/publish/webfonts.ts`) tras resolver la red ANTES de
   * llamar aquí (P8: `exportSite` sigue síncrono/puro, sin red).
   */
  fontAssets?: ResolvedFontAssets;
}

/**
 * Provider vacío: todos los getters devuelven `undefined`.
 * Es el comportamiento cuando `src/runtime/dist/` no existe (glob vacío),
 * igual que antes de la división en providers (docs/33 §2.1).
 * El servidor pasa `nodeRuntimeSourceProvider`; el editor pasa `viteRuntimeSourceProvider`.
 * Este default seguro evita un import estático de Vite en el módulo del servidor.
 */
const NULL_RUNTIME_SOURCE: RuntimeSourceProvider = {
  getBundle: () => undefined,
  getEnhanceLoader: () => undefined,
  getUIRuntime: () => undefined,
};

export interface ExportedFile {
  path: string;
  /** Texto (HTML/CSS) o binario (imágenes). */
  contents: string | Uint8Array;
}

export interface ExportSiteResult {
  files: ExportedFile[];
  warnings: ExportWarning[];
}

/** Orquestador de sitio completo (docs/07 §9). */
export function exportSite(
  site: BuilderSite,
  opts: ExportOptions = {},
): ExportSiteResult {
  const minify = opts.minify ?? true;
  const runtimeSource = opts.runtimeSource ?? NULL_RUNTIME_SOURCE;
  const css = (s: string) => (minify ? minifyCss(s) : s);
  const html = (s: string) => (minify ? minifyHtml(s) : s);
  const files: ExportedFile[] = [];
  const warningsCollector = createExportWarningsCollector();
  const i18n = site.meta.i18n;
  // Sin i18n: solo el idioma default (retrocompat total — mismo output que
  // antes de la Dimensión B, docs/12 §B.10). Con i18n: una carpeta por locale
  // configurado (docs/12 §B.7, B2.1).
  const locales = i18n ? i18n.locales : [site.meta.defaultLang];

  // Capas compartidas (CSS/assets se comparten entre idiomas: solo el HTML
  // difiere, docs/12 §B.7 punto 5).
  const tokens = tokensToCss(site.meta.tokens, ":root", site.meta.breakpoints);
  if (tokens) files.push({ path: "assets/css/tokens.css", contents: css(tokens) });
  // Capa de temas (docs/11 §4): un bloque por tema (`:root` para el default +
  // `[data-theme]` para todos). Solo si el sitio tiene temas (retrocompat).
  const themesCss = themesToCss(site.meta.tokens, site.meta.themes, site.meta.defaultThemeId);
  if (themesCss) files.push({ path: "assets/css/themes.css", contents: css(themesCss) });
  files.push({ path: "assets/css/base.css", contents: css(baseCss()) });

  // Chrome CSS de behaviors en uso (flechas/dots…, docs/10 §5/§8.3): solo si
  // hay al menos un behavior con `runtime.css` declarado y usado en el sitio.
  const behaviorsCss = usedBehaviorsCss(site);
  if (behaviorsCss) files.push({ path: "assets/css/behaviors.css", contents: css(behaviorsCss) });

  // CSS estático presentacional de componentes en uso (T10, AGENTS.md): solo
  // si hay al menos un `ComponentDefinition.css` declarado y usado en el
  // sitio. Independiente de `behaviorsCss` — existe con o sin behavior JS
  // adjunto (bug real corregido: sin esta capa, quitar el behavior dejaba el
  // componente sin estilo presentacional).
  const componentsCss = usedComponentsCss(site);
  if (componentsCss) files.push({ path: "assets/css/components.css", contents: css(componentsCss) });

  // Runtime JS de behaviors Y acciones (docs/10 §4, §11.2 punto 4; docs/44
  // §2.4): SOLO los moduleIds realmente usados en el sitio + el loader, si
  // hay al menos uno. Vacío = cero-JS, ningún archivo `assets/js/*` (invariante
  // P8/P9, criterio de aceptación #1 de la Fase 8 / #3 de docs/44 §7).
  const usedModuleIds = new Set([
    ...usedBehaviorModuleIdsForSite(site),
    ...usedActionModuleIdsForSite(site),
  ]);
  const enhanceLoaderSource = runtimeSource.getEnhanceLoader();
  if (usedModuleIds.size > 0 && enhanceLoaderSource) {
    files.push({ path: "assets/js/enhance.js", contents: enhanceLoaderSource });
    for (const moduleId of usedModuleIds) {
      const bundle = runtimeSource.getBundle(moduleId);
      if (bundle) files.push({ path: `assets/js/${moduleId}.js`, contents: bundle });
    }
  }

  // Micro-runtime ui.js (tier 1, docs/15 §1): SOLO si algún componente del
  // sitio participa (data-pb-ui). Independiente de los behaviors — un sitio
  // puede tener ui.js sin ningún behavior, y viceversa. Cero-JS si no se usa.
  const uiRuntimeSource = runtimeSource.getUIRuntime();
  if (siteUsesUIRuntime(site) && uiRuntimeSource) {
    files.push({ path: "assets/js/ui.js", contents: uiRuntimeSource });
  }

  // Webfonts self-hosted (docs/48, D3): SOLO si el caller pasó `fontAssets`
  // ya resueltos (servidor de publish). El editor/ZIP local no pasan esta
  // opción, así que no emiten `assets/fonts/*` (retrocompat: mismo output que
  // antes, con `<link>` externo vía `usage.ts` → `fontLinks`).
  const fontAssets = opts.fontAssets;
  if (fontAssets) {
    for (const file of selfHostedFontFiles(site, fontAssets)) {
      files.push(file);
    }
  }

  // Por página × por locale: page-<slug>.css (una vez) + <dir>/index.html (una
  // vez por locale, en su ruta localizada).
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (!page) continue;

    let cssEmitted = false;
    for (const locale of locales) {
      const { html: pageHtml, css: pageStyles } = exportPage(
        page,
        site,
        i18n ? locale : undefined,
        warningsCollector,
        fontAssets,
      );
      if (!cssEmitted) {
        files.push({ path: `assets/css/${pageCssName(page.meta.slug)}`, contents: css(pageStyles) });
        cssEmitted = true;
      }
      const outputPath = i18n
        ? pageOutputPathForLocale(page.meta.slug, locale, i18n.defaultLocale, i18n.routeStrategy)
        : pageOutputPath(page.meta.slug);
      files.push({ path: outputPath, contents: html(pageHtml) });
    }
  }

  // sitemap/robots solo con baseUrl (docs/07 §7); el sitemap incluye todas las
  // variantes de idioma con <xhtml:link> cuando hay i18n (docs/12 §B.7).
  if (site.meta.baseUrl) {
    files.push({ path: "sitemap.xml", contents: buildSitemap(site) });
    files.push({ path: "robots.txt", contents: buildRobots(site) });
  }

  // Assets binarios (imágenes) → assets/img/<fileName> (docs/07 §4). El minify
  // no los toca (son binarios). Se comparten entre idiomas (una sola copia).
  const assets = site.assets;
  if (assets) {
    const seen = new Set<string>();
    for (const asset of Object.values(assets)) {
      const path = assetImgPath(asset);
      if (seen.has(path)) continue;
      seen.add(path);
      files.push({ path, contents: assetToBytes(asset) });
    }
  }

  return { files, warnings: warningsCollector.warnings };
}
