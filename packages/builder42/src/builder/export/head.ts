/**
 * Generación del `<head>` por página (P8, docs/07 §5).
 *
 * Puro: recibe la página, el sitio y los `href` de CSS ya resueltos (con
 * basePath). Emite título, description, canonical (si hay baseUrl), robots,
 * Open Graph / Twitter (con fallback a `site.meta`), `<html lang>`, viewport,
 * favicon y los `<link>` de CSS en capas. Los valores se escapan al inyectarse
 * en atributos (docs/07 §11).
 *
 * `page.meta` debe venir YA RESUELTO para el locale activo (docs/12 §B.9): el
 * caller (`export/site.ts`) aplica `resolveMetaForLocale` antes de invocar
 * `renderHead`. Esta función no conoce `locale` — es agnóstica de idioma,
 * igual que `renderDocumentHtml` recibe props ya resueltas por
 * `resolvePropsForLocale` en vez de resolverlas ella misma.
 */

import type { BuilderPage, BuilderSite } from "../model/types";
import { pageAbsoluteUrl, pageRoute, withBasePath } from "./links";

/** Escapa un valor para inyectarlo en un atributo HTML. */
export function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function metaName(name: string, content: string | undefined): string | null {
  if (!content) return null;
  return `<meta name="${name}" content="${escapeAttr(content)}">`;
}

function metaProp(property: string, content: string | undefined): string | null {
  if (!content) return null;
  return `<meta property="${property}" content="${escapeAttr(content)}">`;
}

export interface HeadOptions {
  /** `href` de CSS en orden (tokens → base → page), ya con basePath. */
  cssHrefs: string[];
  /** `<link>`/`<meta>` extra de fuentes (docs/07 §6), ya formados. */
  fontLinks?: string[];
  /**
   * Alternates `hreflang` (docs/12 §B.7, B.9): mapa `locale → URL absoluta`
   * de la MISMA página en cada idioma configurado, incluido el propio. Se
   * omite si el sitio es monolingüe (retrocompat: sin este campo no se emite
   * ningún `<link rel="alternate">`).
   */
  hreflangAlternates?: Record<string, string>;
  /**
   * `src` del loader de behaviors (docs/10 §4, §11), ya con basePath. Se
   * omite si la página no usa ningún behavior — invariante cero-JS (P8/P9):
   * sin este campo no se emite ningún `<script>` (verificable por diff).
   */
  enhanceScriptSrc?: string;
  /**
   * `src` de cada bundle de behavior REALMENTE usado en la página (docs/10
   * §4), ya con basePath. Se inyectan como `<script type="module" defer>`
   * ANTES de `enhanceScriptSrc`: cada uno se auto-registra en
   * `window.__pbBehaviors` al cargar (side-effect), y `defer` preserva el
   * orden de ejecución relativo entre módulos — así el loader encuentra los
   * enhancers ya registrados cuando escanea el DOM. Sin esto, `enhance.js`
   * nunca llegaba a importar los bundles de behavior (bug: el JS se emitía
   * al zip pero ningún `<script>` lo cargaba, así que nunca se ejecutaba).
   */
  behaviorScriptSrcs?: string[];
  /**
   * `src` del micro-runtime `ui.js` (tier 1, docs/15 §1), ya con basePath. Se
   * omite si la página no tiene componentes con `data-pb-ui` — invariante
   * cero-JS (P8/P9). Es independiente del sistema de behaviors: `ui.js` es un
   * script autónomo (no se auto-registra en `window.__pbBehaviors`).
   */
  uiScriptSrc?: string;
  /**
   * Script INLINE (sin `src`) que aplica el tema recordado en `localStorage`
   * al `<html data-theme>` lo antes posible, en TODAS las páginas (docs/11 §4).
   * Sin esto, la elección del theme-toggle solo se veía en la página donde se
   * pulsó: el runtime del toggle únicamente corre en páginas que tienen el
   * botón, así que al navegar a otra página se perdía la preferencia. Este
   * micro-script (envuelto en try/catch, sin red) corre en el `<head>` antes de
   * pintar — así el tema persiste entre páginas y no hay flash. Se omite si el
   * sitio no usa ningún theme-toggle (invariante cero-JS por defecto, P8/P9).
   */
  themePersistScript?: string;
}

/** Construye el `<head>` completo de una página (docs/07 §5). */
export function renderHead(
  page: BuilderPage,
  site: BuilderSite,
  opts: HeadOptions,
): string {
  const { meta } = page;
  const siteName = site.meta.name;
  const title = siteName ? `${meta.title} — ${siteName}` : meta.title;
  const seo = meta.seo;
  const route = pageRoute(meta.slug);

  const lines: string[] = [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeAttr(title)}</title>`,
  ];

  // Persistencia de tema entre páginas (docs/11 §4): script inline temprano que
  // reaplica el tema recordado en localStorage al <html data-theme> antes de
  // pintar. Va tras el <title> y ANTES de cualquier CSS para evitar flash. No
  // lleva `src` (es código propio generado, no red) — invariante cero-JS solo
  // aplica a runtime opt-in; esto se emite únicamente cuando el sitio usa
  // theme-toggle (el caller pasa el script solo en ese caso).
  if (opts.themePersistScript) {
    lines.push(`<script>${opts.themePersistScript}</script>`);
  }

  const description = meta.description;
  lines.push(metaName("description", description) ?? "");

  // canonical + URLs absolutas solo con baseUrl (docs/07 §5).
  const baseUrl = site.meta.baseUrl;
  if (baseUrl) {
    const canonical = seo?.canonical ?? pageAbsoluteUrl(baseUrl, site.meta.basePath, route);
    lines.push(`<link rel="canonical" href="${escapeAttr(canonical)}">`);
  }
  lines.push(metaName("robots", seo?.robots) ?? "");

  // Open Graph (fallback a site/page).
  const og = seo?.openGraph;
  lines.push(metaProp("og:title", og?.title ?? meta.title) ?? "");
  lines.push(metaProp("og:description", og?.description ?? description) ?? "");
  lines.push(metaProp("og:type", og?.type ?? "website") ?? "");
  lines.push(metaProp("og:image", og?.image) ?? "");
  if (siteName) lines.push(metaProp("og:site_name", siteName) ?? "");
  if (baseUrl) {
    lines.push(metaProp("og:url", pageAbsoluteUrl(baseUrl, site.meta.basePath, route)) ?? "");
  }

  // Twitter.
  const tw = seo?.twitter;
  lines.push(metaName("twitter:card", tw?.card ?? (og?.image ? "summary_large_image" : "summary")) ?? "");
  lines.push(metaName("twitter:title", tw?.title ?? og?.title ?? meta.title) ?? "");
  lines.push(metaName("twitter:description", tw?.description ?? og?.description ?? description) ?? "");
  lines.push(metaName("twitter:image", tw?.image ?? og?.image) ?? "");

  // Favicon.
  const favicon = withBasePath(site.meta.basePath, site.meta.favicon ?? "/favicon.ico");
  lines.push(`<link rel="icon" href="${escapeAttr(favicon)}">`);

  // Fuentes (docs/07 §6).
  for (const f of opts.fontLinks ?? []) lines.push(f);

  // hreflang (docs/12 §B.7, B.9): un <link> por cada idioma alternativo +
  // "x-default" apuntando al idioma default (convención de Google).
  if (opts.hreflangAlternates) {
    for (const [locale, href] of Object.entries(opts.hreflangAlternates)) {
      lines.push(`<link rel="alternate" hreflang="${escapeAttr(locale)}" href="${escapeAttr(href)}">`);
    }
  }

  // CSS en capas (docs/07 §3).
  for (const href of opts.cssHrefs) {
    lines.push(`<link rel="stylesheet" href="${escapeAttr(href)}">`);
  }

  // Behaviors (docs/10 §4, §11): SOLO si la página usa alguno. Cada bundle de
  // behavior se carga ANTES del loader — ambos `defer` module scripts, el
  // orden del documento fija el orden de ejecución (auto-registro completo
  // antes de que `enhance.js` escanee `[data-pb-behavior]`).
  for (const src of opts.behaviorScriptSrcs ?? []) {
    lines.push(`<script type="module" src="${escapeAttr(src)}" defer></script>`);
  }
  if (opts.enhanceScriptSrc) {
    lines.push(`<script type="module" src="${escapeAttr(opts.enhanceScriptSrc)}" defer></script>`);
  }
  // Micro-runtime ui.js (tier 1, docs/15): autónomo, independiente del loader
  // de behaviors. Se emite solo si la página tiene componentes con data-pb-ui.
  if (opts.uiScriptSrc) {
    lines.push(`<script type="module" src="${escapeAttr(opts.uiScriptSrc)}" defer></script>`);
  }

  return lines.filter(Boolean).join("\n");
}
