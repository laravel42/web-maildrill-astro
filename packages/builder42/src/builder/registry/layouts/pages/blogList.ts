import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, type LayoutPageMeta } from "../helpers";

/**
 * Página "Blog" — REESCRITA (docs/48 §2 fila 9, F3) como plantilla de sector:
 * editorial / podcast ("Sobremesa", revista y podcast de cultura gastronómica
 * hispanohablante). Conserva su `id` ("blog-list") — un sitio guardado que la
 * referencie sigue funcionando — pero el contenido, el arquetipo y el tema
 * son enteramente nuevos.
 *
 * Arquetipo A3 (docs/48 §2) — Editorial / magazine: tipografía DOMINANTE
 * (Fraunces, con tamaños grandes en titulares), grid de ANCHOS DESIGUALES
 * (no todas las tarjetas del mismo tamaño — el primer artículo ocupa 2
 * columnas, el resto 1), y poca imagen — el peso visual lo lleva el texto,
 * a diferencia de A9/A9b (imagen protagonista) o A6 (producto).
 *
 * Tema "Roast" (crema/marrón, docs/48 §2): tipografía Fraunces — serif
 * contemporánea con mucho carácter, propia de revistas y newsletters.
 *
 * Showcase funcional: `marquee` (franja de temas/categorías en scroll
 * continuo), `expandable` (extracto largo del artículo destacado con "Ver
 * más"), `quote` (cita destacada de un episodio).
 *
 * Anatomía: navbar · hero editorial · franja de categorías en `marquee` ·
 * grid de artículos/episodios de anchos desiguales (destacado 2 columnas +
 * `expandable` en su extracto, resto 1 columna) · cita destacada (`quote`) ·
 * sección de hosts/autores · newsletter · footer oscuro.
 *
 * Todos los ids con prefijo `editorial-` (sin colisión con otras plantillas).
 */

const SHADOW_CARD = "0 12px 32px rgba(59,33,17,0.10)";
const SHADOW_HOVER = "0 20px 44px rgba(59,33,17,0.18)";
const BAND_PADDING = "clamp(56px, 9vw, 112px) 20px";
const INNER_MAX = "1140px";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true } }];

function band(background: StyleValue, padding: string = BAND_PADDING): NodeStyle {
  return { base: { spacing: { padding }, appearance: { background } } };
}

function inner(maxWidth: string = INNER_MAX, gap = "clamp(24px, 4vw, 40px)"): NodeStyle {
  return {
    base: {
      layout: { display: "flex", flexDirection: "column", gap },
      spacing: { margin: "0 auto" },
      size: { width: "100%", maxWidth },
    },
  };
}

/** Titular editorial: Fraunces (familia `display`), tamaño dominante. */
function editorialTitle(color: StyleValue = { token: "colors.text" }, size = "clamp(1.75rem, 4vw, 2.75rem)"): NodeStyle {
  return {
    base: {
      size: { maxWidth: "26ch" },
      typography: {
        fontFamily: { token: "typography.families.display" },
        fontSize: size,
        fontWeight: { token: "typography.weights.bold" },
        lineHeight: "1.12",
      },
      appearance: { color },
    },
  };
}

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

function card(radius = "16px", shadow = SHADOW_CARD): NodeStyle {
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

/** Artículo/episodio de ancho normal (grid A3: anchos desiguales). */
function articleCard(n: number, kicker: string, title: string, excerpt: string, date: string, imageUrl: string, alt: string) {
  return {
    [`editorial-article-${n}`]: {
      id: `editorial-article-${n}`,
      type: "card",
      props: {},
      style: {
        base: {
          ...card().base,
          layout: { display: "flex", flexDirection: "column", gap: "10px" },
          spacing: { padding: "0" },
        },
        states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
      },
      children: [`editorial-article-${n}-img`, `editorial-article-${n}-body`],
    },
    [`editorial-article-${n}-img`]: {
      id: `editorial-article-${n}-img`,
      type: "image",
      props: { source: { kind: "url", url: imageUrl }, alt, objectFit: "cover" },
      style: {
        base: { size: { width: "100%", height: "200px" }, appearance: { borderRadius: "16px 16px 0 0" } },
        overrides: { md: { size: { height: "220px" } } },
      },
    },
    [`editorial-article-${n}-body`]: {
      id: `editorial-article-${n}-body`,
      type: "container",
      props: {},
      style: { base: { layout: { display: "flex", flexDirection: "column", gap: "8px" }, spacing: { padding: "clamp(16px, 2.5vw, 22px)" } } },
      // Showcase `expandable` (docs/48 §2): solo el destacado (n=1, arquetipo
      // A3 le da 2 columnas de ancho) colapsa su cuerpo con "Ver más" — el
      // resto de tarjetas del grid son más cortas y no lo necesitan.
      behaviors: n === 1 ? [{ type: "expandable", options: { collapsedHeight: 140, expandLabel: "Ver más", collapseLabel: "Ver menos", fade: true } }] : undefined,
      children: [`editorial-article-${n}-kicker`, `editorial-article-${n}-title`, `editorial-article-${n}-excerpt`, `editorial-article-${n}-date`],
    },
    [`editorial-article-${n}-kicker`]: {
      id: `editorial-article-${n}-kicker`,
      type: "text",
      props: { content: kicker },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: { token: "typography.sizes.sm" },
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: { color: { token: "colors.primary.default" } },
        },
      },
    },
    [`editorial-article-${n}-title`]: {
      id: `editorial-article-${n}-title`,
      type: "text",
      props: { content: `<strong>${title}</strong>` },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.display" },
            fontSize: "1.375rem",
            lineHeight: "1.2",
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`editorial-article-${n}-excerpt`]: {
      id: `editorial-article-${n}-excerpt`,
      type: "text",
      props: { content: excerpt },
      style: { base: { size: { maxWidth: "48ch" }, appearance: { color: { token: "colors.muted" } } } },
    },
    [`editorial-article-${n}-date`]: {
      id: `editorial-article-${n}-date`,
      type: "text",
      props: { content: date },
      style: { base: { typography: { fontSize: { token: "typography.sizes.sm" } }, appearance: { color: { token: "colors.muted" } } } },
    },
  };
}

function marqueeTopic(n: 1 | 2 | 3 | 4 | 5 | 6, label: string) {
  return {
    [`editorial-topic-${n}`]: {
      id: `editorial-topic-${n}`,
      type: "text",
      props: { content: label },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.display" },
            fontSize: "1.5rem",
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: { color: { token: "colors.band.on" } },
        },
      },
    },
  };
}

function hostCard(n: 1 | 2, name: string, role: string, imageUrl: string) {
  return {
    [`editorial-host-${n}`]: {
      id: `editorial-host-${n}`,
      type: "container",
      props: {},
      style: {
        base: { layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" } },
      },
      children: [`editorial-host-${n}-avatar`, `editorial-host-${n}-name`, `editorial-host-${n}-role`],
    },
    [`editorial-host-${n}-avatar`]: {
      id: `editorial-host-${n}-avatar`,
      type: "avatar",
      props: { source: { kind: "url", url: imageUrl }, alt: name, initials: name.slice(0, 2).toUpperCase() },
      style: { base: { size: { width: "96px", height: "96px" } } },
    },
    [`editorial-host-${n}-name`]: {
      id: `editorial-host-${n}-name`,
      type: "text",
      props: { content: `<strong>${name}</strong>` },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.display" }, fontSize: "1.125rem", fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`editorial-host-${n}-role`]: {
      id: `editorial-host-${n}-role`,
      type: "text",
      props: { content: role },
      style: { base: { typography: { fontSize: { token: "typography.sizes.sm" }, textAlign: "center" }, appearance: { color: { token: "colors.muted" } } } },
    },
  };
}

export function buildBlogListFragment(): NodeFragment {
  return {
    rootId: "editorial-root",
    nodes: {
      "editorial-root": {
        id: "editorial-root",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "stretch" } } },
        children: [
          "editorial-navbar",
          "editorial-hero",
          "editorial-topics-marquee",
          "editorial-articles",
          "editorial-quote",
          "editorial-hosts",
          "editorial-newsletter",
          "editorial-footer",
        ],
      },

      // --- Navbar --------------------------------------------------------
      "editorial-navbar": {
        id: "editorial-navbar",
        type: "navbar",
        props: { brand: "Sobremesa", hiddenPageIds: [] },
        style: {
          base: {
            ...defaultStyleFor("navbar").base,
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
        children: ["editorial-navbar-lang"],
      },
      "editorial-navbar-lang": {
        id: "editorial-navbar-lang",
        type: "language-nav",
        props: { triggerMode: "text", displayMode: "codes", showCurrent: true, ariaLabel: "Idioma" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Hero editorial (tipografía dominante, sin foto a sangre) ------
      "editorial-hero": {
        id: "editorial-hero",
        type: "hero",
        props: {},
        style: band("linear-gradient(160deg, var(--colors-surface-alt) 0%, var(--colors-surface-default) 70%)", "clamp(64px, 10vw, 128px) 20px"),
        children: ["editorial-hero-inner"],
      },
      "editorial-hero-inner": {
        id: "editorial-hero-inner",
        type: "container",
        props: {},
        style: inner("820px", "clamp(16px, 3vw, 24px)"),
        children: ["editorial-hero-kicker", "editorial-hero-title", "editorial-hero-sub"],
      },
      "editorial-hero-kicker": {
        id: "editorial-hero-kicker",
        type: "text",
        props: { content: "REVISTA Y PODCAST DE CULTURA GASTRONÓMICA" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.primary.default" } },
          },
        },
      },
      "editorial-hero-title": {
        id: "editorial-hero-title",
        type: "text",
        props: { content: "<strong>Historias que se cuentan mejor con la mesa puesta</strong>" },
        style: {
          base: {
            size: { maxWidth: "22ch" },
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(2.25rem, 6vw, 4rem)",
              lineHeight: "1.05",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "editorial-hero-sub": {
        id: "editorial-hero-sub",
        type: "text",
        props: { content: "Cada semana, un plato, una conversación y la gente detrás de la mesa. Nueva temporada disponible." },
        style: bodyText(),
      },

      // --- Franja de categorías en marquee (showcase) ---------------------
      "editorial-topics-marquee": {
        id: "editorial-topics-marquee",
        type: "logo-cloud",
        props: {},
        style: {
          base: {
            ...defaultStyleFor("logo-cloud").base,
            layout: { display: "flex", flexWrap: "nowrap", alignItems: "center", gap: "clamp(24px, 5vw, 48px)" },
            spacing: { padding: "clamp(20px, 3vw, 28px) 0" },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
        },
        behaviors: [{ type: "marquee", options: { duration: 24, direction: "left", pauseOnHover: true } }],
        children: [
          "editorial-topic-1",
          "editorial-topic-2",
          "editorial-topic-3",
          "editorial-topic-4",
          "editorial-topic-5",
          "editorial-topic-6",
        ],
      },
      ...marqueeTopic(1, "Cocina de mercado"),
      ...marqueeTopic(2, "Vino natural"),
      ...marqueeTopic(3, "Fermentación"),
      ...marqueeTopic(4, "Cocina de migración"),
      ...marqueeTopic(5, "Sobremesa con chefs"),
      ...marqueeTopic(6, "Recetas de la abuela"),

      // --- Grid editorial de anchos desiguales (arquetipo A3) --------------
      "editorial-articles": {
        id: "editorial-articles",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["editorial-articles-inner"],
      },
      "editorial-articles-inner": {
        id: "editorial-articles-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["editorial-articles-title", "editorial-articles-grid"],
      },
      "editorial-articles-title": {
        id: "editorial-articles-title",
        type: "text",
        props: { content: "<strong>Últimos episodios y artículos</strong>" },
        style: editorialTitle(),
      },
      // Grid de anchos DESIGUALES: el destacado ocupa 2 columnas y 2 filas
      // desde `md`, el resto ocupa 1 columna — no es un grid uniforme de
      // tarjetas idénticas (diferencia estructural con A1/A4/A9, docs/48 §5.1).
      "editorial-articles-grid": {
        id: "editorial-articles-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "clamp(20px, 3vw, 32px)" } },
          overrides: {
            md: {
              layout: {
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gridAutoFlow: "dense",
              },
            },
          },
        },
        children: [
          "editorial-article-1",
          "editorial-article-2",
          "editorial-article-3",
          "editorial-article-4",
          "editorial-article-5",
        ],
      },
      ...articleCard(
        1,
        "PODCAST · TEMPORADA 4",
        "El regreso de la cocina de mercado: por qué comprar de temporada ya no es solo una moda",
        "Hablamos con tres cocineras que dejaron el fine dining para volver al puesto del mercado — y por qué no se arrepienten.",
        "18 ago · 42 min",
        "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=900&q=80&auto=format&fit=crop",
        "Puesto de verduras frescas en un mercado",
      ),
      ...articleCard(
        2,
        "ARTÍCULO",
        "Fermentar en casa sin miedo",
        "Guía de arranque para quien nunca fermentó nada: kimchi, chucrut y un vinagre madre que dura años.",
        "14 ago",
        "https://images.unsplash.com/photo-1595855759920-86582396756c?w=700&q=80&auto=format&fit=crop",
        "Frascos de vegetales fermentados",
      ),
      ...articleCard(
        3,
        "PODCAST · TEMPORADA 4",
        "Vino natural: la conversación que faltaba",
        "Un sommelier y una enóloga discuten qué significa realmente 'natural' en una etiqueta de vino.",
        "11 ago · 51 min",
        "https://images.unsplash.com/photo-1567696911980-2eed69a46042?w=700&q=80&auto=format&fit=crop",
        "Copas de vino natural sobre una mesa de madera",
      ),
      ...articleCard(
        4,
        "ARTÍCULO",
        "La receta de la abuela que nadie anotó",
        "Cómo un grupo de nietas está reconstruyendo recetas familiares a partir de la memoria y el olfato.",
        "6 ago",
        "https://images.unsplash.com/photo-1591121213398-4b0a49f6b39a?w=700&q=80&auto=format&fit=crop",
        "Manos amasando pan en una cocina casera",
      ),
      ...articleCard(
        5,
        "PODCAST · TEMPORADA 3",
        "Cocina de migración: un recetario en movimiento",
        "Tres chefs migrantes cuentan cómo un plato de origen se transforma al cocinarse en otra tierra.",
        "29 jul · 38 min",
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=700&q=80&auto=format&fit=crop",
        "Especias variadas en cuencos pequeños",
      ),

      // --- Cita destacada (showcase `quote`) --------------------------------
      "editorial-quote": {
        id: "editorial-quote",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        children: ["editorial-quote-inner"],
      },
      "editorial-quote-inner": {
        id: "editorial-quote-inner",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", justifyContent: "center" }, spacing: { margin: "0 auto" }, size: { width: "100%", maxWidth: "760px" } } },
        children: ["editorial-quote-block"],
      },
      "editorial-quote-block": {
        id: "editorial-quote-block",
        type: "quote",
        props: {
          content: "La cocina de migración no es nostalgia: es una traducción constante. Cada plato es una decisión sobre qué se conserva y qué se deja ir.",
          attribution: "Episodio 34 · Cocina de migración: un recetario en movimiento",
        },
        style: {
          base: {
            ...defaultStyleFor("quote").base,
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(1.375rem, 3vw, 2rem)",
              lineHeight: "1.3",
            },
            spacing: { padding: "clamp(28px, 5vw, 44px)" },
            appearance: { ...defaultStyleFor("quote").base.appearance, borderRadius: "20px", boxShadow: SHADOW_CARD },
          },
        },
      },

      // --- Sección de hosts/autores ------------------------------------------
      "editorial-hosts": {
        id: "editorial-hosts",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["editorial-hosts-inner"],
      },
      "editorial-hosts-inner": {
        id: "editorial-hosts-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["editorial-hosts-title", "editorial-hosts-sub", "editorial-hosts-grid"],
      },
      "editorial-hosts-title": {
        id: "editorial-hosts-title",
        type: "text",
        props: { content: "<strong>Quiénes cuentan estas historias</strong>" },
        style: { ...editorialTitle(), base: { ...editorialTitle().base, typography: { ...editorialTitle().base.typography, textAlign: "center" } } },
      },
      "editorial-hosts-sub": {
        id: "editorial-hosts-sub",
        type: "text",
        props: { content: "Dos periodistas gastronómicas con veinte años combinados cubriendo cocina en Latinoamérica y España." },
        style: { ...bodyText(), base: { ...bodyText().base, typography: { ...bodyText().base.typography, textAlign: "center" } } },
      },
      "editorial-hosts-grid": {
        id: "editorial-hosts-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "clamp(24px, 4vw, 40px)", alignItems: "center" } },
          overrides: { sm: { layout: { flexDirection: "row", justifyContent: "center" } } },
        },
        children: ["editorial-host-1", "editorial-host-2"],
      },
      ...hostCard(
        1,
        "Renata Iglesias",
        "Editora y anfitriona",
        "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&q=80&auto=format&fit=crop",
      ),
      ...hostCard(
        2,
        "Tomás Ferreira",
        "Coanfitrión y productor",
        "https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=300&q=80&auto=format&fit=crop",
      ),

      // --- Newsletter (con expandable en el extracto del destacado) -----
      "editorial-newsletter": {
        id: "editorial-newsletter",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        children: ["editorial-newsletter-inner"],
      },
      "editorial-newsletter-inner": {
        id: "editorial-newsletter-inner",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" }, alignItems: "center" }, spacing: { margin: "0 auto" }, size: { width: "100%", maxWidth: "640px" } } },
        children: ["editorial-newsletter-title", "editorial-newsletter-sub", "editorial-newsletter-form"],
      },
      "editorial-newsletter-title": {
        id: "editorial-newsletter-title",
        type: "text",
        props: { content: "<strong>La sobremesa, directo a tu correo</strong>" },
        style: { ...editorialTitle(), base: { ...editorialTitle().base, typography: { ...editorialTitle().base.typography, textAlign: "center" } } },
      },
      "editorial-newsletter-sub": {
        id: "editorial-newsletter-sub",
        type: "text",
        props: { content: "Un correo a la semana con el episodio nuevo y una receta que vale la pena guardar." },
        style: { ...bodyText(), base: { ...bodyText().base, typography: { ...bodyText().base.typography, textAlign: "center" } } },
      },
      "editorial-newsletter-form": {
        id: "editorial-newsletter-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: {
          base: {
            ...defaultStyleFor("form").base,
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            size: { width: "100%" },
            spacing: { padding: "clamp(20px, 3vw, 28px)" },
            appearance: { ...defaultStyleFor("form").base.appearance, background: { token: "colors.surface.default" }, borderRadius: "18px", boxShadow: SHADOW_CARD },
          },
          overrides: { md: { layout: { flexDirection: "row" } } },
        },
        behaviors: [{ type: "form-validation", options: {} }],
        children: ["editorial-newsletter-input", "editorial-newsletter-submit"],
      },
      "editorial-newsletter-input": {
        id: "editorial-newsletter-input",
        type: "input",
        props: { name: "email", placeholder: "tucorreo@ejemplo.com", type: "email", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "editorial-newsletter-submit": {
        id: "editorial-newsletter-submit",
        type: "button-submit",
        props: { label: "Suscribirme", disabled: false },
        style: {
          base: {
            ...defaultStyleFor("button-submit").base,
            spacing: { padding: "14px 22px" },
            appearance: { ...defaultStyleFor("button-submit").base.appearance, background: { token: "colors.primary.default" } },
          },
          states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
        },
      },

      // --- Footer oscuro -----------------------------------------------------
      "editorial-footer": {
        id: "editorial-footer",
        type: "footer",
        props: { copyright: "© 2026 Sobremesa · Revista y podcast de cultura gastronómica. Todos los derechos reservados." },
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "clamp(32px, 6vw, 56px) 20px" },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
        },
        children: ["editorial-footer-social"],
      },
      "editorial-footer-social": {
        id: "editorial-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
    },

    translations: (() => {
      const t: Record<string, NodeTranslations> = {};

      t["editorial-hero-kicker"] = {
        en: { content: "MAGAZINE AND PODCAST ABOUT FOOD CULTURE" },
        it: { content: "RIVISTA E PODCAST SULLA CULTURA GASTRONOMICA" },
      };
      t["editorial-hero-title"] = {
        en: { content: "<strong>Stories best told with the table set</strong>" },
        it: { content: "<strong>Storie che si raccontano meglio a tavola</strong>" },
      };
      t["editorial-hero-sub"] = {
        en: { content: "Every week, a dish, a conversation and the people behind the table. New season available now." },
        it: { content: "Ogni settimana, un piatto, una conversazione e le persone dietro la tavola. Nuova stagione disponibile." },
      };

      const topics: Record<number, { en: string; it: string }> = {
        1: { en: "Market cooking", it: "Cucina di mercato" },
        2: { en: "Natural wine", it: "Vino naturale" },
        3: { en: "Fermentation", it: "Fermentazione" },
        4: { en: "Migration cuisine", it: "Cucina della migrazione" },
        5: { en: "Sobremesa with chefs", it: "Sobremesa con gli chef" },
        6: { en: "Grandma's recipes", it: "Le ricette della nonna" },
      };
      for (const [n, v] of Object.entries(topics)) {
        t[`editorial-topic-${n}`] = { en: { content: v.en }, it: { content: v.it } };
      }

      t["editorial-articles-title"] = { en: { content: "<strong>Latest episodes and articles</strong>" }, it: { content: "<strong>Ultimi episodi e articoli</strong>" } };

      t["editorial-article-1-kicker"] = { en: { content: "PODCAST · SEASON 4" }, it: { content: "PODCAST · STAGIONE 4" } };
      t["editorial-article-1-title"] = {
        en: { content: "<strong>The comeback of market cooking: why buying seasonal is no longer just a trend</strong>" },
        it: { content: "<strong>Il ritorno della cucina di mercato: perché comprare di stagione non è più solo una moda</strong>" },
      };
      t["editorial-article-1-excerpt"] = {
        en: { content: "We talk to three cooks who left fine dining to go back to the market stall — and why they don't regret it." },
        it: { content: "Parliamo con tre cuoche che hanno lasciato il fine dining per tornare al banco del mercato — e perché non se ne pentono." },
      };
      t["editorial-article-1-date"] = { en: { content: "Aug 18 · 42 min" }, it: { content: "18 ago · 42 min" } };
      t["editorial-article-1-img"] = { en: { alt: "Fresh vegetable stall at a market" }, it: { alt: "Banco di verdure fresche al mercato" } };

      t["editorial-article-2-kicker"] = { en: { content: "ARTICLE" }, it: { content: "ARTICOLO" } };
      t["editorial-article-2-title"] = { en: { content: "<strong>Fermenting at home without fear</strong>" }, it: { content: "<strong>Fermentare in casa senza paura</strong>" } };
      t["editorial-article-2-excerpt"] = {
        en: { content: "A starter guide for anyone who's never fermented anything: kimchi, sauerkraut and a mother vinegar that lasts for years." },
        it: { content: "Guida per chi non ha mai fermentato nulla: kimchi, crauti e un aceto madre che dura anni." },
      };
      t["editorial-article-2-date"] = { en: { content: "Aug 14" }, it: { content: "14 ago" } };
      t["editorial-article-2-img"] = { en: { alt: "Jars of fermented vegetables" }, it: { alt: "Barattoli di verdure fermentate" } };

      t["editorial-article-3-kicker"] = { en: { content: "PODCAST · SEASON 4" }, it: { content: "PODCAST · STAGIONE 4" } };
      t["editorial-article-3-title"] = { en: { content: "<strong>Natural wine: the conversation we needed</strong>" }, it: { content: "<strong>Vino naturale: la conversazione che mancava</strong>" } };
      t["editorial-article-3-excerpt"] = {
        en: { content: "A sommelier and a winemaker discuss what 'natural' really means on a wine label." },
        it: { content: "Un sommelier e un'enologa discutono cosa significhi davvero 'naturale' su un'etichetta di vino." },
      };
      t["editorial-article-3-date"] = { en: { content: "Aug 11 · 51 min" }, it: { content: "11 ago · 51 min" } };
      t["editorial-article-3-img"] = { en: { alt: "Glasses of natural wine on a wooden table" }, it: { alt: "Bicchieri di vino naturale su un tavolo di legno" } };

      t["editorial-article-4-kicker"] = { en: { content: "ARTICLE" }, it: { content: "ARTICOLO" } };
      t["editorial-article-4-title"] = { en: { content: "<strong>The grandma's recipe nobody wrote down</strong>" }, it: { content: "<strong>La ricetta della nonna che nessuno ha scritto</strong>" } };
      t["editorial-article-4-excerpt"] = {
        en: { content: "How a group of granddaughters is rebuilding family recipes from memory and smell alone." },
        it: { content: "Come un gruppo di nipoti sta ricostruendo le ricette di famiglia solo dalla memoria e dall'olfatto." },
      };
      t["editorial-article-4-date"] = { en: { content: "Aug 6" }, it: { content: "6 ago" } };
      t["editorial-article-4-img"] = { en: { alt: "Hands kneading bread in a home kitchen" }, it: { alt: "Mani che impastano il pane in una cucina domestica" } };

      t["editorial-article-5-kicker"] = { en: { content: "PODCAST · SEASON 3" }, it: { content: "PODCAST · STAGIONE 3" } };
      t["editorial-article-5-title"] = { en: { content: "<strong>Migration cuisine: a recipe book in motion</strong>" }, it: { content: "<strong>Cucina della migrazione: un ricettario in movimento</strong>" } };
      t["editorial-article-5-excerpt"] = {
        en: { content: "Three migrant chefs on how a dish's origin transforms when cooked in another land." },
        it: { content: "Tre chef migranti raccontano come l'origine di un piatto si trasformi cucinandolo in un'altra terra." },
      };
      t["editorial-article-5-date"] = { en: { content: "Jul 29 · 38 min" }, it: { content: "29 lug · 38 min" } };
      t["editorial-article-5-img"] = { en: { alt: "Assorted spices in small bowls" }, it: { alt: "Spezie assortite in piccole ciotole" } };

      t["editorial-quote-block"] = {
        en: {
          content: "Migration cuisine isn't nostalgia: it's a constant translation. Every dish is a decision about what's kept and what's let go.",
          attribution: "Episode 34 · Migration cuisine: a recipe book in motion",
        },
        it: {
          content: "La cucina della migrazione non è nostalgia: è una traduzione costante. Ogni piatto è una decisione su cosa si conserva e cosa si lascia andare.",
          attribution: "Episodio 34 · Cucina della migrazione: un ricettario in movimento",
        },
      };

      t["editorial-hosts-title"] = { en: { content: "<strong>Who tells these stories</strong>" }, it: { content: "<strong>Chi racconta queste storie</strong>" } };
      t["editorial-hosts-sub"] = {
        en: { content: "Two food journalists with twenty combined years covering food culture across Latin America and Spain." },
        it: { content: "Due giornaliste gastronomiche con vent'anni di esperienza combinata nella cucina in America Latina e Spagna." },
      };
      t["editorial-host-1-name"] = { en: { content: "<strong>Renata Iglesias</strong>" }, it: { content: "<strong>Renata Iglesias</strong>" } };
      t["editorial-host-1-role"] = { en: { content: "Editor and host" }, it: { content: "Editrice e conduttrice" } };
      t["editorial-host-1-avatar"] = { en: { alt: "Renata Iglesias" }, it: { alt: "Renata Iglesias" } };
      t["editorial-host-2-name"] = { en: { content: "<strong>Tomás Ferreira</strong>" }, it: { content: "<strong>Tomás Ferreira</strong>" } };
      t["editorial-host-2-role"] = { en: { content: "Co-host and producer" }, it: { content: "Coconduttore e produttore" } };
      t["editorial-host-2-avatar"] = { en: { alt: "Tomás Ferreira" }, it: { alt: "Tomás Ferreira" } };

      t["editorial-newsletter-title"] = { en: { content: "<strong>Sobremesa, straight to your inbox</strong>" }, it: { content: "<strong>Sobremesa, direttamente nella tua email</strong>" } };
      t["editorial-newsletter-sub"] = {
        en: { content: "One email a week with the new episode and a recipe worth keeping." },
        it: { content: "Un'email a settimana con il nuovo episodio e una ricetta da conservare." },
      };
      t["editorial-newsletter-input"] = { en: { placeholder: "your@email.com" }, it: { placeholder: "tua@email.com" } };
      t["editorial-newsletter-submit"] = { en: { label: "Subscribe" }, it: { label: "Iscrivimi" } };

      t["editorial-footer"] = {
        en: { copyright: "© 2026 Sobremesa · Magazine and podcast about food culture. All rights reserved." },
        it: { copyright: "© 2026 Sobremesa · Rivista e podcast sulla cultura gastronomica. Tutti i diritti riservati." },
      };

      return t;
    })(),
  };
}

export const blogListPageMeta: LayoutPageMeta = {
  title: "Sobremesa · Revista y podcast de cultura gastronómica",
  description:
    "Sobremesa es una revista y podcast sobre cocina, vino natural, fermentación y las historias detrás de cada plato. Nueva temporada disponible.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Sobremesa · Revista y podcast de cultura gastronómica",
      description: "Cada semana, un plato, una conversación y la gente detrás de la mesa.",
      image: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Sobremesa · Revista y podcast de cultura gastronómica",
      description: "Cada semana, un plato, una conversación y la gente detrás de la mesa.",
      image: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    en: {
      title: "Sobremesa · Magazine and podcast about food culture",
      description: "Sobremesa is a magazine and podcast about cooking, natural wine, fermentation and the stories behind every dish. New season available now.",
      seo: {
        openGraph: { title: "Sobremesa · Magazine and podcast about food culture", description: "Every week, a dish, a conversation and the people behind the table." },
        twitter: { title: "Sobremesa · Magazine and podcast about food culture", description: "Every week, a dish, a conversation and the people behind the table." },
      },
    },
    it: {
      title: "Sobremesa · Rivista e podcast sulla cultura gastronomica",
      description: "Sobremesa è una rivista e podcast su cucina, vino naturale, fermentazione e le storie dietro ogni piatto. Nuova stagione disponibile.",
      seo: {
        openGraph: { title: "Sobremesa · Rivista e podcast sulla cultura gastronomica", description: "Ogni settimana, un piatto, una conversazione e le persone dietro la tavola." },
        twitter: { title: "Sobremesa · Rivista e podcast sulla cultura gastronomica", description: "Ogni settimana, un piatto, una conversazione e le persone dietro la tavola." },
      },
    },
  },
};
