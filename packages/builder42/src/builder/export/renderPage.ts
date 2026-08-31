import type { BuilderPage, BuilderSite, ImageSource, LinkTarget } from "../model/types";
import { resolveMetaForLocale } from "../model/i18nContent";
import { tokensToCss } from "../model/tokens";
import { themesToCss, effectiveThemeId } from "../model/theme";
import { resolveImageSrc } from "../model/assets";
import { renderDocumentHtml, type RenderResolvers } from "./exportToHtml";
import { renderHead } from "./head";
import type { ExportWarningsCollector } from "./warnings";
import {
  buildPathMap,
  buildPathMapForLocale,
  localizedRoute,
  pageAbsoluteUrl,
  pageCssName,
  resolveLink,
  withBasePath,
} from "./links";
import { usedBehaviorsCssForNodes } from "../registry/behaviorRegistry";
import { usedComponentsCssForNodes } from "../registry/componentRegistry";
import { baseCss } from "./base";
import { pageCss } from "./pageCss";
import { enhanceScriptSrcFor, inlineRuntimeScripts, uiScriptSrcFor } from "./runtimeScripts";
import type { RuntimeSourceProvider } from "./runtimeSource";
import {
  fontLinks,
  pageHasComponentsCss,
  pageUsesUIRuntime,
  themePersistScriptForSite,
  usedActionModuleIds,
  usedBehaviorModuleIds,
} from "./usage";
import { selfHostedFontLinks, type ResolvedFontAssets } from "./selfHostedFonts";

function documentShell(lang: string, head: string, body: string, themeId?: string): string {
  const themeAttr = themeId ? ` data-theme="${themeId}"` : "";
  return `<!doctype html>
<html lang="${lang}"${themeAttr}>
<head>
${head}
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * Construye `localeInfo` (docs/14 §2.5) para el `language-nav`: los locales del
 * sitio + una función `localizedHref(target)` que da la ruta (con basePath) a
 * la MISMA página `page` en el locale destino. `undefined` si el sitio es
 * monolingüe (sin `site.meta.i18n`).
 */
function buildLocaleInfo(
  page: BuilderPage,
  site: BuilderSite,
  currentLocale: string,
): RenderResolvers["localeInfo"] {
  const i18n = site.meta.i18n;
  if (!i18n) return undefined;
  return {
    locales: i18n.locales,
    currentLocale,
    defaultLocale: i18n.defaultLocale,
    localizedHref: (target: string) =>
      withBasePath(
        site.meta.basePath,
        localizedRoute(page.meta.slug, target, i18n.defaultLocale, i18n.routeStrategy),
      ),
  };
}

function resolversFor(
  site: BuilderSite,
  forExport: boolean,
  locale?: string,
  page?: BuilderPage,
): RenderResolvers {
  const pathMap = locale ? buildPathMapForLocale(site, locale) : buildPathMap(site);
  return {
    resolveLink: (link: LinkTarget) => resolveLink(link, pathMap, site.meta.basePath),
    resolveImageSrc: (source: ImageSource) =>
      resolveImageSrc(source, { assets: site.assets, forExport, basePath: site.meta.basePath }),
    localeInfo:
      page && site.meta.i18n
        ? buildLocaleInfo(page, site, locale ?? site.meta.i18n.defaultLocale)
        : undefined,
    // pagesInfo (docs/16 §12.4, rework `navbar`/`nav-menu`): todas las páginas
    // del sitio con su ruta ya resuelta — mismo `pathMap` que usa `resolveLink`,
    // así que WYSIWYG (canvas) y output (export) siempre coinciden (P3).
    // `title` se resuelve en el `locale` actual del loop de export (docs/12
    // §B.9, mismo criterio que `buildLocaleInfo`/`renderHead`): si el usuario
    // tradujo el título de la página, el menú sale en el idioma correcto en
    // CADA carpeta de idioma exportada.
    pagesInfo: site.pageOrder
      .map((pid) => {
        const p = site.pages[pid];
        if (!p) return null;
        const meta = site.meta.i18n
          ? resolveMetaForLocale(p.meta, locale ?? site.meta.i18n.defaultLocale, site.meta.i18n.defaultLocale)
          : p.meta;
        return {
          pageId: pid,
          title: meta.title,
          href: withBasePath(site.meta.basePath, pathMap[pid] ?? "/"),
          isCurrent: page ? pid === page.id : false,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
  };
}

/**
 * Mapa `locale → URL absoluta` de la MISMA página en cada idioma configurado
 * (docs/12 §B.7, B.9), para `hreflang`. `undefined` si el sitio no tiene
 * `i18n` o no hay `baseUrl` (hreflang necesita URLs absolutas).
 */
function hreflangAlternatesFor(page: BuilderPage, site: BuilderSite): Record<string, string> | undefined {
  const i18n = site.meta.i18n;
  const baseUrl = site.meta.baseUrl;
  if (!i18n || !baseUrl) return undefined;
  const alternates: Record<string, string> = {};
  for (const loc of i18n.locales) {
    const route = localizedRoute(page.meta.slug, loc, i18n.defaultLocale, i18n.routeStrategy);
    alternates[loc] = pageAbsoluteUrl(baseUrl, site.meta.basePath, route);
  }
  // "x-default" apunta al idioma default (convención de Google para hreflang).
  alternates["x-default"] = alternates[i18n.defaultLocale]!;
  return alternates;
}

/**
 * Exporta una página: HTML completo (head con CSS externo + body) y su CSS de
 * nodos. El HTML enlaza las tres capas en `/assets/css/` (con basePath) y las
 * imágenes-asset apuntan a `/assets/img/…` (materializadas por `exportSite`).
 *
 * `locale` (docs/12 §B.7): idioma a resolver. Por defecto, el idioma default
 * del sitio (retrocompat total: sitios monolingües exportan igual que antes).
 *
 * `fontAssets` (docs/48, D3): si se pasa, las webfonts de Google usadas se
 * emiten como `@font-face` self-hosted (`selfHostedFonts.ts`) apuntando a
 * `assets/fonts/*.woff2` en vez del `<link>` externo a `fonts.googleapis.com`
 * (`usage.ts` → `fontLinks`). Ausente = comportamiento actual sin cambios
 * (retrocompat total: el editor y el ZIP local nunca pasan este parámetro).
 * Los bytes ya deben estar resueltos ANTES de llamar a `exportPage`/
 * `exportSite` (mismo patrón que los assets de imagen — P8, sin red aquí).
 */
export function exportPage(
  page: BuilderPage,
  site: BuilderSite,
  locale?: string,
  warnings?: ExportWarningsCollector,
  fontAssets?: ResolvedFontAssets,
): { html: string; css: string } {
  const basePath = site.meta.basePath;
  const effectiveLocale = locale ?? site.meta.defaultLang;
  const effectiveMeta = resolveMetaForLocale(page.meta, effectiveLocale, site.meta.defaultLang);
  const pageModuleIds = new Set([...usedBehaviorModuleIds(page), ...usedActionModuleIds(page)]);
  const pageHasBehaviors = pageModuleIds.size > 0;
  const pageHasUI = pageUsesUIRuntime(page);
  // Tema efectivo de la página (docs/11 §4). `themesToCss` vacío = sitio sin
  // temas → no se enlaza `themes.css` ni se pone `data-theme` (retrocompat).
  const hasThemesCss = themesToCss(site.meta.tokens, site.meta.themes, site.meta.defaultThemeId) !== "";
  const themeId = hasThemesCss ? effectiveThemeId(site, page) : undefined;
  const cssNames = ["tokens.css"];
  if (hasThemesCss) cssNames.push("themes.css");
  cssNames.push("base.css");
  // `behaviors.css` (chrome de flechas/dots…, docs/10 §5/§8.3) SOLO si la
  // página usa algún behavior con CSS declarado — mismo criterio de
  // tree-shake que el JS (invariante cero-JS/cero-CSS-extra, P8/P9).
  if (pageHasBehaviors) cssNames.push("behaviors.css");
  // `components.css` (T10, AGENTS.md): CSS presentacional de componentes
  // (`tabs`/`accordion`/`navbar`/`modal`…) que existe MIENTRAS EL NODO
  // EXISTA, con o sin behavior JS adjunto — a diferencia de `behaviors.css`,
  // no depende de `pageHasBehaviors`. Va ANTES del CSS por-nodo de la página
  // (T9, AGENTS.md): un estado editado por el usuario (p. ej. `tabs.selected`,
  // regla `.n-id--tab[aria-selected]`) tiene la MISMA especificidad que la
  // regla fija de este archivo (`.pb-tabs__tab[aria-selected]`) — para que la
  // personalización del usuario gane sin depender de subir especificidad
  // artificialmente, el CSS del componente (genérico/fallback) debe cargarse
  // primero y el del nodo (específico del usuario) después.
  if (pageHasComponentsCss(page)) cssNames.push("components.css");
  cssNames.push(pageCssName(page.meta.slug));
  const cssHrefs = cssNames.map((name) => withBasePath(basePath, `/assets/css/${name}`));
  // Self-hosted (docs/48, D3) si el caller pasó `fontAssets` (server, publish);
  // si no, `<link>` externo a Google (comportamiento actual, editor/ZIP local).
  const pageFontLinks = fontAssets
    ? selfHostedFontLinks(page, site, fontAssets, basePath)
    : fontLinks(page, site);
  const head = renderHead({ ...page, meta: effectiveMeta }, site, {
    cssHrefs,
    fontLinks: pageFontLinks,
    hreflangAlternates: hreflangAlternatesFor(page, site),
    enhanceScriptSrc: enhanceScriptSrcFor(site, pageHasBehaviors),
    behaviorScriptSrcs: Array.from(pageModuleIds).map((moduleId) =>
      withBasePath(basePath, `/assets/js/${moduleId}.js`),
    ),
    uiScriptSrc: uiScriptSrcFor(site, pageHasUI),
    themePersistScript: themePersistScriptForSite(site),
  });
  const body = renderDocumentHtml(
    page.document,
    resolversFor(site, true, locale, page),
    site.meta.i18n
      ? { locale: effectiveLocale, defaultLocale: site.meta.i18n.defaultLocale, translations: page.translations }
      : undefined,
    warnings,
  );
  const lang = locale ?? page.meta.lang ?? site.meta.defaultLang;
  return { html: documentShell(lang, head, body, themeId), css: pageCss(page, site) };
}

/**
 * Página de PREVIEW autocontenida e INTERACTIVA para el `<iframe srcdoc>` del
 * modo Preview del editor (docs/21 §3.1). CSS embebido en `<style>` (tokens +
 * base + página + chrome de behaviors usados) + imágenes como data URL MÁS el
 * runtime JS opt-in embebido inline (`inlineRuntimeScripts`), para que
 * carousel/modal/tabs/navbar/`ui.js` corran dentro del iframe sin archivos
 * externos.
 *
 * Puro (P8): consume solo `export/` + `runtimeBundles` (el JS ya compilado como
 * texto, no importa `src/runtime/` como código). No toca el store ni el canvas.
 * El HTML es idéntico al publicable salvo por (a) CSS/JS inline en vez de
 * enlazado y (b) imágenes como data URL — misma fidelidad de render (P3), mismo
 * runtime real. NO se minifica (el iframe no lo necesita y facilita depurar).
 */
export function exportPagePreview(
  page: BuilderPage,
  site: BuilderSite,
  locale?: string,
  runtimeSource?: RuntimeSourceProvider,
): { html: string } {
  const effectiveLocale = locale ?? site.meta.defaultLang;
  const effectiveMeta = resolveMetaForLocale(page.meta, effectiveLocale, site.meta.defaultLang);
  const themesCss = themesToCss(site.meta.tokens, site.meta.themes, site.meta.defaultThemeId);
  const themeId = themesCss !== "" ? effectiveThemeId(site, page) : undefined;
  // Chrome CSS de los behaviors usados en la página (flechas/dots, estados de
  // navbar/tabs/accordion/modal…, docs/10 §5/§8.3). En el export a disco esto
  // vive en `behaviors.css` enlazado; en el preview autocontenido debe ir
  // inline o los componentes con behavior se rompen (docs/21 — bug real:
  // navbar/tabs sin su CSS de estados). `usedBehaviorsCssForNodes` es la MISMA
  // función que usa el export (`usedBehaviorsCss`) y el editor en vivo.
  const behaviorsCss = usedBehaviorsCssForNodes(Object.values(page.document.nodes));
  // CSS estático presentacional de los componentes usados en la página (T10,
  // AGENTS.md). Independiente de `behaviorsCss` — existe con o sin behavior
  // JS adjunto; en el export a disco vive en `components.css` enlazado, aquí
  // debe ir inline por el mismo motivo que `behaviorsCss` (autocontenido).
  const componentsCss = usedComponentsCssForNodes(Object.values(page.document.nodes));
  const inlineCss = [
    tokensToCss(site.meta.tokens, ":root", site.meta.breakpoints),
    themesCss,
    baseCss(),
    // T9: `componentsCss` (fijo/genérico) ANTES de `pageCss` (por-nodo, puede
    // incluir un override de estado del usuario con la misma especificidad —
    // ver comentario equivalente en `exportPage`/`cssNames`).
    componentsCss,
    pageCss(page, site),
    behaviorsCss,
  ]
    .filter(Boolean)
    .join("\n\n");
  const styleBlock = `<style>\n${inlineCss}\n</style>`;
  const head = `${renderHead({ ...page, meta: effectiveMeta }, site, {
    cssHrefs: [],
    fontLinks: fontLinks(page, site),
    hreflangAlternates: hreflangAlternatesFor(page, site),
  })}\n${styleBlock}`;
  const body = renderDocumentHtml(
    page.document,
    resolversFor(site, false, locale, page),
    site.meta.i18n
      ? { locale: effectiveLocale, defaultLocale: site.meta.i18n.defaultLocale, translations: page.translations }
      : undefined,
  );
  const scripts = inlineRuntimeScripts(page, runtimeSource);
  const bodyWithScripts = scripts ? `${body}\n${scripts}` : body;
  const lang = locale ?? page.meta.lang ?? site.meta.defaultLang;
  return { html: documentShell(lang, head, bodyWithScripts, themeId) };
}
