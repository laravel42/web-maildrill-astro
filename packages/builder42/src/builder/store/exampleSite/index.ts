/**
 * Sitio de ejemplo (criterio de aceptación Fase 1 §8.2 + demo multipágina +
 * prueba del token `sizes.container`, docs/08 §1):
 *   home  → root(flex column, fondo de página) → wrap(maxWidth tokenizado,
 *           centrado) ├ header(logo + nav) ├ hero(título+subtítulo+CTA)
 *           ├ features(grid 1→3 col en md) └ footer(texto)
 *   about → página vacía (para ejercitar el modelo multipágina)
 *
 * El nodo `wrap` es la pieza que demuestra el token `sizes.container`
 * (`size.maxWidth: { token: "sizes.container" }` + `margin: "0 auto"`): todo
 * el contenido de la página queda centrado y acotado a 1200px, en vez de
 * desbordarse al ancho completo del viewport como pasaba sin este contenedor
 * (el frame del editor simula un viewport, pero el HTML exportado no traía
 * ningún límite de ancho salvo que el usuario lo configurara a mano).
 */
import type { BuilderSite } from "../../model/types";
import { createSiteFromDocument } from "../../model/site";
import { migrateSiteCompositeSlots } from "../../model/migrateSlots";
import { mergeWithBaseTokens } from "../../model/tokens";
import { createExampleDocument } from "./home";
import { createAboutPage } from "./about";
import { createContactPage } from "./contact";
import { createFeaturesPage } from "./features";
import { createSignupPage } from "./signup";
import { exampleHomeTranslations } from "./home/translations";

export { createExampleDocument };

export function createExampleSite(): BuilderSite {
  const site = createSiteFromDocument(createExampleDocument(), "Sitio de ejemplo");
  const about = createAboutPage();

  // Asset de ejemplo (SVG inline) referenciado por el nodo `img`: usa
  // currentColor para heredar el color del tema activo en vez de hardcodear
  // #2563eb (que solo cuadra con el tema "Claro" de la galería).
  const demoSvg =
    "<svg xmlns='http://www.w3.org/2000/svg' width='300' height='160'>" +
    "<rect width='100%' height='100%' fill='#888'/>" +
    "<text x='50%' y='50%' fill='#fff' font-family='sans-serif' font-size='20' " +
    "text-anchor='middle' dominant-baseline='middle'>Asset demo</text></svg>";

  // Traducciones de contenido (docs/12 §B.4): el idioma default (es) vive en
  // `props`; en/it viven aquí por nodo → campo. Solo campos `translatable`
  // (text.content, button.label, image.alt). Hace que el ejemplo se vea real
  // al cambiar el idioma de contenido (canvas) o al exportar por carpeta/idioma.
  const homeId = site.homePageId;
  const home = site.pages[homeId]!;
  const homeWithTranslations = { ...home, translations: exampleHomeTranslations() };

  const contact = createContactPage();
  const features = createFeaturesPage(contact.id, homeId);
  const signup = createSignupPage(homeId);

  return migrateSiteCompositeSlots({
    ...site,
    meta: {
      ...site.meta,
      i18n: { locales: ["es", "en", "it"], defaultLocale: "es", routeStrategy: "prefix-except-default" },
      tokens: mergeWithBaseTokens(undefined),
    },
    pages: {
      ...site.pages,
      [homeId]: homeWithTranslations,
      [about.id]: about,
      [features.id]: features,
      [contact.id]: contact,
      [signup.id]: signup,
    },
    pageOrder: [...site.pageOrder, about.id, features.id, contact.id, signup.id],
    assets: {
      "asset-demo": {
        id: "asset-demo",
        fileName: "ejemplo.svg",
        mimeType: "image/svg+xml",
        dataUrl: `data:image/svg+xml,${encodeURIComponent(demoSvg)}`,
      },
    },
  });
}
