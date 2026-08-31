/**
 * Resolución de rutas y enlaces para el export de sitio (P7/P8, docs/07 §4).
 *
 * Puro: no depende del store ni del DOM. Construye el mapa `PageId → ruta` una
 * vez por export y resuelve cada `LinkTarget` a un `href` real. Las rutas son
 * por **directorio** (URLs limpias, docs/06 D5) y root-absolutas; `basePath`
 * (hosting en subcarpeta) se antepone aquí.
 */

import type { BuilderSite, I18nConfig, LinkTarget, PageId } from "../model/types";

/** Ruta de una página (sin basePath): home → "/", resto → "/<slug>/". */
export function pageRoute(slug: string): string {
  return slug === "" ? "/" : `/${slug}/`;
}

// ---------------------------------------------------------------------------
// Rutas por idioma (docs/12 §B.7) — carpeta por idioma con hreflang (B2.1)
// ---------------------------------------------------------------------------

/**
 * Ruta de una página en un `locale` dado, según `routeStrategy` (docs/12 §B.4,
 * §B.7). Sin prefijo para el idioma default en `"prefix-except-default"`;
 * siempre con prefijo en `"prefix-all"`. El slug NO se traduce (docs/12 §B.9):
 * solo cambia el prefijo de idioma antepuesto a la ruta base.
 *
 * - "prefix-except-default": home(default) → "/", about(default) → "/about/",
 *   home(en) → "/en/", about(en) → "/en/about/".
 * - "prefix-all": home(es) → "/es/", about(es) → "/es/about/",
 *   home(en) → "/en/", about(en) → "/en/about/".
 */
export function localizedRoute(
  slug: string,
  locale: string,
  defaultLocale: string,
  routeStrategy: I18nConfig["routeStrategy"],
): string {
  const base = pageRoute(slug); // "/" o "/slug/"
  if (routeStrategy === "prefix-except-default" && locale === defaultLocale) {
    return base;
  }
  return base === "/" ? `/${locale}/` : `/${locale}${base}`;
}

/** Mapa `PageId → ruta` (sin basePath) construido desde los slugs del sitio. */
export function buildPathMap(site: BuilderSite): Record<PageId, string> {
  const map: Record<PageId, string> = {};
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (page) map[id] = pageRoute(page.meta.slug);
  }
  return map;
}

/**
 * Mapa `PageId → ruta` para un `locale` específico (docs/12 §B.7). Si el sitio
 * no tiene `i18n` configurado, equivale a `buildPathMap` (retrocompat).
 */
export function buildPathMapForLocale(site: BuilderSite, locale: string): Record<PageId, string> {
  const i18n = site.meta.i18n;
  if (!i18n) return buildPathMap(site);
  const map: Record<PageId, string> = {};
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (page) map[id] = localizedRoute(page.meta.slug, locale, i18n.defaultLocale, i18n.routeStrategy);
  }
  return map;
}

/** Antepone `basePath` (default "/") a una ruta root-absoluta, sin barras dobles. */
export function withBasePath(basePath: string | undefined, path: string): string {
  const bp = (basePath ?? "/").replace(/\/$/, ""); // "/" → "", "/docs/" → "/docs"
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${bp}${p}` || "/";
}

/**
 * Resuelve un `LinkTarget` a `href` (docs/07 §4). Un enlace interno a una página
 * inexistente se degrada a "#" (no rompe el export).
 */
export function resolveLink(
  link: LinkTarget,
  pathMap: Record<PageId, string>,
  basePath?: string,
): string {
  switch (link.kind) {
    case "external":
      return link.href;
    case "anchor":
      return `#${link.nodeId}`;
    case "internal": {
      const route = pathMap[link.pageId];
      if (route === undefined) return "#"; // página borrada → degradado (docs/07 §11)
      const base = withBasePath(basePath, route);
      return link.anchor ? `${base}#${link.anchor}` : base;
    }
  }
}

/** Ruta de salida del `index.html` de una página: home → "index.html". */
export function pageOutputPath(slug: string): string {
  return slug === "" ? "index.html" : `${slug}/index.html`;
}

/**
 * Ruta de salida del `index.html` de una página en un `locale` (docs/12 §B.7):
 * se antepone el mismo prefijo que `localizedRoute` como directorio.
 */
export function pageOutputPathForLocale(
  slug: string,
  locale: string,
  defaultLocale: string,
  routeStrategy: import("../model/types").I18nConfig["routeStrategy"],
): string {
  if (routeStrategy === "prefix-except-default" && locale === defaultLocale) {
    return pageOutputPath(slug);
  }
  return slug === "" ? `${locale}/index.html` : `${locale}/${slug}/index.html`;
}

/** Nombre estable del CSS por página: home → "page-home.css" (slug ""). */
export function pageCssName(slug: string): string {
  const flat = slug === "" ? "home" : slug.replace(/\//g, "-");
  return `page-${flat}.css`;
}

/** URL absoluta de una página (para canonical/sitemap): baseUrl + basePath + ruta. */
export function pageAbsoluteUrl(
  baseUrl: string,
  basePath: string | undefined,
  route: string,
): string {
  return `${baseUrl.replace(/\/$/, "")}${withBasePath(basePath, route)}`;
}
