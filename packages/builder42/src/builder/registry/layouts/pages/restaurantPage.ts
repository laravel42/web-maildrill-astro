import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, type LayoutPageMeta } from "../helpers";

/**
 * Página "Restaurante" — plantilla de página completa con contenido real
 * (negocio ficticio "Casa Almendro"). Es la plantilla de referencia del
 * lenguaje visual de `docs/43`: la que se usa para juzgar el nivel de acabado
 * del resto.
 *
 * Anatomía (bandas full-bleed, cada una con su `inner` centrado):
 *   topbar oscuro · navbar · hero con foto + doble scrim y dos CTAs ·
 *   tarjeta de datos flotando sobre el hero (margen negativo) · carta en `tabs`
 *   con pestaña seleccionada como pastilla y filas de plato con precio ·
 *   collage del local (grid 2D con `span`) · franja de KPIs sobre degradado ·
 *   3 testimonios · FAQ en `accordion` · reserva (copy + formulario validado) ·
 *   footer oscuro en 3 columnas.
 *
 * Detalles que existen a propósito para demostrar el builder:
 *   - `style.states.selected` del `tabs` (pastilla de la pestaña activa).
 *   - `style.states.hover` en CTAs, filas de plato y tarjetas.
 *   - `layout.gridColumn`/`gridRow` con `span` en el collage.
 *   - `spacing.margin` negativo para solapar la tarjeta de datos con el hero.
 *   - `borderWidth: "0 0 1px"` (multi-valor) como separador de filas.
 *   - behavior `reveal-on-scroll` opt-in en las bandas de contenido.
 *   - `pageMeta` (abajo): `<head>` SEO listo, traducido a en/it.
 */

// --- Vocabulario visual compartido (docs/43) -------------------------------

const SHADOW_CARD = "0 12px 32px rgba(15,23,42,0.08)";
const SHADOW_HOVER = "0 20px 44px rgba(15,23,42,0.18)";
const SHADOW_FLOAT = "0 28px 64px rgba(15,23,42,0.20)";
const BAND_PADDING = "clamp(56px, 9vw, 112px) 20px";
const INNER_MAX = "1200px";
const ACCENT_GRADIENT = "linear-gradient(135deg, var(--colors-primary-default), var(--colors-text))";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true } }];

/** Banda full-bleed: fondo propio + ritmo vertical. */
function band(background: StyleValue, padding: string = BAND_PADDING): NodeStyle {
  return { base: { spacing: { padding }, appearance: { background } } };
}

/** Contenedor interno de una banda: centra y limita el ancho. */
function inner(maxWidth: string = INNER_MAX, gap = "clamp(24px, 4vw, 40px)"): NodeStyle {
  return {
    base: {
      layout: { display: "flex", flexDirection: "column", gap },
      spacing: { margin: "0 auto" },
      size: { width: "100%", maxWidth },
    },
  };
}

/** Kicker sobre el título (mayúsculas escritas en el contenido: el modelo no tiene `textTransform`). */
function eyebrow(color: StyleValue = { token: "colors.primary.default" }): NodeStyle {
  return {
    base: {
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: { token: "typography.sizes.sm" },
        fontWeight: { token: "typography.weights.bold" },
      },
      appearance: { color },
    },
  };
}

/**
 * Título de sección, fluido. Usa la familia de titulares del tema Trattoria
 * (`typography.families.display`, Playfair Display) — el cuerpo sigue en
 * `sans` (Inter), docs/48 §2/§3.2a.
 */
function sectionTitle(color: StyleValue = { token: "colors.text" }): NodeStyle {
  return {
    base: {
      size: { maxWidth: "26ch" },
      typography: {
        fontFamily: { token: "typography.families.display" },
        fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
        fontWeight: { token: "typography.weights.bold" },
        lineHeight: "1.12",
      },
      appearance: { color },
    },
  };
}

/** Cuerpo de texto, fluido y con medida de lectura. */
function bodyText(color: StyleValue = { token: "colors.muted" }, maxWidth = "62ch"): NodeStyle {
  return {
    base: {
      size: { maxWidth },
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
        lineHeight: { token: "typography.lineHeights.normal" },
      },
      appearance: { color },
    },
  };
}

/** Tarjeta elevada (superficie + borde fino + sombra + radio). */
function card(radius = "18px", shadow = SHADOW_CARD): NodeStyle {
  return {
    base: {
      appearance: {
        background: { token: "colors.surface.default" },
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: { token: "colors.border" },
        borderRadius: radius,
        boxShadow: shadow,
      },
    },
  };
}

/** Imagen del collage: ancho fluido, alto por breakpoint, esquinas suaves. */
function galleryImage(base: string, md: string, lg?: string): NodeStyle {
  return {
    base: {
      size: { width: "100%", height: base },
      appearance: { borderRadius: "18px", boxShadow: SHADOW_CARD },
    },
    overrides: {
      md: { size: { height: md } },
      ...(lg ? { lg: { size: { height: lg } } } : {}),
    },
  };
}

/**
 * Fila de plato: nombre + descripción a la izquierda, precio a la derecha,
 * separador inferior salvo en la última (borde multi-valor `0 0 1px`) y hover
 * que tiñe la fila.
 */
function dish(
  id: string,
  content: { name: string; desc: string; price: string; tag?: string },
  opts: { last?: boolean } = {},
): Record<string, BuilderNode> {
  const nodes: Record<string, BuilderNode> = {
    [id]: {
      id,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: { token: "spacing.md" } },
          spacing: { padding: "clamp(14px, 2vw, 20px) clamp(12px, 2vw, 20px)" },
          appearance: {
            borderWidth: opts.last ? "0" : "0 0 1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
            borderRadius: "12px",
          },
        },
        states: { hover: { appearance: { background: { token: "colors.surface.alt" } } } },
      },
      children: [`${id}-copy`, `${id}-price`],
    },
    [`${id}-copy`]: {
      id: `${id}-copy`,
      type: "container",
      props: {},
      style: {
        base: { layout: { display: "flex", flexDirection: "column", gap: "4px" }, size: { maxWidth: "52ch" } },
      },
      children: content.tag ? [`${id}-name`, `${id}-desc`, `${id}-tag`] : [`${id}-name`, `${id}-desc`],
    },
    [`${id}-name`]: {
      id: `${id}-name`,
      type: "text",
      props: { content: content.name },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: "1.0625rem",
            fontWeight: { token: "typography.weights.bold" },
            lineHeight: "1.3",
          },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`${id}-desc`]: {
      id: `${id}-desc`,
      type: "text",
      props: { content: content.desc },
      style: {
        base: {
          typography: { fontSize: { token: "typography.sizes.sm" }, lineHeight: { token: "typography.lineHeights.normal" } },
          appearance: { color: { token: "colors.muted" } },
        },
      },
    },
    [`${id}-price`]: {
      id: `${id}-price`,
      type: "badge",
      props: { label: content.price },
      style: {
        base: {
          layout: { display: "inline-block" },
          spacing: { padding: "6px 14px" },
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: { token: "typography.sizes.sm" },
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: {
            background: { token: "colors.surface.alt" },
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
            borderRadius: "999px",
            color: { token: "colors.primary.default" },
          },
        },
      },
    },
  };

  if (content.tag) {
    nodes[`${id}-tag`] = {
      id: `${id}-tag`,
      type: "badge",
      props: { label: content.tag },
      style: {
        base: {
          layout: { display: "inline-block" },
          spacing: { padding: "4px 10px", margin: "2px 0 0" },
          typography: { fontSize: { token: "typography.sizes.sm" }, fontWeight: { token: "typography.weights.bold" } },
          appearance: {
            background: { token: "colors.primary.default" },
            borderRadius: "999px",
            color: { token: "colors.primary.on" },
          },
        },
      },
    };
  }

  return nodes;
}

/** Tarjeta contenedora de las filas de una pestaña de la carta. */
function menuCard(id: string, rows: string[]): BuilderNode {
  return {
    id,
    type: "container",
    props: {},
    style: {
      base: {
        ...card("20px").base,
        layout: { display: "flex", flexDirection: "column", gap: "0" },
        spacing: { padding: "clamp(8px, 1.5vw, 14px)" },
      },
    },
    children: rows,
  };
}

/** Dato de contacto de la tarjeta flotante: icono + título + detalle. */
function highlight(id: string, icon: string): Record<string, BuilderNode> {
  return {
    [id]: {
      id,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "row", alignItems: "flex-start", gap: { token: "spacing.sm" } },
        },
      },
      children: [`${id}-icon`, `${id}-copy`],
    },
    [`${id}-icon`]: {
      id: `${id}-icon`,
      type: "icon",
      props: { name: icon, pressedName: "", title: "" },
      style: {
        base: {
          size: { width: "22px", height: "22px" },
          appearance: { color: { token: "colors.primary.default" } },
        },
      },
    },
    [`${id}-copy`]: {
      id: `${id}-copy`,
      type: "container",
      props: {},
      style: { base: { layout: { display: "flex", flexDirection: "column", gap: "2px" } } },
      children: [`${id}-title`, `${id}-body`],
    },
    [`${id}-title`]: {
      id: `${id}-title`,
      type: "text",
      props: { content: "" }, // se rellena en el llamador
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: { token: "typography.sizes.base" },
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`${id}-body`]: {
      id: `${id}-body`,
      type: "text",
      props: { content: "" }, // se rellena en el llamador
      style: {
        base: {
          typography: { fontSize: { token: "typography.sizes.sm" }, lineHeight: { token: "typography.lineHeights.normal" } },
          appearance: { color: { token: "colors.muted" } },
        },
      },
    },
  };
}

/** Rellena el copy de un `highlight` (evita repetir el bloque de estilo). */
function withHighlightCopy(
  nodes: Record<string, BuilderNode>,
  id: string,
  title: string,
  body: string,
): Record<string, BuilderNode> {
  nodes[`${id}-title`]!.props = { content: title };
  nodes[`${id}-body`]!.props = { content: body };
  return nodes;
}

/** Testimonio como tarjeta clara sobre la banda de acento. */
function testimonialCard(id: string, props: Record<string, unknown>): BuilderNode {
  return {
    id,
    type: "testimonial",
    props,
    style: {
      base: {
        ...defaultStyleFor("testimonial").base,
        spacing: { padding: "clamp(20px, 3vw, 28px)" },
        appearance: {
          ...defaultStyleFor("testimonial").base.appearance,
          background: { token: "colors.surface.default" },
          borderRadius: "20px",
          boxShadow: SHADOW_FLOAT,
        },
      },
      states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
    },
  };
}

/** Ventaja de la reserva ("✓ …"). */
function perk(id: string, content: string): BuilderNode {
  return {
    id,
    type: "text",
    props: { content },
    style: {
      base: {
        typography: { fontSize: { token: "typography.sizes.base" }, lineHeight: { token: "typography.lineHeights.normal" } },
        appearance: { color: { token: "colors.text" } },
      },
    },
  };
}

/**
 * SEO de la página (docs/42 §2.8): `applyPageLayout` lo escribe en `page.meta`
 * conservando el `slug` del usuario. Traducido a en/it con el mismo modelo de
 * fallback campo a campo que el contenido (`metaTranslations`, docs/12 §B.9).
 */
export const restaurantPageMeta: LayoutPageMeta = {
  title: "Casa Almendro · Cocina de temporada en Madrid",
  description:
    "Restaurante de cocina de temporada en el centro de Madrid. Carta de mercado, vinos seleccionados y reserva de mesa online. Calle del Olmo 14.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Casa Almendro · Cocina de temporada en Madrid",
      description:
        "Carta de mercado que cambia cada semana, vinos seleccionados por nuestro sommelier y reserva de mesa en dos clics.",
      image: "https://images.unsplash.com/photo-1786609900261-2779385423ac?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Casa Almendro · Cocina de temporada en Madrid",
      description: "Carta de mercado, vinos seleccionados y reserva de mesa online en el centro de Madrid.",
      image: "https://images.unsplash.com/photo-1786609900261-2779385423ac?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    en: {
      title: "Casa Almendro · Seasonal cooking in Madrid",
      description:
        "Seasonal restaurant in central Madrid. Market menu, hand-picked wines and online table booking. Calle del Olmo 14.",
      seo: {
        openGraph: {
          title: "Casa Almendro · Seasonal cooking in Madrid",
          description:
            "A market menu that changes every week, wines picked by our sommelier and table booking in two clicks.",
        },
        twitter: {
          title: "Casa Almendro · Seasonal cooking in Madrid",
          description: "Market menu, hand-picked wines and online booking in central Madrid.",
        },
      },
    },
    it: {
      title: "Casa Almendro · Cucina di stagione a Madrid",
      description:
        "Ristorante di cucina di stagione nel centro di Madrid. Menù di mercato, vini selezionati e prenotazione online. Calle del Olmo 14.",
      seo: {
        openGraph: {
          title: "Casa Almendro · Cucina di stagione a Madrid",
          description:
            "Un menù di mercato che cambia ogni settimana, vini scelti dal nostro sommelier e prenotazione in due clic.",
        },
        twitter: {
          title: "Casa Almendro · Cucina di stagione a Madrid",
          description: "Menù di mercato, vini selezionati e prenotazione online nel centro di Madrid.",
        },
      },
    },
  },
};

export function buildRestaurantPageFragment(): NodeFragment {
  const translations: Record<string, NodeTranslations> = {
    // --- Topbar ------------------------------------------------------------
    "restaurant-topbar-hours": {
      en: { content: "Tue–Sun 12:30–16:00 / 20:00–23:30" },
      it: { content: "Mar–Dom 12:30–16:00 / 20:00–23:30" },
    },
    "restaurant-topbar-phone": {
      en: { content: "Bookings +34 912 345 678" },
      it: { content: "Prenotazioni +34 912 345 678" },
    },
    "restaurant-navbar-brand-text": {
      en: { content: "<strong>Casa Almendro</strong>" },
      it: { content: "<strong>Casa Almendro</strong>" },
    },
    // --- Hero --------------------------------------------------------------
    "restaurant-hero-eyebrow": {
      en: { content: "SEASONAL KITCHEN · MADRID" },
      it: { content: "CUCINA DI STAGIONE · MADRID" },
    },
    "restaurant-hero-title": {
      en: { content: "<strong>Market cooking in the heart of the city</strong>" },
      it: { content: "<strong>Cucina di mercato nel cuore della città</strong>" },
    },
    "restaurant-hero-sub": {
      en: { content: "Ingredients from local producers, a menu that changes every week and a wine list curated by our sommelier." },
      it: { content: "Ingredienti da produttori locali, un menù che cambia ogni settimana e una carta dei vini curata dal nostro sommelier." },
    },
    "restaurant-hero-cta": { en: { label: "Book a table" }, it: { label: "Prenota un tavolo" } },
    "restaurant-hero-cta-2": { en: { label: "See the menu" }, it: { label: "Vedi il menù" } },
    "restaurant-hero-rating": { en: { label: "★ 4.8 / 5" }, it: { label: "★ 4,8 / 5" } },
    "restaurant-hero-rating-text": {
      en: { content: "2,400 reviews · Bib Gourmand 2025" },
      it: { content: "2.400 recensioni · Bib Gourmand 2025" },
    },
    // --- Tarjeta de datos flotante ----------------------------------------
    "restaurant-highlight-1-title": { en: { content: "<strong>Opening hours</strong>" }, it: { content: "<strong>Orari</strong>" } },
    "restaurant-highlight-1-body": {
      en: { content: "Tue–Sun · lunch and dinner. Closed Mondays." },
      it: { content: "Mar–Dom · pranzo e cena. Chiuso il lunedì." },
    },
    "restaurant-highlight-2-title": { en: { content: "<strong>Where we are</strong>" }, it: { content: "<strong>Dove siamo</strong>" } },
    "restaurant-highlight-2-body": {
      en: { content: "Calle del Olmo 14, Madrid · Metro Antón Martín" },
      it: { content: "Calle del Olmo 14, Madrid · Metro Antón Martín" },
    },
    "restaurant-highlight-3-title": { en: { content: "<strong>Bookings</strong>" }, it: { content: "<strong>Prenotazioni</strong>" } },
    "restaurant-highlight-3-body": {
      en: { content: "+34 912 345 678 · groups up to 20 people" },
      it: { content: "+34 912 345 678 · gruppi fino a 20 persone" },
    },
    // --- Carta -------------------------------------------------------------
    "restaurant-menu-eyebrow": { en: { content: "THE MENU" }, it: { content: "IL MENÙ" } },
    "restaurant-menu-title": {
      en: { content: "<strong>Today's menu</strong>" },
      it: { content: "<strong>Il menù di oggi</strong>" },
    },
    "restaurant-menu-sub": {
      en: { content: "Three services, one market list. Our team rewrites it every Tuesday with what the market offers." },
      it: { content: "Tre servizi, una lista di mercato. Il nostro team la riscrive ogni martedì con ciò che offre il mercato." },
    },
    "restaurant-menu-note": {
      en: { content: "Allergens available on request. 10% service charge is never added." },
      it: { content: "Allergeni disponibili su richiesta. Non aggiungiamo mai il 10% di servizio." },
    },
    "restaurant-tab-starters": { en: { label: "Starters" }, it: { label: "Antipasti" } },
    "restaurant-tab-mains": { en: { label: "Main courses" }, it: { label: "Piatti principali" } },
    "restaurant-tab-desserts": { en: { label: "Desserts" }, it: { label: "Dolci" } },
    "restaurant-starter-1-name": {
      en: { content: "Burrata with heirloom tomato" },
      it: { content: "Burrata con pomodoro antico" },
    },
    "restaurant-starter-1-desc": {
      en: { content: "Basil oil, sourdough toast and Maldon salt." },
      it: { content: "Olio al basilico, pane a lievitazione naturale e sale Maldon." },
    },
    "restaurant-starter-1-price": { en: { label: "€9.50" }, it: { label: "9,50 €" } },
    "restaurant-starter-2-name": {
      en: { content: "Grilled octopus" },
      it: { content: "Polpo grigliato" },
    },
    "restaurant-starter-2-desc": {
      en: { content: "Paprika potatoes, pickled onion and lemon zest." },
      it: { content: "Patate alla paprika, cipolla marinata e scorza di limone." },
    },
    "restaurant-starter-2-price": { en: { label: "€13.00" }, it: { label: "13,00 €" } },
    "restaurant-main-1-name": {
      en: { content: "Slow-braised oxtail" },
      it: { content: "Coda di bue brasata" },
    },
    "restaurant-main-1-desc": {
      en: { content: "Eight hours of cooking, root vegetables and red wine reduction." },
      it: { content: "Otto ore di cottura, verdure di radice e riduzione al vino rosso." },
    },
    "restaurant-main-1-price": { en: { label: "€18.50" }, it: { label: "18,50 €" } },
    "restaurant-main-1-tag": { en: { label: "Chef's pick" }, it: { label: "Scelta dello chef" } },
    "restaurant-main-2-name": {
      en: { content: "Grilled sea bream" },
      it: { content: "Orata alla griglia" },
    },
    "restaurant-main-2-desc": {
      en: { content: "Lemon, capers and roasted seasonal vegetables." },
      it: { content: "Limone, capperi e verdure di stagione arrostite." },
    },
    "restaurant-main-2-price": { en: { label: "€19.00" }, it: { label: "19,00 €" } },
    "restaurant-main-3-name": {
      en: { content: "Wood-fired aubergine" },
      it: { content: "Melanzana al forno a legna" },
    },
    "restaurant-main-3-desc": {
      en: { content: "Smoked yoghurt, hazelnuts and herb oil. Vegetarian." },
      it: { content: "Yogurt affumicato, nocciole e olio alle erbe. Vegetariano." },
    },
    "restaurant-main-3-price": { en: { label: "€16.00" }, it: { label: "16,00 €" } },
    "restaurant-dessert-1-name": {
      en: { content: "Basque burnt cheesecake" },
      it: { content: "Cheesecake basca al forno" },
    },
    "restaurant-dessert-1-desc": {
      en: { content: "Creamy centre, three-week matured cheese." },
      it: { content: "Cuore cremoso, formaggio maturato tre settimane." },
    },
    "restaurant-dessert-1-price": { en: { label: "€6.50" }, it: { label: "6,50 €" } },
    "restaurant-dessert-2-name": {
      en: { content: "Chocolate fondant" },
      it: { content: "Tortino al cioccolato" },
    },
    "restaurant-dessert-2-desc": {
      en: { content: "72% cocoa with vanilla ice cream." },
      it: { content: "Cacao 72% con gelato alla vaniglia." },
    },
    "restaurant-dessert-2-price": { en: { label: "€7.00" }, it: { label: "7,00 €" } },
    // --- Collage del local -------------------------------------------------
    "restaurant-gallery-eyebrow": { en: { content: "THE PLACE" }, it: { content: "IL LOCALE" } },
    "restaurant-gallery-title": {
      en: { content: "<strong>A dining room built for long dinners</strong>" },
      it: { content: "<strong>Una sala pensata per cene lunghe</strong>" },
    },
    "restaurant-gallery-1": { en: { alt: "Main dining room with warm lighting" }, it: { alt: "Sala principale con luce calda" } },
    "restaurant-gallery-2": { en: { alt: "Open kitchen counter" }, it: { alt: "Bancone della cucina aperta" } },
    "restaurant-gallery-3": { en: { alt: "Wine cellar with selected bottles" }, it: { alt: "Cantina con bottiglie selezionate" } },
    "restaurant-gallery-4": { en: { alt: "Terrace tables on Calle del Olmo" }, it: { alt: "Tavoli in terrazza su Calle del Olmo" } },
    // --- KPIs --------------------------------------------------------------
    "restaurant-stat-1": { en: { value: "18", label: "years open" }, it: { value: "18", label: "anni di attività" } },
    "restaurant-stat-2": { en: { value: "120+", label: "dishes on the menu" }, it: { value: "120+", label: "piatti nel menù" } },
    "restaurant-stat-3": { en: { value: "2.4k", label: "reviews" }, it: { value: "2.4k", label: "recensioni" } },
    // --- Testimonios -------------------------------------------------------
    "restaurant-testimonial": {
      en: { quote: "The best tasting menu I've had in years — every course was a surprise.", name: "Laura Fernández", role: "Regular guest" },
      it: { quote: "Il miglior menù degustazione da anni — ogni piatto era una sorpresa.", name: "Laura Fernández", role: "Ospite abituale" },
    },
    "restaurant-testimonial-2": {
      en: { quote: "We booked for a team dinner and they adapted every dish to our allergies.", name: "Andrés Molina", role: "Group booking" },
      it: { quote: "Abbiamo prenotato per una cena di lavoro e hanno adattato ogni piatto alle nostre allergie.", name: "Andrés Molina", role: "Prenotazione di gruppo" },
    },
    "restaurant-testimonial-3": {
      en: { quote: "The oxtail alone is worth the trip. Service is warm without being stiff.", name: "Chiara Rossi", role: "Food writer" },
      it: { quote: "Vale il viaggio solo per la coda di bue. Servizio caloroso ma non rigido.", name: "Chiara Rossi", role: "Giornalista gastronomica" },
    },
    // --- FAQ ---------------------------------------------------------------
    "restaurant-faq-title": {
      en: { content: "<strong>Before you come</strong>" },
      it: { content: "<strong>Prima di venire</strong>" },
    },
    "restaurant-faq-1": { en: { label: "Do you need a reservation?" }, it: { label: "È necessaria la prenotazione?" } },
    "restaurant-faq-1-text": {
      en: { content: "<p>We recommend booking, especially for dinner and weekends. Walk-ins are welcome if there is availability.</p>" },
      it: { content: "<p>Consigliamo la prenotazione, soprattutto per la cena e nel weekend. Accettiamo anche senza prenotazione se c'è disponibilità.</p>" },
    },
    "restaurant-faq-2": { en: { label: "Do you have options for allergies or intolerances?" }, it: { label: "Avete opzioni per allergie o intolleranze?" } },
    "restaurant-faq-2-text": {
      en: { content: "<p>Yes. Tell us about any allergy or intolerance when booking or when ordering and we'll adapt the dish.</p>" },
      it: { content: "<p>Sì. Segnalate allergie o intolleranze al momento della prenotazione o dell'ordine e adatteremo il piatto.</p>" },
    },
    "restaurant-faq-3": { en: { label: "Is there parking nearby?" }, it: { label: "C'è un parcheggio nelle vicinanze?" } },
    "restaurant-faq-3-text": {
      en: { content: "<p>Yes, there is a public car park 50 metres from the restaurant on Calle del Olmo.</p>" },
      it: { content: "<p>Sì, c'è un parcheggio pubblico a 50 metri dal ristorante in Calle del Olmo.</p>" },
    },
    // --- Reserva -----------------------------------------------------------
    "restaurant-reserve-eyebrow": { en: { content: "BOOKINGS" }, it: { content: "PRENOTAZIONI" } },
    "restaurant-reserve-title": {
      en: { content: "<strong>Book your table</strong>" },
      it: { content: "<strong>Prenota il tuo tavolo</strong>" },
    },
    "restaurant-reserve-sub": {
      en: { content: "Fill in the form and we'll confirm your reservation by phone." },
      it: { content: "Compila il modulo e confermeremo la prenotazione telefonicamente." },
    },
    "restaurant-reserve-perk-1": { en: { content: "✓ Confirmed in under 2 hours" }, it: { content: "✓ Confermata in meno di 2 ore" } },
    "restaurant-reserve-perk-2": { en: { content: "✓ Free cancellation up to 4 hours before" }, it: { content: "✓ Cancellazione gratuita fino a 4 ore prima" } },
    "restaurant-reserve-perk-3": { en: { content: "✓ Tell us about allergies and we'll adapt the menu" }, it: { content: "✓ Segnala le allergie e adatteremo il menù" } },
    "restaurant-reserve-label-name": { en: { text: "Full name" }, it: { text: "Nome completo" } },
    "restaurant-reserve-input-name": { en: { placeholder: "Your name" }, it: { placeholder: "Il tuo nome" } },
    "restaurant-reserve-label-phone": { en: { text: "Phone" }, it: { text: "Telefono" } },
    "restaurant-reserve-input-phone": { en: { placeholder: "+34 600 000 000" }, it: { placeholder: "+34 600 000 000" } },
    "restaurant-reserve-label-guests": { en: { text: "Guests" }, it: { text: "Numero di persone" } },
    "restaurant-reserve-submit": { en: { label: "Confirm booking" }, it: { label: "Conferma la prenotazione" } },
    "restaurant-reserve-note": {
      en: { content: "We only use your details to manage this booking." },
      it: { content: "Usiamo i tuoi dati solo per gestire questa prenotazione." },
    },
    // --- Footer ------------------------------------------------------------
    "restaurant-footer-brand": {
      en: { content: "<strong>Casa Almendro</strong>" },
      it: { content: "<strong>Casa Almendro</strong>" },
    },
    "restaurant-footer-address": {
      en: { content: "Calle del Olmo 14, 28004 Madrid" },
      it: { content: "Calle del Olmo 14, 28004 Madrid" },
    },
    "restaurant-footer-hours-title": {
      en: { content: "<strong>Opening hours</strong>" },
      it: { content: "<strong>Orari di apertura</strong>" },
    },
    "restaurant-footer-hours-body": {
      en: { content: "Tue–Sun: 12:30–16:00 and 20:00–23:30<br/>Closed Mondays" },
      it: { content: "Mar–Dom: 12:30–16:00 e 20:00–23:30<br/>Chiuso il lunedì" },
    },
    "restaurant-footer-contact-title": {
      en: { content: "<strong>Contact</strong>" },
      it: { content: "<strong>Contatti</strong>" },
    },
    "restaurant-footer-contact-body": {
      en: { content: "+34 912 345 678<br/>hola@casaalmendro.example" },
      it: { content: "+34 912 345 678<br/>hola@casaalmendro.example" },
    },
    "restaurant-footer": {
      en: { copyright: "© 2026 Casa Almendro. All rights reserved." },
      it: { copyright: "© 2026 Casa Almendro. Tutti i diritti riservati." },
    },
  };

  return {
    rootId: "restaurant-root",
    translations,
    nodes: {
      // Raíz full-bleed: sin `maxWidth`, cada banda hija pinta su propio fondo
      // de borde a borde (docs/43 §1).
      "restaurant-root": {
        id: "restaurant-root",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
        },
        children: [
          "restaurant-topbar",
          "restaurant-navbar",
          "restaurant-hero",
          "restaurant-highlights",
          "restaurant-menu-section",
          "restaurant-gallery",
          "restaurant-stats",
          "restaurant-testimonial-band",
          "restaurant-faq-section",
          "restaurant-reserve-section",
          "restaurant-footer",
        ],
      },

      // --- Topbar oscuro ---------------------------------------------------
      "restaurant-topbar": {
        id: "restaurant-topbar",
        type: "container",
        props: {},
        style: {
          base: {
            spacing: { padding: "10px 20px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { background: { token: "colors.text" }, color: { token: "colors.surface.default" } },
          },
        },
        children: ["restaurant-topbar-inner"],
      },
      "restaurant-topbar-inner": {
        id: "restaurant-topbar-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" }, alignItems: "flex-start" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: INNER_MAX },
          },
          overrides: {
            md: { layout: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" } },
          },
        },
        children: ["restaurant-topbar-info", "restaurant-topbar-lang"],
      },
      "restaurant-topbar-info": {
        id: "restaurant-topbar-info",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "2px" } },
          overrides: { md: { layout: { flexDirection: "row", gap: { token: "spacing.md" } } } },
        },
        children: ["restaurant-topbar-hours", "restaurant-topbar-phone"],
      },
      "restaurant-topbar-hours": {
        id: "restaurant-topbar-hours",
        type: "text",
        props: { content: "Mar–Dom 12:30–16:00 / 20:00–23:30" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "restaurant-topbar-phone": {
        id: "restaurant-topbar-phone",
        type: "text",
        props: { content: "Reservas +34 912 345 678" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "restaurant-topbar-lang": {
        id: "restaurant-topbar-lang",
        type: "language-nav",
        props: { triggerMode: "text", displayMode: "codes", showCurrent: true, ariaLabel: "Idioma" },
        // Banda oscura: el `defaultStyle` del componente usa `colors.text`.
        style: darkBandStyleFor("language-nav"),
      },

      // --- Navbar ----------------------------------------------------------
      "restaurant-navbar": {
        id: "restaurant-navbar",
        type: "navbar",
        props: { hiddenPageIds: [] },
        style: {
          base: {
            ...defaultStyleFor("navbar").base,
            spacing: { padding: "clamp(14px, 2vw, 20px) 20px" },
            appearance: {
              ...defaultStyleFor("navbar").base.appearance,
              background: { token: "colors.surface.default" },
              borderWidth: "0 0 1px",
              borderStyle: "solid",
              borderColor: { token: "colors.border" },
            },
          },
        },
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
        children: ["restaurant-navbar-brand-text"],
      },
      "restaurant-navbar-brand-text": {
        id: "restaurant-navbar-brand-text",
        type: "text",
        props: { content: "<strong>Casa Almendro</strong>" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "1.375rem",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.2",
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },

      // --- Hero: foto + doble scrim, dos CTAs, prueba social ---------------
      "restaurant-hero": {
        id: "restaurant-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" },
            // Extra de padding inferior: la tarjeta de datos se solapa aquí.
            spacing: { padding: "clamp(72px, 14vw, 140px) 20px clamp(104px, 16vw, 168px)" },
            size: { width: "100%", minHeight: "520px" },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.30) 0%, rgba(15,23,42,0.72) 55%, rgba(15,23,42,0.88) 100%), url('https://images.unsplash.com/photo-1786609900261-2779385423ac?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              color: { token: "colors.surface.default" },
            },
          },
          overrides: {
            md: { size: { minHeight: "660px" } },
            lg: { size: { minHeight: "720px" } },
          },
        },
        children: ["restaurant-hero-inner"],
      },
      "restaurant-hero-inner": {
        id: "restaurant-hero-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: "clamp(14px, 2.5vw, 22px)" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: "900px" },
            typography: { textAlign: "center" },
          },
        },
        children: [
          "restaurant-hero-eyebrow",
          "restaurant-hero-title",
          "restaurant-hero-sub",
          "restaurant-hero-cta-row",
          "restaurant-hero-badges",
        ],
      },
      "restaurant-hero-eyebrow": {
        id: "restaurant-hero-eyebrow",
        type: "text",
        props: { content: "COCINA DE TEMPORADA · MADRID" },
        style: eyebrow({ token: "colors.surface.alt" }),
      },
      "restaurant-hero-title": {
        id: "restaurant-hero-title",
        type: "text",
        props: { content: "<strong>Cocina de mercado en el corazón de la ciudad</strong>" },
        style: {
          base: {
            size: { maxWidth: "20ch" },
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(2.5rem, 7vw, 4.5rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.02",
              textAlign: "center",
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
          overrides: { md: { size: { maxWidth: "24ch" } } },
        },
      },
      "restaurant-hero-sub": {
        id: "restaurant-hero-sub",
        type: "text",
        props: {
          content:
            "Ingredientes de productores locales, una carta que cambia cada semana y una selección de vinos a cargo de nuestro sommelier.",
        },
        style: {
          base: {
            size: { maxWidth: "52ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1.0625rem, 1.8vw, 1.25rem)",
              lineHeight: { token: "typography.lineHeights.normal" },
              textAlign: "center",
            },
            appearance: { color: { token: "colors.surface.alt" } },
          },
        },
      },
      "restaurant-hero-cta-row": {
        id: "restaurant-hero-cta-row",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: { token: "spacing.sm" } },
            size: { width: "100%", maxWidth: "420px" },
          },
          overrides: {
            sm: { layout: { flexDirection: "row", justifyContent: "center", alignItems: "center" }, size: { maxWidth: "none" } },
          },
        },
        children: ["restaurant-hero-cta", "restaurant-hero-cta-2"],
      },
      "restaurant-hero-cta": {
        id: "restaurant-hero-cta",
        type: "button",
        props: { label: "Reservar mesa", link: { kind: "anchor", nodeId: "restaurant-reserve-section" } },
        style: {
          base: {
            ...defaultStyleFor("button").base,
            spacing: { padding: "18px 32px" },
            typography: {
              ...defaultStyleFor("button").base.typography,
              fontSize: "1.0625rem",
              fontWeight: { token: "typography.weights.bold" },
              textAlign: "center",
            },
            appearance: {
              ...defaultStyleFor("button").base.appearance,
              borderRadius: "999px",
              boxShadow: SHADOW_FLOAT,
            },
          },
          states: {
            hover: {
              appearance: { background: { token: "colors.text" }, boxShadow: SHADOW_HOVER },
            },
          },
        },
      },
      "restaurant-hero-cta-2": {
        id: "restaurant-hero-cta-2",
        type: "button",
        props: { label: "Ver la carta", link: { kind: "anchor", nodeId: "restaurant-menu-section" } },
        style: {
          base: {
            ...defaultStyleFor("button").base,
            spacing: { padding: "18px 32px" },
            typography: {
              ...defaultStyleFor("button").base.typography,
              fontSize: "1.0625rem",
              fontWeight: { token: "typography.weights.bold" },
              textAlign: "center",
            },
            appearance: {
              ...defaultStyleFor("button").base.appearance,
              background: "transparent",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.surface.default" },
              borderRadius: "999px",
              color: { token: "colors.surface.default" },
            },
          },
          states: {
            hover: {
              appearance: { background: { token: "colors.surface.default" }, color: { token: "colors.text" } },
            },
          },
        },
      },
      "restaurant-hero-badges": {
        id: "restaurant-hero-badges",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: { token: "spacing.sm" } },
          },
        },
        children: ["restaurant-hero-rating", "restaurant-hero-rating-text"],
      },
      "restaurant-hero-rating": {
        id: "restaurant-hero-rating",
        type: "badge",
        props: { label: "★ 4,8 / 5" },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "6px 14px" },
            typography: { fontSize: { token: "typography.sizes.sm" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              borderRadius: "999px",
              color: { token: "colors.primary.on" },
            },
          },
        },
      },
      "restaurant-hero-rating-text": {
        id: "restaurant-hero-rating-text",
        type: "text",
        props: { content: "2.400 reseñas · Bib Gourmand 2025" },
        style: {
          base: {
            typography: { fontSize: { token: "typography.sizes.sm" } },
            appearance: { color: { token: "colors.surface.alt" } },
          },
        },
      },

      // --- Tarjeta de datos flotante (solapa el hero) ----------------------
      "restaurant-highlights": {
        id: "restaurant-highlights",
        type: "section",
        props: {},
        style: {
          base: {
            spacing: { padding: "0 20px clamp(32px, 5vw, 56px)" },
            appearance: { background: { token: "colors.surface.default" } },
          },
        },
        children: ["restaurant-highlights-card"],
      },
      "restaurant-highlights-card": {
        id: "restaurant-highlights-card",
        type: "container",
        props: {},
        style: {
          base: {
            ...card("22px", SHADOW_FLOAT).base,
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "clamp(18px, 3vw, 32px)" },
            // Margen superior negativo: la tarjeta monta sobre el hero (docs/43 §3).
            spacing: { margin: "clamp(-88px, -9vw, -56px) auto 0", padding: "clamp(20px, 3vw, 32px)" },
            size: { width: "100%", maxWidth: "1080px" },
          },
          overrides: {
            md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } },
          },
        },
        children: ["restaurant-highlight-1", "restaurant-highlight-2", "restaurant-highlight-3"],
      },
      ...withHighlightCopy(
        highlight("restaurant-highlight-1", "Clock"),
        "restaurant-highlight-1",
        "<strong>Horario</strong>",
        "Mar–Dom · comidas y cenas. Lunes cerrado.",
      ),
      ...withHighlightCopy(
        highlight("restaurant-highlight-2", "MapPin"),
        "restaurant-highlight-2",
        "<strong>Dónde estamos</strong>",
        "Calle del Olmo 14, Madrid · Metro Antón Martín",
      ),
      ...withHighlightCopy(
        highlight("restaurant-highlight-3", "Phone"),
        "restaurant-highlight-3",
        "<strong>Reservas</strong>",
        "+34 912 345 678 · grupos hasta 20 personas",
      ),

      // --- Carta del día (tabs con pastilla activa) ------------------------
      "restaurant-menu-section": {
        id: "restaurant-menu-section",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }, "clamp(24px, 4vw, 48px) 20px clamp(56px, 9vw, 112px)"),
        behaviors: REVEAL,
        children: ["restaurant-menu-inner"],
      },
      "restaurant-menu-inner": {
        id: "restaurant-menu-inner",
        type: "container",
        props: {},
        style: inner("960px"),
        children: ["restaurant-menu-head", "restaurant-menu-tabs", "restaurant-menu-note"],
      },
      "restaurant-menu-head": {
        id: "restaurant-menu-head",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["restaurant-menu-eyebrow", "restaurant-menu-title", "restaurant-menu-sub"],
      },
      "restaurant-menu-eyebrow": {
        id: "restaurant-menu-eyebrow",
        type: "text",
        props: { content: "LA CARTA" },
        style: eyebrow(),
      },
      "restaurant-menu-title": {
        id: "restaurant-menu-title",
        type: "text",
        props: { content: "<strong>La carta de hoy</strong>" },
        style: sectionTitle(),
      },
      "restaurant-menu-sub": {
        id: "restaurant-menu-sub",
        type: "text",
        props: {
          content:
            "Tres servicios, una lista de mercado. Nuestro equipo la reescribe cada martes con lo que da el mercado.",
        },
        style: bodyText(),
      },
      "restaurant-menu-tabs": {
        id: "restaurant-menu-tabs",
        type: "tabs",
        props: {},
        style: {
          base: {
            ...defaultStyleFor("tabs").base,
            layout: { display: "flex", flexDirection: "column", gap: "clamp(16px, 2.5vw, 24px)" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.base" } },
          },
          // Pestaña activa como pastilla de acento (`styleSchema.states` del
          // `tabs`, docs/25): el estado seleccionado ES editable por estilo.
          states: {
            selected: {
              spacing: { padding: "10px 20px" },
              appearance: {
                background: { token: "colors.primary.default" },
                borderRadius: "999px",
                color: { token: "colors.primary.on" },
              },
            },
          },
        },
        behaviors: [{ type: "tabs", options: { duration: 220 } }],
        children: ["restaurant-tab-starters", "restaurant-tab-mains", "restaurant-tab-desserts"],
      },
      "restaurant-tab-starters": {
        id: "restaurant-tab-starters",
        type: "tab",
        props: { label: "Entradas" },
        style: defaultStyleFor("tab"),
        children: ["restaurant-starters-card"],
      },
      "restaurant-starters-card": menuCard("restaurant-starters-card", [
        "restaurant-starter-1",
        "restaurant-starter-2",
      ]),
      ...dish("restaurant-starter-1", {
        name: "Burrata con tomate antiguo",
        desc: "Aceite de albahaca, tostada de masa madre y sal Maldon.",
        price: "9,50 €",
      }),
      ...dish(
        "restaurant-starter-2",
        {
          name: "Pulpo a la brasa",
          desc: "Patatas a la paprika, cebolla encurtida y piel de limón.",
          price: "13,00 €",
        },
        { last: true },
      ),
      "restaurant-tab-mains": {
        id: "restaurant-tab-mains",
        type: "tab",
        props: { label: "Platos fuertes" },
        style: defaultStyleFor("tab"),
        children: ["restaurant-mains-card"],
      },
      "restaurant-mains-card": menuCard("restaurant-mains-card", [
        "restaurant-main-1",
        "restaurant-main-2",
        "restaurant-main-3",
      ]),
      ...dish("restaurant-main-1", {
        name: "Rabo de toro estofado",
        desc: "Ocho horas de cocción, verduras de raíz y reducción de vino rojo.",
        price: "18,50 €",
        tag: "Recomendación del chef",
      }),
      ...dish("restaurant-main-2", {
        name: "Dorada a la brasa",
        desc: "Limón, alcaparras y verduras de temporada asadas.",
        price: "19,00 €",
      }),
      ...dish(
        "restaurant-main-3",
        {
          name: "Berenjena al horno de leña",
          desc: "Yogur ahumado, avellanas y aceite de hierbas. Vegetariano.",
          price: "16,00 €",
        },
        { last: true },
      ),
      "restaurant-tab-desserts": {
        id: "restaurant-tab-desserts",
        type: "tab",
        props: { label: "Postres" },
        style: defaultStyleFor("tab"),
        children: ["restaurant-desserts-card"],
      },
      "restaurant-desserts-card": menuCard("restaurant-desserts-card", [
        "restaurant-dessert-1",
        "restaurant-dessert-2",
      ]),
      ...dish("restaurant-dessert-1", {
        name: "Tarta de queso vasca",
        desc: "Centro cremoso, queso madurado tres semanas.",
        price: "6,50 €",
      }),
      ...dish(
        "restaurant-dessert-2",
        {
          name: "Fondant de chocolate",
          desc: "Cacao 72% con helado de vainilla.",
          price: "7,00 €",
        },
        { last: true },
      ),
      "restaurant-menu-note": {
        id: "restaurant-menu-note",
        type: "text",
        props: { content: "Alérgenos disponibles bajo petición. Nunca añadimos 10% de servicio." },
        style: {
          base: {
            typography: { fontSize: { token: "typography.sizes.sm" } },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },

      // --- Collage del local (grid 2D con span) ----------------------------
      "restaurant-gallery": {
        id: "restaurant-gallery",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["restaurant-gallery-inner"],
      },
      "restaurant-gallery-inner": {
        id: "restaurant-gallery-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["restaurant-gallery-head", "restaurant-gallery-grid"],
      },
      "restaurant-gallery-head": {
        id: "restaurant-gallery-head",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["restaurant-gallery-eyebrow", "restaurant-gallery-title"],
      },
      "restaurant-gallery-eyebrow": {
        id: "restaurant-gallery-eyebrow",
        type: "text",
        props: { content: "EL LOCAL" },
        style: eyebrow(),
      },
      "restaurant-gallery-title": {
        id: "restaurant-gallery-title",
        type: "text",
        props: { content: "<strong>Una sala pensada para cenas largas</strong>" },
        style: sectionTitle(),
      },
      "restaurant-gallery-grid": {
        id: "restaurant-gallery-grid",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "clamp(12px, 2vw, 20px)" },
          },
          overrides: {
            md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } },
          },
        },
        children: [
          "restaurant-gallery-1",
          "restaurant-gallery-2",
          "restaurant-gallery-3",
          "restaurant-gallery-4",
        ],
      },
      "restaurant-gallery-1": {
        id: "restaurant-gallery-1",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1613274554329-70f997f5789f?w=1200&q=80&auto=format&fit=crop" },
          alt: "Sala principal con luz cálida",
          objectFit: "cover",
          loading: "lazy",
        },
        style: {
          base: {
            ...galleryImage("240px", "420px").base,
          },
          overrides: {
            // Ocupa 2 columnas y 2 filas del grid a partir de `md`
            // (`layout.gridColumn`/`gridRow`, colocación explícita 2D).
            md: { layout: { gridColumn: "span 2", gridRow: "span 2" }, size: { height: "420px" } },
            lg: { size: { height: "480px" } },
          },
        },
      },
      "restaurant-gallery-2": {
        id: "restaurant-gallery-2",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1622021142947-da7dedc7c39a?w=800&q=80&auto=format&fit=crop" },
          alt: "Barra de la cocina abierta",
          objectFit: "cover",
          loading: "lazy",
        },
        style: galleryImage("200px", "200px", "230px"),
      },
      "restaurant-gallery-3": {
        id: "restaurant-gallery-3",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1578911373434-0cb395d2cbfb?w=800&q=80&auto=format&fit=crop" },
          alt: "Bodega con botellas seleccionadas",
          objectFit: "cover",
          loading: "lazy",
        },
        style: galleryImage("200px", "200px", "230px"),
      },
      "restaurant-gallery-4": {
        id: "restaurant-gallery-4",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1782215923072-e9988432bf5e?w=1200&q=80&auto=format&fit=crop" },
          alt: "Mesas de la terraza en la calle del Olmo",
          objectFit: "cover",
          loading: "lazy",
        },
        style: {
          base: { ...galleryImage("200px", "200px").base },
          overrides: {
            md: { layout: { gridColumn: "span 3" }, size: { height: "220px" } },
            lg: { size: { height: "260px" } },
          },
        },
      },

      // --- KPIs sobre banda oscura ----------------------------------------
      "restaurant-stats": {
        id: "restaurant-stats",
        type: "section",
        props: {},
        style: band("linear-gradient(120deg, var(--colors-text), var(--colors-primary-default))", "clamp(40px, 7vw, 80px) 20px"),
        behaviors: REVEAL,
        children: ["restaurant-stats-inner"],
      },
      "restaurant-stats-inner": {
        id: "restaurant-stats-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "clamp(20px, 3vw, 32px)", alignItems: "center" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: "960px" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } } },
        },
        children: ["restaurant-stat-1", "restaurant-stat-2", "restaurant-stat-3"],
      },
      "restaurant-stat-1": {
        id: "restaurant-stat-1",
        type: "stat",
        props: { value: "18", label: "años abiertos" },
        style: {
          base: {
            ...defaultStyleFor("stat").base,
            // El valor del `stat` es `2.75em`: subir el `fontSize` del root
            // escala el número sin tocar el componente.
            typography: { ...defaultStyleFor("stat").base.typography, fontSize: "clamp(1rem, 1.6vw, 1.25rem)" },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "restaurant-stat-2": {
        id: "restaurant-stat-2",
        type: "stat",
        props: { value: "120+", label: "platos en carta" },
        style: {
          base: {
            ...defaultStyleFor("stat").base,
            typography: { ...defaultStyleFor("stat").base.typography, fontSize: "clamp(1rem, 1.6vw, 1.25rem)" },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "restaurant-stat-3": {
        id: "restaurant-stat-3",
        type: "stat",
        props: { value: "2.4k", label: "reseñas" },
        style: {
          base: {
            ...defaultStyleFor("stat").base,
            typography: { ...defaultStyleFor("stat").base.typography, fontSize: "clamp(1rem, 1.6vw, 1.25rem)" },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },

      // --- Testimonios sobre degradado de acento --------------------------
      "restaurant-testimonial-band": {
        id: "restaurant-testimonial-band",
        type: "section",
        props: {},
        style: band(ACCENT_GRADIENT),
        behaviors: REVEAL,
        children: ["restaurant-testimonial-inner"],
      },
      "restaurant-testimonial-inner": {
        id: "restaurant-testimonial-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "clamp(16px, 2.5vw, 24px)", alignItems: "stretch" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: INNER_MAX },
          },
          overrides: {
            md: { layout: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } },
            lg: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } },
          },
        },
        children: ["restaurant-testimonial", "restaurant-testimonial-2", "restaurant-testimonial-3"],
      },
      "restaurant-testimonial": testimonialCard("restaurant-testimonial", {
        quote: "El mejor menú degustación que he probado en años, cada plato fue una sorpresa.",
        name: "Laura Fernández",
        role: "Clienta habitual",
        initials: "LF",
      }),
      "restaurant-testimonial-2": testimonialCard("restaurant-testimonial-2", {
        quote: "Reservamos para una cena de equipo y adaptaron cada plato a nuestras alergias.",
        name: "Andrés Molina",
        role: "Reserva de grupo",
        initials: "AM",
      }),
      "restaurant-testimonial-3": testimonialCard("restaurant-testimonial-3", {
        quote: "Solo por el rabo de toro merece el viaje. El servicio es cercano sin ser rígido.",
        name: "Chiara Rossi",
        role: "Periodista gastronómica",
        initials: "CR",
      }),

      // --- FAQ -------------------------------------------------------------
      "restaurant-faq-section": {
        id: "restaurant-faq-section",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        children: ["restaurant-faq-inner"],
      },
      "restaurant-faq-inner": {
        id: "restaurant-faq-inner",
        type: "container",
        props: {},
        style: inner("820px", "clamp(20px, 3vw, 28px)"),
        children: ["restaurant-faq-title", "restaurant-faq"],
      },
      "restaurant-faq-title": {
        id: "restaurant-faq-title",
        type: "text",
        props: { content: "<strong>Antes de venir</strong>" },
        style: sectionTitle(),
      },
      "restaurant-faq": {
        id: "restaurant-faq",
        type: "accordion",
        props: {},
        style: {
          base: {
            ...defaultStyleFor("accordion").base,
            appearance: {
              ...defaultStyleFor("accordion").base.appearance,
              background: { token: "colors.surface.default" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.border" },
              borderRadius: "18px",
              boxShadow: SHADOW_CARD,
            },
            spacing: { padding: "clamp(8px, 1.5vw, 16px)" },
          },
        },
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["restaurant-faq-1", "restaurant-faq-2", "restaurant-faq-3"],
      },
      "restaurant-faq-1": {
        id: "restaurant-faq-1",
        type: "accordion-item",
        props: { label: "¿Hace falta reservar?", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["restaurant-faq-1-text"],
      },
      "restaurant-faq-1-text": {
        id: "restaurant-faq-1-text",
        type: "text",
        props: { content: "<p>Recomendamos reservar, sobre todo para cenas y fines de semana. Aceptamos clientes sin reserva si hay disponibilidad.</p>" },
        style: bodyText(),
      },
      "restaurant-faq-2": {
        id: "restaurant-faq-2",
        type: "accordion-item",
        props: { label: "¿Tienen opciones para alergias o intolerancias?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["restaurant-faq-2-text"],
      },
      "restaurant-faq-2-text": {
        id: "restaurant-faq-2-text",
        type: "text",
        props: { content: "<p>Sí. Indícanos cualquier alergia o intolerancia al reservar o al pedir y adaptamos el plato.</p>" },
        style: bodyText(),
      },
      "restaurant-faq-3": {
        id: "restaurant-faq-3",
        type: "accordion-item",
        props: { label: "¿Hay estacionamiento cerca?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["restaurant-faq-3-text"],
      },
      "restaurant-faq-3-text": {
        id: "restaurant-faq-3-text",
        type: "text",
        props: { content: "<p>Sí, hay un estacionamiento público a 50 metros del restaurante, en la calle del Olmo.</p>" },
        style: bodyText(),
      },

      // --- Reserva ---------------------------------------------------------
      "restaurant-reserve-section": {
        id: "restaurant-reserve-section",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["restaurant-reserve-inner"],
      },
      "restaurant-reserve-inner": {
        id: "restaurant-reserve-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "clamp(24px, 4vw, 48px)", alignItems: "center" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: INNER_MAX },
          },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 1fr) minmax(0, 420px)" } } },
        },
        children: ["restaurant-reserve-copy", "restaurant-reserve-form"],
      },
      "restaurant-reserve-copy": {
        id: "restaurant-reserve-copy",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } } },
        children: [
          "restaurant-reserve-eyebrow",
          "restaurant-reserve-title",
          "restaurant-reserve-sub",
          "restaurant-reserve-perks",
        ],
      },
      "restaurant-reserve-eyebrow": {
        id: "restaurant-reserve-eyebrow",
        type: "text",
        props: { content: "RESERVAS" },
        style: eyebrow(),
      },
      "restaurant-reserve-title": {
        id: "restaurant-reserve-title",
        type: "text",
        props: { content: "<strong>Reserva tu mesa</strong>" },
        style: sectionTitle(),
      },
      "restaurant-reserve-sub": {
        id: "restaurant-reserve-sub",
        type: "text",
        props: { content: "Completa el formulario y confirmaremos tu reserva por teléfono." },
        style: bodyText(),
      },
      "restaurant-reserve-perks": {
        id: "restaurant-reserve-perks",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } },
            spacing: { margin: "clamp(4px, 1vw, 8px) 0 0" },
          },
        },
        children: [
          "restaurant-reserve-perk-1",
          "restaurant-reserve-perk-2",
          "restaurant-reserve-perk-3",
        ],
      },
      "restaurant-reserve-perk-1": perk("restaurant-reserve-perk-1", "✓ Confirmación en menos de 2 horas"),
      "restaurant-reserve-perk-2": perk("restaurant-reserve-perk-2", "✓ Cancelación gratuita hasta 4 horas antes"),
      "restaurant-reserve-perk-3": perk("restaurant-reserve-perk-3", "✓ Cuéntanos tus alergias y adaptamos la carta"),
      "restaurant-reserve-form": {
        id: "restaurant-reserve-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: {
          base: {
            ...defaultStyleFor("form").base,
            layout: { display: "flex", flexDirection: "column", gap: "clamp(10px, 1.6vw, 14px)" },
            spacing: { padding: "clamp(20px, 3vw, 32px)" },
            size: { width: "100%" },
            appearance: {
              ...defaultStyleFor("form").base.appearance,
              background: { token: "colors.surface.default" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.border" },
              borderRadius: "22px",
              boxShadow: SHADOW_FLOAT,
            },
          },
        },
        children: [
          "restaurant-reserve-label-name",
          "restaurant-reserve-input-name",
          "restaurant-reserve-label-phone",
          "restaurant-reserve-input-phone",
          "restaurant-reserve-label-guests",
          "restaurant-reserve-select-guests",
          "restaurant-reserve-submit",
          "restaurant-reserve-note",
        ],
        behaviors: [{ type: "form-validation", options: {} }],
      },
      "restaurant-reserve-label-name": {
        id: "restaurant-reserve-label-name",
        type: "label",
        props: { text: "Nombre completo", for: "restaurant-reserve-input-name" },
        style: defaultStyleFor("label"),
      },
      "restaurant-reserve-input-name": {
        id: "restaurant-reserve-input-name",
        type: "input",
        props: { name: "name", placeholder: "Tu nombre", type: "text", required: true, disabled: false },
        style: {
          base: {
            ...defaultStyleFor("input").base,
            spacing: { padding: "14px 16px" },
            size: { width: "100%" },
            appearance: { ...defaultStyleFor("input").base.appearance, borderRadius: "12px" },
          },
        },
      },
      "restaurant-reserve-label-phone": {
        id: "restaurant-reserve-label-phone",
        type: "label",
        props: { text: "Teléfono", for: "restaurant-reserve-input-phone" },
        style: defaultStyleFor("label"),
      },
      "restaurant-reserve-input-phone": {
        id: "restaurant-reserve-input-phone",
        type: "input",
        props: { name: "phone", placeholder: "+34 600 000 000", type: "tel", required: true, disabled: false },
        style: {
          base: {
            ...defaultStyleFor("input").base,
            spacing: { padding: "14px 16px" },
            size: { width: "100%" },
            appearance: { ...defaultStyleFor("input").base.appearance, borderRadius: "12px" },
          },
        },
      },
      "restaurant-reserve-label-guests": {
        id: "restaurant-reserve-label-guests",
        type: "label",
        props: { text: "Número de personas", for: "restaurant-reserve-select-guests" },
        style: defaultStyleFor("label"),
      },
      "restaurant-reserve-select-guests": {
        id: "restaurant-reserve-select-guests",
        type: "select",
        props: {
          options: [
            { label: "2 personas", value: "2" },
            { label: "4 personas", value: "4" },
            { label: "6 personas", value: "6" },
            { label: "8 o más", value: "8+" },
          ],
          name: "guests",
          placeholder: "Selecciona",
          ariaLabel: "Número de personas",
        },
        style: {
          base: {
            ...defaultStyleFor("select").base,
            size: { width: "100%" },
            appearance: { ...defaultStyleFor("select").base.appearance, borderRadius: "12px" },
          },
        },
      },
      "restaurant-reserve-submit": {
        id: "restaurant-reserve-submit",
        type: "button-submit",
        props: { label: "Confirmar reserva", disabled: false },
        style: {
          base: {
            ...defaultStyleFor("button-submit").base,
            spacing: { padding: "16px 24px", margin: "clamp(4px, 1vw, 8px) 0 0" },
            size: { width: "100%" },
            typography: {
              ...defaultStyleFor("button-submit").base.typography,
              fontSize: "1.0625rem",
              fontWeight: { token: "typography.weights.bold" },
              textAlign: "center",
            },
            appearance: {
              ...defaultStyleFor("button-submit").base.appearance,
              background: ACCENT_GRADIENT,
              borderRadius: "999px",
              color: { token: "colors.primary.on" },
              boxShadow: SHADOW_CARD,
            },
          },
          states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
        },
      },
      "restaurant-reserve-note": {
        id: "restaurant-reserve-note",
        type: "text",
        props: { content: "Solo usamos tus datos para gestionar esta reserva." },
        style: {
          base: {
            typography: { fontSize: { token: "typography.sizes.sm" }, textAlign: "center" },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },

      // --- Footer oscuro en 3 columnas ------------------------------------
      "restaurant-footer": {
        id: "restaurant-footer",
        type: "footer",
        props: { copyright: "© 2026 Casa Almendro. Todos los derechos reservados." },
        style: {
          base: {
            ...defaultStyleFor("footer").base,
            spacing: { padding: "clamp(48px, 7vw, 80px) 20px clamp(28px, 4vw, 40px)" },
            appearance: {
              ...defaultStyleFor("footer").base.appearance,
              background: { token: "colors.text" },
              color: { token: "colors.surface.default" },
            },
          },
        },
        children: ["restaurant-footer-inner"],
      },
      "restaurant-footer-inner": {
        id: "restaurant-footer-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "clamp(24px, 4vw, 40px)" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: INNER_MAX },
          },
        },
        children: ["restaurant-footer-cols"],
      },
      "restaurant-footer-cols": {
        id: "restaurant-footer-cols",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "clamp(24px, 4vw, 40px)" },
            spacing: { padding: "0 0 clamp(20px, 3vw, 28px)" },
            appearance: { borderWidth: "0 0 1px", borderStyle: "solid", borderColor: { token: "colors.muted" } },
          },
          overrides: {
            md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } },
          },
        },
        children: [
          "restaurant-footer-address-col",
          "restaurant-footer-hours-col",
          "restaurant-footer-contact-col",
        ],
      },
      "restaurant-footer-address-col": {
        id: "restaurant-footer-address-col",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["restaurant-footer-brand", "restaurant-footer-address"],
      },
      "restaurant-footer-brand": {
        id: "restaurant-footer-brand",
        type: "text",
        props: { content: "<strong>Casa Almendro</strong>" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "1.25rem",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "restaurant-footer-address": {
        id: "restaurant-footer-address",
        type: "text",
        props: { content: "Calle del Olmo 14, 28004 Madrid" },
        style: { base: { appearance: { color: { token: "colors.surface.alt" } } } },
      },
      "restaurant-footer-hours-col": {
        id: "restaurant-footer-hours-col",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["restaurant-footer-hours-title", "restaurant-footer-hours-body"],
      },
      "restaurant-footer-hours-title": {
        id: "restaurant-footer-hours-title",
        type: "text",
        props: { content: "<strong>Horario</strong>" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "restaurant-footer-hours-body": {
        id: "restaurant-footer-hours-body",
        type: "text",
        props: { content: "Mar–Dom: 12:30–16:00 y 20:00–23:30<br/>Lunes cerrado" },
        style: { base: { appearance: { color: { token: "colors.surface.alt" } } } },
      },
      "restaurant-footer-contact-col": {
        id: "restaurant-footer-contact-col",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" }, alignItems: "flex-start" } } },
        children: [
          "restaurant-footer-contact-title",
          "restaurant-footer-contact-body",
          "restaurant-footer-social",
        ],
      },
      "restaurant-footer-contact-title": {
        id: "restaurant-footer-contact-title",
        type: "text",
        props: { content: "<strong>Contacto</strong>" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "restaurant-footer-contact-body": {
        id: "restaurant-footer-contact-body",
        type: "text",
        props: { content: "+34 912 345 678<br/>hola@casaalmendro.example" },
        style: { base: { appearance: { color: { token: "colors.surface.alt" } } } },
      },
      "restaurant-footer-social": {
        id: "restaurant-footer-social",
        type: "social-links",
        props: {},
        // Banda oscura: los glifos deben ir en claro (docs/43 §3).
        style: darkBandStyleFor("social-links"),
      },
    },
  };
}
