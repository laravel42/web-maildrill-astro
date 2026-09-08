/**
 * Registro de layouts — plantillas de página y sección (Fase 13, docs/16 §13).
 * Análogo a `componentRegistry` (P4): el core consulta este mapa dinámicamente.
 *
 * **Las plantillas de página no se importan estáticamente** (docs/48 §4): entran
 * por `import()` dentro de su `load()`, así los ~324 KB medidos hoy (y el ~1.1 MB
 * proyectado con 20) no viven en el chunk principal del editor ni en el grafo del
 * servidor de publicación. Las de sección sí son estáticas: se arrastran y el DnD
 * necesita su raíz de forma síncrona.
 */

import type { NodeFragment } from "../model/tree";
import type { TokenFontFamily } from "../model/types";
import type { LayoutPageMeta } from "./layouts/helpers";
import { buildFeatures3ColFragment } from "./layouts/sections/features3Col";
import { buildHeroSectionFragment } from "./layouts/sections/heroSection";
import { buildPricingSectionFragment } from "./layouts/sections/pricingSection";
import { buildCtaBannerFragment } from "./layouts/sections/ctaBanner";
import { buildStatsStripFragment } from "./layouts/sections/statsStrip";
import { buildFaqAccordionFragment } from "./layouts/sections/faqAccordion";
import { buildVideoShowcaseFragment } from "./layouts/sections/videoShowcase";
import { buildTeamGridFragment } from "./layouts/sections/teamGrid";
import { buildTabsFeaturesFragment } from "./layouts/sections/tabsFeatures";
import { buildNewsletterModalTriggerFragment } from "./layouts/sections/newsletterModalTrigger";
import { buildLogoCloudStripFragment } from "./layouts/sections/logoCloudStrip";
import { buildAboutSplitFragment } from "./layouts/sections/aboutSplit";
import { buildQuoteStripFragment } from "./layouts/sections/quoteStrip";

/** Locales que traen traducidos las plantillas de negocio real (docs/42). */
const REAL_WORLD_LOCALES = ["es", "en", "it"];

export type LayoutCategory = "page" | "section";

/**
 * Tema que una plantilla propone para darse personalidad (docs/48 §3): color,
 * tipografía, radios y sombras propios en vez de los `BASE_TOKENS` genéricos.
 *
 * Es un **dato declarativo** (P4): `applyPageLayout` lo aplica sin conocer
 * sectores ni nombres de plantilla. Todo es additivo — nunca pisa el
 * `defaultThemeId` del usuario ni borra temas suyos.
 */
export interface LayoutTheme {
  /**
   * Sufijo estable del id del tema creado (`theme-tpl-<slug>`). Reaplicar la
   * misma plantilla actualiza ESE tema en vez de acumular duplicados.
   */
  slug: string;
  /** Nombre visible en el selector de temas (dato de sitio, no clave i18n). */
  name: string;
  colorScheme?: "light" | "dark";
  /** Deltas de tokens semánticos (ruta → valor concreto), como `ThemePreset`. */
  tokens: Record<string, string>;
  /**
   * Familias tipográficas que la plantilla necesita **registradas como tokens
   * del sitio** (`site.meta.tokens.typography.families[key]`), no como delta del
   * tema.
   *
   * Motivo (docs/48 §3.2, verificado en `export/usage.ts`): `fontLinks()` lee
   * **solo** `site.meta.tokens.typography.families` para emitir el `<link>` de
   * Google Fonts, y `usedFontFamilyKeys()` busca refs
   * `{ token: "typography.families.<key>" }` en los estilos de los nodos. Un
   * delta de tema cambiaría la custom property pero el sitio exportado se
   * quedaría **sin la webfont**, cayendo al fallback de sistema. Registrarlas
   * como token del sitio es lo que hace que la fuente viaje al export.
   *
   * La clave es libre (`display`, `body`, …) mientras sea un segmento válido de
   * token; los nodos de la plantilla la referencian por esa ruta.
   */
  fontFamilies?: Record<string, TokenFontFamily>;
}

/** Id determinista del tema de una plantilla (idempotente al reaplicar). */
export function layoutThemeId(theme: LayoutTheme): string {
  return `theme-tpl-${theme.slug}`;
}

/** Campos comunes a las dos categorías de plantilla (siempre en el bundle). */
interface LayoutMeta {
  id: string;
  /** Clave i18n bajo namespace `sidebar`, p. ej. `templates.layouts.portfolio`. */
  labelKey: string;
  descriptionKey?: string;
  /**
   * Locales que la plantilla trae ya traducidos en `fragment.translations`
   * (docs/42). Declarativo: `applyPageLayout` activa el multilenguaje del sitio
   * con estos locales si aún no está configurado, y solo AGREGA los que falten
   * si ya lo está — nunca cambia `defaultLocale` ni quita locales del usuario.
   * Sin esto, un `language-nav` dentro de la plantilla no tendría
   * `ctx.localeInfo` y se vería como placeholder vacío (docs/14 §2).
   */
  siteLocales?: string[];
  /**
   * Arquetipo de layout que la plantilla implementa (docs/48 §2, tabla de
   * arquetipos). Dato puramente declarativo (P4): el core no interpreta el
   * código, solo lo usa la guarda de test `layoutSignature.helper.ts` (§5.1)
   * para decidir cuánto debe diferir la firma estructural de dos plantillas —
   * dos del MISMO arquetipo deben diferenciarse en ≥2/5 rasgos de firma; dos
   * de arquetipo distinto solo deben evitar ser estructuralmente idénticas.
   * Ausente = no participa de esa guarda (plantillas de sección, o páginas
   * aún sin reasignar).
   */
  archetype?: string;
  /**
   * Tema propio de la plantilla (docs/48 §3). `applyPageLayout` registra sus
   * familias tipográficas y el tema en el sitio, y lo asigna a la página activa
   * (`page.meta.themeId`) — no al sitio entero. Ausente = comportamiento
   * anterior exacto (la página conserva el tema que ya tuviera).
   *
   * Vive en la metadata **eager** a propósito (no dentro del módulo perezoso):
   * pesa unos cientos de bytes y la tarjeta del panel lo necesita para pintar su
   * miniatura con la personalidad de la plantilla antes de cargar el fragmento.
   */
  theme?: LayoutTheme;
}

/**
 * Plantilla de **sección**: subárbol insertable. Su `build` es **síncrono**
 * porque se arrastra: el DnD (`dnd/ghost`, `NodeRenderer`) y el pick & insert
 * (`slices/pickInsert`) necesitan el tipo de su nodo raíz durante el gesto, sin
 * un `await` de por medio. Son piezas pequeñas, así que estar en el bundle no
 * cuesta.
 */
export interface SectionLayoutDefinition extends LayoutMeta {
  category: "section";
  build: () => NodeFragment;
}

/** Payload del módulo perezoso de una plantilla de página. */
export interface LoadedPageLayout {
  /** Construye el documento completo de la página. */
  build: () => NodeFragment;
  /**
   * Metadata SEO propuesta por la plantilla (docs/42 §2.8). `applyPageLayout` la
   * escribe en `page.meta` de la página activa (título, descripción, `seo` y
   * `metaTranslations`), conservando `slug`/`lang` del usuario. Una plantilla
   * "lista para publicar" también trae su `<head>` resuelto, no solo el árbol.
   *
   * Viaja en el módulo perezoso (y no en la metadata) porque importarla de forma
   * estática arrastraría el archivo entero de la plantilla al bundle — que es
   * justo lo que la carga perezosa evita (docs/48 §4).
   */
  pageMeta?: LayoutPageMeta;
}

/**
 * Plantilla de **página**: documento completo, de **carga perezosa** (docs/48 §4).
 *
 * Medido (`export/portability.node.test.ts`): las 6 plantillas de negocio real
 * aportan ~324 KB al artefacto; 20 del mismo calibre serían ~1.1 MB de datos en
 * el chunk principal, y el servidor de publicación no las necesita para nada.
 * Se puede diferir sin tocar ningún camino síncrono porque una plantilla de
 * página **nunca se arrastra**: se aplica con un click que ya pasa por un modal
 * de confirmación (punto de espera natural).
 */
export interface PageLayoutDefinition extends LayoutMeta {
  category: "page";
  load: () => Promise<LoadedPageLayout>;
}

export type LayoutDefinition = SectionLayoutDefinition | PageLayoutDefinition;

const DEFINITIONS: LayoutDefinition[] = [
  // --- Plantillas de negocio real (docs/42) --------------------------------
  // Van primero: son páginas completas listas para publicar, con contenido de
  // un negocio concreto y las 3 capas de idioma (`language-nav` + traducciones).
  {
    id: "restaurant-page",
    category: "page",
    labelKey: "templates.layouts.restaurantPage",
    descriptionKey: "templates.layouts.restaurantPageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A1 es el único arquetipo que NO cambia en F2 (docs/48 §2): banda alterna
    // clásica, ya cumplido por la estructura existente.
    archetype: "A1",
    theme: {
      slug: "trattoria",
      name: "Trattoria",
      colorScheme: "light",
      tokens: {
        "colors.text": "#2b1810",
        "colors.surface.default": "#fdf8f0",
        "colors.surface.alt": "#f7e9d7",
        "colors.border": "#e8d5bd",
        "colors.primary.default": "#7a1f2b",
        "colors.primary.on": "#fdf8f0",
        "colors.muted": "#6b5847",
        "colors.band.dark": "#3a0f16",
        "colors.band.on": "#f7e9d7",
      },
      fontFamilies: {
        display: {
          stack: "'Playfair Display', Georgia, serif",
          webFont: { provider: "google", family: "Playfair Display", weights: ["600", "700"] },
        },
        sans: {
          stack: "Inter, system-ui, sans-serif",
          webFont: { provider: "google", family: "Inter", weights: ["400", "600", "700"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/restaurantPage");
      return { build: m.buildRestaurantPageFragment, pageMeta: m.restaurantPageMeta };
    },
  },
  {
    id: "clothing-store-page",
    category: "page",
    labelKey: "templates.layouts.clothingStorePage",
    descriptionKey: "templates.layouts.clothingStorePageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A4 — Catálogo denso (docs/48 §2, F2): tabs de categoría + grid fluido
    // `repeat(auto-fit, minmax(240px, 1fr))`.
    archetype: "A4",
    theme: {
      slug: "atelier",
      name: "Atelier",
      colorScheme: "light",
      tokens: {
        "colors.text": "#1c1c1e",
        "colors.surface.default": "#f7f5f0",
        "colors.surface.alt": "#ece7dc",
        "colors.border": "#d9d3c4",
        "colors.primary.default": "#1c1c1e",
        "colors.primary.on": "#f7f5f0",
        "colors.muted": "#5c5a54",
        "colors.band.dark": "#111113",
        "colors.band.on": "#f7f5f0",
      },
      fontFamilies: {
        sans: {
          stack: "Jost, system-ui, sans-serif",
          webFont: { provider: "google", family: "Jost", weights: ["400", "500", "600"] },
        },
      },
    },
    load: async () => ({
      build: (await import("./layouts/pages/clothingStorePage")).buildClothingStorePageFragment,
    }),
  },
  {
    id: "fitness-studio-page",
    category: "page",
    labelKey: "templates.layouts.fitnessStudioPage",
    descriptionKey: "templates.layouts.fitnessStudioPageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A11 — Timeline/proceso (docs/48 §2, F2): secuencia vertical numerada
    // reemplaza las `tabs` horizontales del horario de clases.
    archetype: "A11",
    theme: {
      slug: "iron",
      name: "Iron",
      colorScheme: "light",
      tokens: {
        "colors.text": "#0f1113",
        "colors.surface.default": "#f4f4f5",
        "colors.surface.alt": "#e7e7e9",
        "colors.border": "#d3d3d6",
        "colors.primary.default": "#c6f135",
        "colors.primary.on": "#0f1113",
        "colors.muted": "#54565a",
        "colors.band.dark": "#141517",
        "colors.band.on": "#f4f4f5",
      },
      fontFamilies: {
        sans: {
          stack: "Archivo, system-ui, sans-serif",
          webFont: { provider: "google", family: "Archivo", weights: ["400", "600", "700"] },
        },
      },
    },
    load: async () => ({
      build: (await import("./layouts/pages/fitnessStudioPage")).buildFitnessStudioPageFragment,
    }),
  },
  {
    id: "dental-clinic-page",
    category: "page",
    labelKey: "templates.layouts.dentalClinicPage",
    descriptionKey: "templates.layouts.dentalClinicPageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A2 — Split zig-zag (docs/48 §2, F2): pares media/copy 50/50 que
    // alternan lado sección a sección.
    archetype: "A2",
    theme: {
      slug: "cuidado",
      name: "Cuidado",
      colorScheme: "light",
      tokens: {
        "colors.text": "#0f2733",
        "colors.surface.default": "#ffffff",
        "colors.surface.alt": "#eef8fa",
        "colors.border": "#cbe9ee",
        "colors.primary.default": "#0891a8",
        "colors.primary.on": "#ffffff",
        "colors.muted": "#4f6b73",
        "colors.band.dark": "#0b2530",
        "colors.band.on": "#ffffff",
      },
      fontFamilies: {
        sans: {
          stack: "'Nunito Sans', system-ui, sans-serif",
          webFont: { provider: "google", family: "Nunito Sans", weights: ["400", "600", "700"] },
        },
      },
    },
    load: async () => ({
      build: (await import("./layouts/pages/dentalClinicPage")).buildDentalClinicPageFragment,
    }),
  },
  {
    id: "real-estate-page",
    category: "page",
    labelKey: "templates.layouts.realEstatePage",
    descriptionKey: "templates.layouts.realEstatePageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A7 — Aside + main (docs/48 §2, F2): filtro lateral `sticky` + listado
    // largo de propiedades en la columna principal.
    archetype: "A7",
    theme: {
      slug: "estate",
      name: "Estate",
      colorScheme: "light",
      tokens: {
        "colors.text": "#1e2124",
        "colors.surface.default": "#ffffff",
        "colors.surface.alt": "#f2ede1",
        "colors.border": "#ddd4bf",
        "colors.primary.default": "#b8912f",
        "colors.primary.on": "#1e2124",
        "colors.muted": "#5c5f63",
        "colors.band.dark": "#1e2124",
        "colors.band.on": "#f2ede1",
      },
      fontFamilies: {
        sans: {
          stack: "'Libre Baskerville', Georgia, serif",
          webFont: { provider: "google", family: "Libre Baskerville", weights: ["400", "700"] },
        },
      },
    },
    load: async () => ({
      build: (await import("./layouts/pages/realEstatePage")).buildRealEstatePageFragment,
    }),
  },
  {
    id: "hotel-boutique-page",
    category: "page",
    labelKey: "templates.layouts.hotelBoutiquePage",
    descriptionKey: "templates.layouts.hotelBoutiquePageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A9 — Carrusel-céntrico (docs/48 §2, F2): `carousel` de habitaciones
    // como eje estructural + `lightbox` en la galería.
    archetype: "A9",
    theme: {
      slug: "boutique",
      name: "Boutique",
      colorScheme: "light",
      tokens: {
        "colors.text": "#2c2a1f",
        "colors.surface.default": "#fbf7ee",
        "colors.surface.alt": "#f3ecd9",
        "colors.border": "#e4d9bb",
        "colors.primary.default": "#5c6b3f",
        "colors.primary.on": "#fbf7ee",
        "colors.muted": "#6b6650",
        "colors.band.dark": "#33361f",
        "colors.band.on": "#f3ecd9",
      },
      fontFamilies: {
        sans: {
          stack: "'Cormorant Garamond', Georgia, serif",
          webFont: { provider: "google", family: "Cormorant Garamond", weights: ["400", "600", "700"] },
        },
      },
    },
    load: async () => ({
      build: (await import("./layouts/pages/hotelBoutiquePage")).buildHotelBoutiquePageFragment,
    }),
  },
  // --- Plantillas genéricas / de andamiaje --------------------------------
  // Retiradas (docs/48 §1): `example-home`, `landing-basic`, `about-page` y
  // `contact-page` — andamiaje de la Fase 13 sin sector, sin test propio y por
  // debajo del estándar visual de docs/43. La galería por sector (docs/48 §2)
  // las reemplaza.
  {
    id: "hero-section",
    category: "section",
    labelKey: "templates.layouts.heroSection",
    descriptionKey: "templates.layouts.heroSectionDesc",
    build: buildHeroSectionFragment,
  },
  {
    id: "features-3col",
    category: "section",
    labelKey: "templates.layouts.features3Col",
    descriptionKey: "templates.layouts.features3ColDesc",
    build: buildFeatures3ColFragment,
  },
  {
    id: "pricing-section",
    category: "section",
    labelKey: "templates.layouts.pricingSection",
    descriptionKey: "templates.layouts.pricingSectionDesc",
    build: buildPricingSectionFragment,
  },
  {
    id: "cta-banner",
    category: "section",
    labelKey: "templates.layouts.ctaBanner",
    descriptionKey: "templates.layouts.ctaBannerDesc",
    build: buildCtaBannerFragment,
  },
  {
    id: "stats-strip",
    category: "section",
    labelKey: "templates.layouts.statsStrip",
    descriptionKey: "templates.layouts.statsStripDesc",
    build: buildStatsStripFragment,
  },
  {
    id: "faq-accordion",
    category: "section",
    labelKey: "templates.layouts.faqAccordion",
    descriptionKey: "templates.layouts.faqAccordionDesc",
    build: buildFaqAccordionFragment,
  },
  {
    id: "video-showcase",
    category: "section",
    labelKey: "templates.layouts.videoShowcase",
    descriptionKey: "templates.layouts.videoShowcaseDesc",
    build: buildVideoShowcaseFragment,
  },
  {
    id: "team-grid",
    category: "section",
    labelKey: "templates.layouts.teamGrid",
    descriptionKey: "templates.layouts.teamGridDesc",
    build: buildTeamGridFragment,
  },
  {
    id: "tabs-features",
    category: "section",
    labelKey: "templates.layouts.tabsFeatures",
    descriptionKey: "templates.layouts.tabsFeaturesDesc",
    build: buildTabsFeaturesFragment,
  },
  {
    id: "newsletter-modal-trigger",
    category: "section",
    labelKey: "templates.layouts.newsletterModalTrigger",
    descriptionKey: "templates.layouts.newsletterModalTriggerDesc",
    build: buildNewsletterModalTriggerFragment,
  },
  {
    id: "logo-cloud-strip",
    category: "section",
    labelKey: "templates.layouts.logoCloudStrip",
    descriptionKey: "templates.layouts.logoCloudStripDesc",
    build: buildLogoCloudStripFragment,
  },
  {
    id: "about-split",
    category: "section",
    labelKey: "templates.layouts.aboutSplit",
    descriptionKey: "templates.layouts.aboutSplitDesc",
    build: buildAboutSplitFragment,
  },
  {
    id: "quote-strip",
    category: "section",
    labelKey: "templates.layouts.quoteStrip",
    descriptionKey: "templates.layouts.quoteStripDesc",
    build: buildQuoteStripFragment,
  },
  {
    id: "signup-page",
    category: "page",
    labelKey: "templates.layouts.signupPage",
    descriptionKey: "templates.layouts.signupPageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A5 — Conversión mono-columna (docs/48 §2, F4): secciones estrechas
    // centradas, sin ninguna banda multicolumna — cero distracción hacia el
    // formulario de inscripción.
    archetype: "A5",
    theme: {
      slug: "campus",
      name: "Campus",
      colorScheme: "light",
      tokens: {
        "colors.text": "#0f2040",
        "colors.surface.default": "#ffffff",
        "colors.surface.alt": "#eef3fb",
        "colors.border": "#d6e0f0",
        "colors.primary.default": "#d97706",
        "colors.primary.on": "#1a1103",
        "colors.muted": "#4a5876",
        "colors.band.dark": "#0b1830",
        "colors.band.on": "#eef3fb",
      },
      fontFamilies: {
        sans: {
          stack: "Figtree, system-ui, sans-serif",
          webFont: { provider: "google", family: "Figtree", weights: ["400", "600", "700"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/signupPage");
      return { build: m.buildSignupPageFragment, pageMeta: m.signupPagePageMeta };
    },
  },
  {
    id: "team-page",
    category: "page",
    labelKey: "templates.layouts.teamPage",
    descriptionKey: "templates.layouts.teamPageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A7b — variante de A7 (docs/48 §2, F4): aside + main, pero con densidad
    // de grid (banda de instalaciones en grid FLUIDO, que A7 no usa en
    // ninguna banda) y orientación distintas (aside de resumen a la DERECHA
    // del contenido, no un filtro a la izquierda como en real-estate-page).
    archetype: "A7b",
    theme: {
      slug: "loft",
      name: "Loft",
      colorScheme: "light",
      tokens: {
        "colors.text": "#0d1f1d",
        "colors.surface.default": "#ffffff",
        "colors.surface.alt": "#eaf5f3",
        "colors.border": "#cfe6e2",
        "colors.primary.default": "#0f766e",
        "colors.primary.on": "#ffffff",
        "colors.muted": "#4b6461",
        "colors.band.dark": "#092624",
        "colors.band.on": "#eaf5f3",
      },
      fontFamilies: {
        sans: {
          stack: "'DM Sans', system-ui, sans-serif",
          webFont: { provider: "google", family: "DM Sans", weights: ["400", "500", "700"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/teamPage");
      return { build: m.buildTeamPageFragment, pageMeta: m.teamPagePageMeta };
    },
  },
  {
    id: "blog-list",
    category: "page",
    labelKey: "templates.layouts.blogList",
    descriptionKey: "templates.layouts.blogListDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A3 — Editorial/magazine (docs/48 §2, F3): tipografía dominante, grid de
    // anchos desiguales, poca imagen — el peso visual lo lleva el texto.
    archetype: "A3",
    theme: {
      slug: "roast",
      name: "Roast",
      colorScheme: "light",
      tokens: {
        "colors.text": "#3b2111",
        "colors.surface.default": "#fdf6ec",
        "colors.surface.alt": "#f5e8d3",
        "colors.border": "#e3d0ac",
        "colors.primary.default": "#8a4a25",
        "colors.primary.on": "#fdf6ec",
        "colors.muted": "#6b5440",
        "colors.band.dark": "#2a1508",
        "colors.band.on": "#f5e8d3",
      },
      fontFamilies: {
        display: {
          stack: "Fraunces, Georgia, serif",
          webFont: { provider: "google", family: "Fraunces", weights: ["500", "600", "700"] },
        },
        sans: {
          stack: "Inter, system-ui, sans-serif",
          webFont: { provider: "google", family: "Inter", weights: ["400", "600", "700"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/blogList");
      return { build: m.buildBlogListFragment, pageMeta: m.blogListPageMeta };
    },
  },
  {
    id: "portfolio",
    category: "page",
    labelKey: "templates.layouts.portfolio",
    descriptionKey: "templates.layouts.portfolioDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A9b — variante de A9 carrusel-céntrico (docs/48 §2, F3): el eje es la
    // GALERÍA con `lightbox` por foto + `scroll-progress` fijo en el navbar,
    // no un `carousel` (diferencia con A9 de hotel-boutique-page).
    archetype: "A9b",
    theme: {
      slug: "silver",
      name: "Silver",
      colorScheme: "light",
      tokens: {
        "colors.text": "#111113",
        "colors.surface.default": "#ffffff",
        "colors.surface.alt": "#f2f2f3",
        "colors.border": "#dddddf",
        "colors.primary.default": "#111113",
        "colors.primary.on": "#ffffff",
        "colors.muted": "#5a5a5e",
        "colors.band.dark": "#0a0a0b",
        "colors.band.on": "#ffffff",
      },
      fontFamilies: {
        sans: {
          stack: "Inter, system-ui, sans-serif",
          webFont: { provider: "google", family: "Inter", weights: ["400", "600", "700"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/portfolio");
      return { build: m.buildPortfolioFragment, pageMeta: m.portfolioPageMeta };
    },
  },
  {
    id: "landing-product",
    category: "page",
    labelKey: "templates.layouts.landingProduct",
    descriptionKey: "templates.layouts.landingProductDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A6 — Producto SaaS (docs/48 §2, F3): tabs de features + pricing 3col +
    // logo-cloud + stats, eje propio del sector (no galería ni carrusel).
    archetype: "A6",
    theme: {
      slug: "signal",
      name: "Signal",
      // Variante única y consistente del tema declarativo (ver comentario en
      // layouts/pages/landingProduct.ts sobre la decisión de colorScheme).
      colorScheme: "light",
      tokens: {
        "colors.text": "#1e1b2e",
        "colors.surface.default": "#ffffff",
        "colors.surface.alt": "#f1f0fb",
        "colors.border": "#dcdaf0",
        "colors.primary.default": "#4f46e5",
        "colors.primary.on": "#ffffff",
        "colors.muted": "#5b5770",
        "colors.band.dark": "#161327",
        "colors.band.on": "#f1f0fb",
      },
      fontFamilies: {
        sans: {
          stack: "'Plus Jakarta Sans', system-ui, sans-serif",
          webFont: { provider: "google", family: "Plus Jakarta Sans", weights: ["400", "600", "700"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/landingProduct");
      return { build: m.buildLandingProductFragment, pageMeta: m.landingProductPageMeta };
    },
  },
  {
    id: "law-firm-page",
    category: "page",
    labelKey: "templates.layouts.lawFirmPage",
    descriptionKey: "templates.layouts.lawFirmPageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A10 — Long-form con scroll-spy (docs/48 §2, F5, NUEVA): nav LATERAL
    // `sticky`+`scroll-spy` que gobierna 4 bandas ancladas de áreas de
    // práctica. Distinto de A7 (real-estate-page: aside de FILTRO) y A7b
    // (team-page: aside de resumen/CTA a la derecha) — aquí el aside ES el
    // mecanismo de navegación de toda la sección, no un complemento.
    archetype: "A10",
    theme: {
      slug: "counsel",
      name: "Counsel",
      colorScheme: "light",
      tokens: {
        "colors.text": "#101826",
        "colors.surface.default": "#ffffff",
        "colors.surface.alt": "#f4f1e8",
        "colors.border": "#d8d2bf",
        "colors.primary.default": "#0f2038",
        "colors.primary.on": "#f4f1e8",
        "colors.muted": "#535d6e",
        "colors.band.dark": "#0b1626",
        "colors.band.on": "#f4f1e8",
      },
      fontFamilies: {
        display: {
          stack: "'Source Serif 4', Georgia, serif",
          webFont: { provider: "google", family: "Source Serif 4", weights: ["400", "600", "700"] },
        },
        sans: {
          stack: "Inter, system-ui, sans-serif",
          webFont: { provider: "google", family: "Inter", weights: ["400", "600", "700"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/lawFirmPage");
      return { build: m.buildLawFirmPageFragment, pageMeta: m.lawFirmPageMeta };
    },
  },
  {
    id: "creative-agency-page",
    category: "page",
    labelKey: "templates.layouts.creativeAgencyPage",
    descriptionKey: "templates.layouts.creativeAgencyPageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A8 — Inmersivo oscuro (docs/48 §2, F5, NUEVA): media a sangre, texto
    // mínimo, mucho aire, banda oscura DOMINANTE (la mayoría de la página,
    // no un footer puntual).
    archetype: "A8",
    theme: {
      slug: "studio",
      name: "Studio",
      // Primer tema `colorScheme: "dark"` REAL de la galería (docs/48 §3.2b):
      // las 10 plantillas previas usan paletas oscuras solo como ACENTO
      // (`colors.band.dark`) sobre una base clara. Aquí la base entera es
      // oscura — `colors.band.dark` se fija a negro puro, más oscuro que
      // `colors.surface.default`, para que una banda "enfática" siga
      // distinguiéndose del resto de la página del mismo tema (ver comentario
      // extenso en layouts/pages/creativeAgencyPage.ts).
      colorScheme: "dark",
      tokens: {
        "colors.text": "#f5f5f0",
        "colors.surface.default": "#0a0a0a",
        "colors.surface.alt": "#161616",
        "colors.border": "#2a2a2a",
        "colors.primary.default": "#c8ff3d",
        "colors.primary.on": "#0a0a0a",
        "colors.muted": "#a3a3a3",
        "colors.band.dark": "#000000",
        "colors.band.on": "#f5f5f0",
      },
      fontFamilies: {
        display: {
          stack: "'Space Grotesk', system-ui, sans-serif",
          webFont: { provider: "google", family: "Space Grotesk", weights: ["500", "700"] },
        },
        sans: {
          stack: "'Space Grotesk', system-ui, sans-serif",
          webFont: { provider: "google", family: "Space Grotesk", weights: ["400", "500"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/creativeAgencyPage");
      return { build: m.buildCreativeAgencyPageFragment, pageMeta: m.creativeAgencyPageMeta };
    },
  },
  {
    id: "spa-wellness-page",
    category: "page",
    labelKey: "templates.layouts.spaWellnessPage",
    descriptionKey: "templates.layouts.spaWellnessPageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A2b — variante de A2 split zig-zag (docs/48 §2, F5, NUEVA). Difiere de
    // A2 (dental-clinic-page, F2) en ≥2/5 rasgos de firma: grid REAL de 2
    // columnas (vs. flex row/column de A2) y switch de breakpoint en `sm`
    // (vs. `md` de A2) — ver comentario extenso en
    // layouts/pages/spaWellnessPage.ts.
    archetype: "A2b",
    theme: {
      slug: "serenity",
      name: "Serenity",
      colorScheme: "light",
      tokens: {
        "colors.text": "#3c3327",
        "colors.surface.default": "#fbf8f2",
        "colors.surface.alt": "#f1ebdd",
        "colors.border": "#ddd0b8",
        "colors.primary.default": "#b5622f",
        "colors.primary.on": "#fbf8f2",
        "colors.muted": "#7a6f5c",
        "colors.band.dark": "#4a5a4a",
        "colors.band.on": "#fbf8f2",
      },
      fontFamilies: {
        display: {
          stack: "Marcellus, Georgia, serif",
          webFont: { provider: "google", family: "Marcellus", weights: ["400"] },
        },
        sans: {
          stack: "Karla, system-ui, sans-serif",
          webFont: { provider: "google", family: "Karla", weights: ["400", "600", "700"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/spaWellnessPage");
      return { build: m.buildSpaWellnessPageFragment, pageMeta: m.spaWellnessPageMeta };
    },
  },
  {
    id: "barbershop-page",
    category: "page",
    labelKey: "templates.layouts.barbershopPage",
    descriptionKey: "templates.layouts.barbershopPageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A8b — variante de A8 inmersivo oscuro (docs/48 §2, F6, NUEVA). Difiere
    // de A8 (creative-agency-page, F5) en ≥2/5 rasgos de firma: introduce un
    // grid FLUIDO (`repeat(auto-fit, …)`, medido: A8 nunca lo produce porque
    // sus grids de columnas viven solo en `overrides`, no en la capa base) en
    // la galería de servicios, y un par media/copy con orientación "left" en
    // la banda "Sobre nosotros" (A8 mide "none"/"right"/"stacked", nunca
    // "left") — ver comentario extenso en layouts/pages/barbershopPage.ts.
    archetype: "A8b",
    theme: {
      slug: "fade",
      name: "Fade",
      // Segundo tema `colorScheme: "dark"` real de la galería (el primero fue
      // Studio en creative-agency-page, F5): la base entera es oscura, no solo
      // un acento. Misma trampa de docs/48 §3.2b: `colors.band.dark` se fija a
      // negro puro (más oscuro que `colors.surface.default`, el carbón base)
      // para que una banda enfática (hero, CTA de cita) siga distinguiéndose
      // del resto de la página del mismo tema.
      colorScheme: "dark",
      tokens: {
        "colors.text": "#f2efe9",
        "colors.surface.default": "#121212",
        "colors.surface.alt": "#1c1a18",
        "colors.border": "#332f2a",
        "colors.primary.default": "#c49b58",
        "colors.primary.on": "#121212",
        "colors.muted": "#a39a8d",
        "colors.band.dark": "#000000",
        "colors.band.on": "#f2efe9",
      },
      fontFamilies: {
        // Solo `display` usa Oswald (tipografía condensada de alto contraste,
        // propia de un rótulo de barbería clásica); `sans` se deja en el
        // stack de sistema para el cuerpo — dos condensadas compitiendo por
        // atención en la misma página sería ruido tipográfico, y Oswald no
        // está pensada para párrafos largos (criterio tipográfico, no
        // limitación técnica).
        display: {
          stack: "Oswald, 'Arial Narrow', sans-serif",
          webFont: { provider: "google", family: "Oswald", weights: ["500", "700"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/barbershopPage");
      return { build: m.buildBarbershopPageFragment, pageMeta: m.barbershopPageMeta };
    },
  },
  {
    id: "architecture-studio-page",
    category: "page",
    labelKey: "templates.layouts.architectureStudioPage",
    descriptionKey: "templates.layouts.architectureStudioPageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A10b — variante de A10 long-form con scroll-spy (docs/48 §2, F6,
    // NUEVA). Difiere de A10 (law-firm-page, F5) en ≥2/5 rasgos de firma:
    // grid de 3 columnas ASIMÉTRICAS (vs. 2 columnas de A10) en la banda de
    // nav+contenido, y switch de breakpoint en `lg` (vs. `md` de A10) — ver
    // comentario extenso en layouts/pages/architectureStudioPage.ts. Suma un
    // grid FLUIDO asimétrico (con `gridColumn: span N` por tarjeta) en la
    // galería de proyectos, ausente en A10, y `parallax` en el hero.
    archetype: "A10b",
    theme: {
      slug: "concrete",
      name: "Concrete",
      colorScheme: "light",
      tokens: {
        "colors.text": "#1e1e1c",
        "colors.surface.default": "#ffffff",
        "colors.surface.alt": "#f0efec",
        "colors.border": "#d6d3cc",
        "colors.primary.default": "#c2531f",
        "colors.primary.on": "#ffffff",
        "colors.muted": "#6b675f",
        "colors.band.dark": "#1e1e1c",
        "colors.band.on": "#f0efec",
      },
      fontFamilies: {
        display: {
          stack: "'IBM Plex Sans', system-ui, sans-serif",
          webFont: { provider: "google", family: "IBM Plex Sans", weights: ["500", "700"] },
        },
        sans: {
          stack: "'IBM Plex Sans', system-ui, sans-serif",
          webFont: { provider: "google", family: "IBM Plex Sans", weights: ["400", "500", "700"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/architectureStudioPage");
      return { build: m.buildArchitectureStudioPageFragment, pageMeta: m.architectureStudioPageMeta };
    },
  },
  {
    id: "auto-repair-page",
    category: "page",
    labelKey: "templates.layouts.autoRepairPage",
    descriptionKey: "templates.layouts.autoRepairPageDesc",
    siteLocales: REAL_WORLD_LOCALES,
    // A5b — variante de A5 conversión mono-columna (docs/48 §2, F6, ÚLTIMA
    // de la fase). Difiere de A5 (signup-page, F4) en ≥2/5 rasgos de firma:
    // grid REAL de 2 columnas en la banda de estadísticas de trayectoria
    // (vs. `gridColumns.kind === "none"` en TODAS las bandas de A5) y switch
    // de breakpoint en `sm` para esa banda (vs. ningún `overrides` de layout
    // en ninguna banda de A5) — ver comentario extenso en
    // layouts/pages/autoRepairPage.ts. Suma un tercer rasgo distinto de
    // facto: `hasMedia` (hero con foto real del taller, ausente en A5).
    archetype: "A5b",
    theme: {
      slug: "torque",
      name: "Torque",
      colorScheme: "light",
      tokens: {
        "colors.text": "#1e1e1e",
        "colors.surface.default": "#ffffff",
        "colors.surface.alt": "#f1efec",
        "colors.border": "#d9d5cf",
        "colors.primary.default": "#c0261d",
        "colors.primary.on": "#ffffff",
        "colors.muted": "#5a5754",
        "colors.band.dark": "#161616",
        "colors.band.on": "#f1efec",
      },
      fontFamilies: {
        display: {
          stack: "'Barlow Condensed', 'Arial Narrow', sans-serif",
          webFont: { provider: "google", family: "Barlow Condensed", weights: ["500", "600", "700"] },
        },
        sans: {
          stack: "Inter, system-ui, sans-serif",
          webFont: { provider: "google", family: "Inter", weights: ["400", "600", "700"] },
        },
      },
    },
    load: async () => {
      const m = await import("./layouts/pages/autoRepairPage");
      return { build: m.buildAutoRepairPageFragment, pageMeta: m.autoRepairPageMeta };
    },
  },
];

export const layoutRegistry: Record<string, LayoutDefinition> = Object.fromEntries(
  DEFINITIONS.map((def) => [def.id, def]),
);

/** Registra o reemplaza una plantilla (extensión futura / IA). */
export function registerLayout(def: LayoutDefinition): void {
  layoutRegistry[def.id] = def;
  const idx = DEFINITIONS.findIndex((d) => d.id === def.id);
  if (idx >= 0) DEFINITIONS[idx] = def;
  else DEFINITIONS.push(def);
}

export function getLayout(id: string): LayoutDefinition | undefined {
  return layoutRegistry[id];
}

/**
 * Plantilla de **sección** por id, o `undefined` si no existe o es de página.
 * Es el accesor de los caminos **síncronos** (DnD, pick & insert, ghost): ahí
 * solo participan secciones, así que `build()` está garantizado.
 */
export function getSectionLayout(id: string): SectionLayoutDefinition | undefined {
  const layout = layoutRegistry[id];
  return layout?.category === "section" ? layout : undefined;
}

/** Plantilla de **página** por id, o `undefined` si no existe o es de sección. */
export function getPageLayout(id: string): PageLayoutDefinition | undefined {
  const layout = layoutRegistry[id];
  return layout?.category === "page" ? layout : undefined;
}

/**
 * Carga el módulo de una plantilla de página y devuelve su fragmento ya
 * construido junto con la metadata SEO que traiga. `null` si el id no es una
 * plantilla de página o si el módulo/`build()` falla (no lanza: el llamador es
 * UI y debe degradar, no romperse).
 */
export async function loadPageLayout(
  id: string,
): Promise<{ fragment: NodeFragment; pageMeta?: LayoutPageMeta } | null> {
  const layout = getPageLayout(id);
  if (!layout) return null;
  try {
    const mod = await layout.load();
    const result: { fragment: NodeFragment; pageMeta?: LayoutPageMeta } = {
      fragment: mod.build(),
    };
    if (mod.pageMeta !== undefined) result.pageMeta = mod.pageMeta;
    return result;
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn(`[loadPageLayout] no se pudo cargar "${id}":`, err);
    }
    return null;
  }
}

export const LAYOUT_CATEGORIES = ["page", "section"] as const;

/** Plantillas agrupadas por categoría, en orden canónico. */
export function listLayoutsByCategory(): { category: LayoutCategory; layouts: LayoutDefinition[] }[] {
  return LAYOUT_CATEGORIES.map((category) => ({
    category,
    layouts: DEFINITIONS.filter((def) => def.category === category),
  })).filter((group) => group.layouts.length > 0);
}

/**
 * Tipo del nodo raíz del fragmento de una plantilla de **sección** (guardas de
 * DnD y de pick & insert). `undefined` para las de página: nunca se arrastran y
 * su fragmento es perezoso (docs/48 §4).
 */
export function layoutFragmentRootType(layoutId: string): string | undefined {
  const layout = getSectionLayout(layoutId);
  if (!layout) return undefined;
  const fragment = layout.build();
  return fragment.nodes[fragment.rootId]?.type;
}
