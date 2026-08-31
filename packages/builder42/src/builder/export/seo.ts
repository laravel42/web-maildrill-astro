import type { BuilderPage, BuilderSite } from "../model/types";
import {
  localizedRoute,
  pageAbsoluteUrl,
  pageRoute,
  withBasePath,
} from "./links";

export function buildSitemap(site: BuilderSite): string {
  const baseUrl = site.meta.baseUrl!;
  const i18n = site.meta.i18n;
  const pages = site.pageOrder
    .map((id) => site.pages[id])
    .filter((p): p is BuilderPage => !!p && p.meta.seo?.robots !== "noindex");

  const urls = pages.map((p) => {
    if (!i18n) {
      const loc = pageAbsoluteUrl(baseUrl, site.meta.basePath, pageRoute(p.meta.slug));
      return `  <url><loc>${loc}</loc></url>`;
    }
    // Multilingüe (docs/12 §B.7): una entrada <url> por locale, cada una con
    // <xhtml:link> a todas sus alternates (incluido x-default).
    const alternates = i18n.locales.map((loc) => {
      const route = localizedRoute(p.meta.slug, loc, i18n.defaultLocale, i18n.routeStrategy);
      return { locale: loc, url: pageAbsoluteUrl(baseUrl, site.meta.basePath, route) };
    });
    const defaultUrl = alternates.find((a) => a.locale === i18n.defaultLocale)!.url;
    const xhtmlLinks = [
      ...alternates.map(
        (a) => `      <xhtml:link rel="alternate" hreflang="${a.locale}" href="${a.url}"/>`,
      ),
      `      <xhtml:link rel="alternate" hreflang="x-default" href="${defaultUrl}"/>`,
    ].join("\n");
    return alternates
      .map((a) => `  <url>\n    <loc>${a.url}</loc>\n${xhtmlLinks}\n  </url>`)
      .join("\n");
  });

  const xmlns = i18n
    ? ' xmlns:xhtml="http://www.w3.org/1999/xhtml"'
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${xmlns}>
${urls.join("\n")}
</urlset>`;
}

export function buildRobots(site: BuilderSite): string {
  const baseUrl = site.meta.baseUrl!;
  const sitemap = `${baseUrl.replace(/\/$/, "")}${withBasePath(site.meta.basePath, "/sitemap.xml")}`;
  return `User-agent: *\nAllow: /\nSitemap: ${sitemap}\n`;
}
