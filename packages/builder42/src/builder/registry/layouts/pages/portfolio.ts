import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, testimonialFragment, type LayoutPageMeta } from "../helpers";

/**
 * Página "Portfolio" — REESCRITA (docs/48 §2 fila 7, F3) como plantilla de
 * sector: fotógrafo freelance ("Lúmina Estudio"). Conserva su `id` ("portfolio")
 * — un sitio guardado que la referencie sigue funcionando — pero el contenido,
 * el arquetipo y el tema son enteramente nuevos. La versión anterior (genérica,
 * andamiaje de la Fase 13, sin tema ni traducciones) queda solo en el
 * historial de git.
 *
 * Arquetipo A9b (docs/48 §2) — variante de A9 (carrusel-céntrico): a
 * diferencia de `hotel-boutique-page` (A9, `carousel` de habitaciones), aquí
 * el eje central es la GALERÍA con `lightbox` en cada foto (no un carousel) +
 * una barra `scroll-progress` fija en la parte superior que acompaña la
 * lectura de todo el porfolio — de ahí la "b": mismo espíritu ("la imagen es
 * la protagonista, no un grid estático de tarjetas"), distinto mecanismo.
 *
 * Tema "Silver" (blanco/negro, docs/48 §2): tipografía Inter con look editorial
 * de estudio fotográfico, sin color que compita con las fotos. Nota: el
 * modelo de estilo (`TypographyStyle`, `model/types.ts`) no tiene un campo
 * `letterSpacing` hoy — el "tracking cerrado" que pedía el plan se logra con
 * peso bold + `lineHeight` ajustado en los titulares en vez de espaciado de
 * letra; añadir `letterSpacing` al modelo es un cambio de core fuera del
 * alcance de F3 (reescribir 3 plantillas, no extender `StyleProperties`).
 *
 * Anatomía: topbar (teléfono + `language-nav`) · navbar · hero de foto a
 * sangre con nombre + claim · bio del fotógrafo (foto + texto) · galería por
 * categorías (retrato/paisaje/producto/evento) con `lightbox` en cada foto ·
 * testimonios de clientes · paquetes/precios de sesión (`pricing-card`) ·
 * contacto/booking (formulario validado) · footer oscuro.
 *
 * Todos los ids con prefijo `photographer-` (sin colisión con otras
 * plantillas — ninguna otra plantilla ni test referencia estos ids).
 */

const SHADOW_CARD = "0 12px 32px rgba(15,23,42,0.10)";
const SHADOW_HOVER = "0 20px 44px rgba(15,23,42,0.18)";
const BAND_PADDING = "56px 20px";
const INNER_MAX = "1160px";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true } }];

function band(background: StyleValue, padding: string = BAND_PADDING, paddingMd: string = "112px 20px"): NodeStyle {
  return {
    base: { spacing: { padding }, appearance: { background } },
    overrides: { md: { spacing: { padding: paddingMd } } },
  };
}

function inner(maxWidth: string = INNER_MAX, gap = "24px", gapMd = "40px"): NodeStyle {
  return {
    base: {
      layout: { display: "flex", flexDirection: "column", gap },
      spacing: { margin: "0 auto" },
      size: { width: "100%", maxWidth },
    },
    overrides: { md: { layout: { gap: gapMd } } },
  };
}

/** Titular con peso bold + lineHeight ajustado (identidad del tema Silver, docs/48 §2). */
function sectionTitle(color: StyleValue = { token: "colors.text" }): NodeStyle {
  return {
    base: {
      size: { maxWidth: "26ch" },
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
        fontWeight: { token: "typography.weights.bold" },
        lineHeight: "1.1",
      },
      appearance: { color },
    },
  };
}

function bodyText(color: StyleValue = { token: "colors.muted" }, maxWidth = "60ch"): NodeStyle {
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

/** Foto de galería con categoría + `lightbox` (eje del arquetipo A9b). */
function galleryPhoto(n: number, category: string, imageUrl: string, alt: string) {
  return {
    [`photographer-gallery-${n}`]: {
      id: `photographer-gallery-${n}`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "8px" },
        },
      },
      children: [`photographer-gallery-${n}-img`, `photographer-gallery-${n}-cat`],
    },
    [`photographer-gallery-${n}-img`]: {
      id: `photographer-gallery-${n}-img`,
      type: "image",
      props: { source: { kind: "url", url: imageUrl }, alt, objectFit: "cover" },
      style: {
        base: {
          size: { width: "100%", height: "280px" },
          appearance: { borderRadius: "10px", cursor: "pointer" },
        },
        overrides: { md: { size: { height: "340px" } } },
      },
      // Arquetipo A9b (docs/48 §2): cada foto de la galería abre en pantalla
      // completa — es el eje estructural de la página, no una sección más.
      behaviors: [{ type: "lightbox", options: { duration: 180 } }],
    },
    [`photographer-gallery-${n}-cat`]: {
      id: `photographer-gallery-${n}-cat`,
      type: "badge",
      props: { label: category },
      style: {
        base: {
          layout: { display: "inline-block" },
          spacing: { padding: "4px 10px" },
          typography: {
            fontSize: { token: "typography.sizes.sm" },
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: {
            background: "transparent",
            color: { token: "colors.muted" },
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: { token: "colors.border" },
            borderRadius: "999px",
          },
        },
      },
    },
  };
}

function packageCard(
  n: 1 | 2 | 3,
  planName: string,
  price: string,
  period: string,
  features: string,
  popular: boolean,
) {
  return {
    [`photographer-package-${n}`]: {
      id: `photographer-package-${n}`,
      type: "pricing-card",
      props: {
        planName,
        price,
        period,
        features,
        ctaLabel: "Reservar sesión",
        ctaLink: { kind: "anchor", nodeId: "photographer-contact" },
        popular,
        popularLabel: "Más elegido",
      },
      style: {
        ...defaultStyleFor("pricing-card"),
        base: {
          ...defaultStyleFor("pricing-card").base,
          size: { minHeight: "64px", maxWidth: "340px", width: "100%" },
          appearance: {
            ...defaultStyleFor("pricing-card").base.appearance,
            borderColor: popular ? { token: "colors.primary.default" } : { token: "colors.border" },
            borderWidth: popular ? "2px" : "1px",
            boxShadow: SHADOW_CARD,
          },
        },
        states: {
          hover: { appearance: { boxShadow: SHADOW_HOVER } },
        },
      },
    },
  };
}

export function buildPortfolioFragment(): NodeFragment {
  return {
    rootId: "photographer-root",
    nodes: {
      "photographer-root": {
        id: "photographer-root",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "stretch" } } },
        children: [
          "photographer-topbar",
          "photographer-navbar",
          "photographer-hero",
          "photographer-bio",
          "photographer-gallery-section",
          "photographer-testimonials",
          "photographer-pricing",
          "photographer-contact",
          "photographer-footer",
        ],
      },

      // --- Topbar oscuro: teléfono + language-nav -----------------------
      "photographer-topbar": {
        id: "photographer-topbar",
        type: "container",
        props: {},
        style: {
          base: {
            spacing: { padding: "10px 20px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { background: { token: "colors.text" }, color: { token: "colors.surface.default" } },
          },
        },
        children: ["photographer-topbar-inner"],
      },
      "photographer-topbar-inner": {
        id: "photographer-topbar-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" }, alignItems: "flex-start" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: INNER_MAX },
          },
          overrides: { md: { layout: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" } } },
        },
        children: ["photographer-topbar-phone", "photographer-topbar-lang"],
      },
      "photographer-topbar-phone": {
        id: "photographer-topbar-phone",
        type: "text",
        props: { content: "📞 +34 611 223 344 · Madrid y alrededores" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "photographer-topbar-lang": {
        id: "photographer-topbar-lang",
        type: "language-nav",
        props: { triggerMode: "text", displayMode: "codes", showCurrent: true, ariaLabel: "Idioma" },
        style: darkBandStyleFor("language-nav"),
      },

      // --- Navbar ---------------------------------------------------------
      "photographer-navbar": {
        id: "photographer-navbar",
        type: "navbar",
        props: { hiddenPageIds: [] },
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
        behaviors: [
          { type: "navbar", options: { duration: 240 } },
          // Barra de progreso de lectura del arquetipo A9b — fija durante todo
          // el porfolio, acompaña el scroll de la galería.
          { type: "scroll-progress", options: { fallback: true } },
        ],
        children: ["photographer-navbar-brand"],
      },
      "photographer-navbar-brand": {
        id: "photographer-navbar-brand",
        type: "text",
        props: { content: "<strong>LÚMINA ESTUDIO</strong>" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "1.25rem",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },

      // --- Hero: foto a sangre + nombre/claim -----------------------------
      "photographer-hero": {
        id: "photographer-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "flex-start" },
            spacing: { padding: "48px 20px" },
            size: { width: "100%", minHeight: "520px" },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.55) 100%), url('https://images.unsplash.com/photo-1554080353-a576cf803bda?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              color: { token: "colors.surface.default" },
            },
          },
          overrides: { md: { size: { minHeight: "640px" }, spacing: { padding: "96px 20px" } } },
        },
        children: ["photographer-hero-inner"],
      },
      "photographer-hero-inner": {
        id: "photographer-hero-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: INNER_MAX },
          },
        },
        children: ["photographer-hero-title", "photographer-hero-sub", "photographer-hero-cta"],
      },
      "photographer-hero-title": {
        id: "photographer-hero-title",
        type: "text",
        props: { content: "<strong>Fotografía que recuerda cómo se sintió el momento</strong>" },
        style: {
          base: {
            size: { maxWidth: "22ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(2.25rem, 6vw, 4rem)",
              lineHeight: "1.02",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "photographer-hero-sub": {
        id: "photographer-hero-sub",
        type: "text",
        props: { content: "Retrato, paisaje, producto y evento. Con base en Madrid, disponible para viajar." },
        style: {
          base: {
            size: { maxWidth: "46ch" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: "clamp(1rem, 1.6vw, 1.125rem)" },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "photographer-hero-cta": {
        id: "photographer-hero-cta",
        type: "button",
        props: { label: "Ver disponibilidad", link: { kind: "anchor", nodeId: "photographer-contact" }, newTab: false },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "14px 22px", margin: "8px 0 0" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontWeight: { token: "typography.weights.bold" },
              textAlign: "center",
              textDecoration: "none",
            },
            appearance: {
              background: { token: "colors.surface.default" },
              color: { token: "colors.text" },
              borderRadius: "6px",
              cursor: "pointer",
            },
          },
          states: {
            hover: { appearance: { background: { token: "colors.surface.alt" } } },
          },
        },
      },

      // --- Bio del fotógrafo (foto + texto) --------------------------------
      "photographer-bio": {
        id: "photographer-bio",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["photographer-bio-inner"],
      },
      "photographer-bio-inner": {
        id: "photographer-bio-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "24px", alignItems: "center" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: INNER_MAX },
          },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0,1fr) minmax(0,1.2fr)", gap: "48px" } } },
        },
        children: ["photographer-bio-img", "photographer-bio-copy"],
      },
      "photographer-bio-img": {
        id: "photographer-bio-img",
        type: "image",
        props: {
          source: { kind: "url", url: "https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&q=80&auto=format&fit=crop" },
          alt: "Retrato de la fotógrafa Elena Vidal en su estudio",
          objectFit: "cover",
        },
        style: {
          base: { size: { width: "100%", height: "320px" }, appearance: { borderRadius: "12px" } },
          overrides: { md: { size: { height: "420px" } } },
        },
      },
      "photographer-bio-copy": {
        id: "photographer-bio-copy",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } } },
        children: ["photographer-bio-title", "photographer-bio-text", "photographer-bio-text-2"],
      },
      "photographer-bio-title": {
        id: "photographer-bio-title",
        type: "text",
        props: { content: "<strong>Elena Vidal, fotógrafa</strong>" },
        style: sectionTitle(),
      },
      "photographer-bio-text": {
        id: "photographer-bio-text",
        type: "text",
        props: {
          content:
            "Lleva doce años detrás de la cámara, entre reportajes editoriales y sesiones de retrato. Su trabajo combina luz natural y composición minimalista: cada encargo se piensa como una pequeña serie, no como una foto suelta.",
        },
        style: bodyText(),
      },
      "photographer-bio-text-2": {
        id: "photographer-bio-text-2",
        type: "text",
        props: {
          content: "Formada en el ISF de Madrid, ha expuesto en Barcelona, Lisboa y Milán. Trabaja en digital y en película de 35mm según el proyecto.",
        },
        style: bodyText(),
      },

      // --- Galería por categorías (eje A9b) --------------------------------
      "photographer-gallery-section": {
        id: "photographer-gallery-section",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["photographer-gallery-inner"],
      },
      "photographer-gallery-inner": {
        id: "photographer-gallery-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["photographer-gallery-title", "photographer-gallery-sub", "photographer-gallery-grid"],
      },
      "photographer-gallery-title": {
        id: "photographer-gallery-title",
        type: "text",
        props: { content: "<strong>Trabajo seleccionado</strong>" },
        style: sectionTitle(),
      },
      "photographer-gallery-sub": {
        id: "photographer-gallery-sub",
        type: "text",
        props: { content: "Retrato, paisaje, producto y evento — cada foto abre en pantalla completa." },
        style: bodyText(),
      },
      "photographer-gallery-grid": {
        id: "photographer-gallery-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "16px" } },
          overrides: {
            sm: { layout: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } },
            lg: { layout: { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" } },
            md: { layout: { gap: "28px" } },
          },
        },
        children: [
          "photographer-gallery-1",
          "photographer-gallery-2",
          "photographer-gallery-3",
          "photographer-gallery-4",
          "photographer-gallery-5",
          "photographer-gallery-6",
          "photographer-gallery-7",
          "photographer-gallery-8",
        ],
      },
      ...galleryPhoto(1, "Retrato", "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=700&q=80&auto=format&fit=crop", "Retrato en blanco y negro de una mujer joven"),
      ...galleryPhoto(2, "Paisaje", "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=700&q=80&auto=format&fit=crop", "Paisaje montañoso al amanecer"),
      ...galleryPhoto(3, "Producto", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&q=80&auto=format&fit=crop", "Fotografía de producto: reloj sobre fondo neutro"),
      ...galleryPhoto(4, "Evento", "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=700&q=80&auto=format&fit=crop", "Pareja bailando en una boda"),
      ...galleryPhoto(5, "Retrato", "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=700&q=80&auto=format&fit=crop", "Retrato de un hombre mirando a cámara"),
      ...galleryPhoto(6, "Paisaje", "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=700&q=80&auto=format&fit=crop", "Costa rocosa con niebla"),
      ...galleryPhoto(7, "Producto", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=700&q=80&auto=format&fit=crop&sat=-20", "Fotografía de producto: perfume sobre fondo oscuro"),
      ...galleryPhoto(8, "Evento", "https://images.unsplash.com/photo-1519741497674-611481863552?w=700&q=80&auto=format&fit=crop", "Invitados brindando en una recepción"),

      // --- Testimonios de clientes -----------------------------------------
      "photographer-testimonials": {
        id: "photographer-testimonials",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["photographer-testimonials-inner"],
      },
      "photographer-testimonials-inner": {
        id: "photographer-testimonials-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["photographer-testimonials-title", "photographer-testimonials-grid"],
      },
      "photographer-testimonials-title": {
        id: "photographer-testimonials-title",
        type: "text",
        props: { content: "<strong>Lo que dicen quienes ya tuvieron su sesión</strong>" },
        style: sectionTitle(),
      },
      "photographer-testimonials-grid": {
        id: "photographer-testimonials-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "16px" } },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "28px" } } },
        },
        children: ["photographer-testimonial-1", "photographer-testimonial-2"],
      },
      ...testimonialFragment(
        "photographer-testimonial-1",
        {
          quote: "Elena consiguió que nos olvidáramos de la cámara. Las fotos de nuestra boda parecen sacadas de una revista, sin perder lo espontáneo.",
          name: "Marta y Diego",
          role: "Boda, junio 2025",
          initials: "MD",
        },
        { base: { ...card().base, spacing: { padding: "20px" } }, overrides: { md: { spacing: { padding: "28px" } } } },
      ),
      ...testimonialFragment(
        "photographer-testimonial-2",
        {
          quote: "Necesitábamos fotos de producto para el catálogo nuevo y el resultado superó lo que pedimos. Entrega puntual y trato impecable.",
          name: "Carlos Reyes",
          role: "Dueño, Taller Reyes",
          initials: "CR",
        },
        { base: { ...card().base, spacing: { padding: "20px" } }, overrides: { md: { spacing: { padding: "28px" } } } },
      ),

      // --- Paquetes / precios de sesión -------------------------------------
      "photographer-pricing": {
        id: "photographer-pricing",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["photographer-pricing-inner"],
      },
      "photographer-pricing-inner": {
        id: "photographer-pricing-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["photographer-pricing-title", "photographer-pricing-grid"],
      },
      "photographer-pricing-title": {
        id: "photographer-pricing-title",
        type: "text",
        props: { content: "<strong>Paquetes de sesión</strong>" },
        style: sectionTitle(),
      },
      "photographer-pricing-grid": {
        id: "photographer-pricing-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" } },
          overrides: { md: { layout: { flexDirection: "row", justifyContent: "center", gap: "24px" } } },
        },
        children: ["photographer-package-1", "photographer-package-2", "photographer-package-3"],
      },
      ...packageCard(1, "Retrato individual", "€120", "/sesión", "1 hora de sesión\n1 localización\n15 fotos editadas\nEntrega en 5 días", false),
      ...packageCard(2, "Pareja o familia", "€220", "/sesión", "2 horas de sesión\n2 localizaciones\n30 fotos editadas\nEntrega en 5 días\nGalería online privada", true),
      ...packageCard(3, "Evento (medio día)", "€480", "/sesión", "4 horas de cobertura\nReportaje completo\n80 fotos editadas\nEntrega en 10 días", false),

      // --- Contacto / booking -------------------------------------------------
      "photographer-contact": {
        id: "photographer-contact",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        children: ["photographer-contact-inner"],
      },
      "photographer-contact-inner": {
        id: "photographer-contact-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" }, alignItems: "center" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: "640px" },
          },
        },
        children: ["photographer-contact-title", "photographer-contact-sub", "photographer-contact-form"],
      },
      "photographer-contact-title": {
        id: "photographer-contact-title",
        type: "text",
        props: { content: "<strong>Reserva tu sesión</strong>" },
        style: { ...sectionTitle(), base: { ...sectionTitle().base, typography: { ...sectionTitle().base.typography, textAlign: "center" } } },
      },
      "photographer-contact-sub": {
        id: "photographer-contact-sub",
        type: "text",
        props: { content: "Cuéntame qué tienes en mente y te respondo en menos de 48 horas con disponibilidad." },
        style: { ...bodyText(), base: { ...bodyText().base, typography: { ...bodyText().base.typography, textAlign: "center" } } },
      },
      "photographer-contact-form": {
        id: "photographer-contact-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            size: { width: "100%" },
            spacing: { padding: "20px" },
            appearance: { ...card("16px").base.appearance },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
        },
        behaviors: [{ type: "form-validation", options: {} }],
        children: [
          "photographer-contact-name-label",
          "photographer-contact-name",
          "photographer-contact-email-label",
          "photographer-contact-email",
          "photographer-contact-package-label",
          "photographer-contact-package",
          "photographer-contact-submit",
        ],
      },
      "photographer-contact-name-label": {
        id: "photographer-contact-name-label",
        type: "label",
        props: { text: "Nombre completo", for: "photographer-contact-name" },
        style: defaultStyleFor("label"),
      },
      "photographer-contact-name": {
        id: "photographer-contact-name",
        type: "input",
        props: { name: "name", type: "text", placeholder: "Ej. Marta González", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "photographer-contact-email-label": {
        id: "photographer-contact-email-label",
        type: "label",
        props: { text: "Correo electrónico", for: "photographer-contact-email" },
        style: defaultStyleFor("label"),
      },
      "photographer-contact-email": {
        id: "photographer-contact-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "marta@correo.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "photographer-contact-package-label": {
        id: "photographer-contact-package-label",
        type: "label",
        props: { text: "Tipo de sesión", for: "photographer-contact-package" },
        style: defaultStyleFor("label"),
      },
      "photographer-contact-package": {
        id: "photographer-contact-package",
        type: "select",
        props: {
          options: [
            { label: "Retrato individual", value: "individual" },
            { label: "Pareja o familia", value: "family" },
            { label: "Evento (medio día)", value: "event" },
          ],
          name: "package",
          placeholder: "Selecciona un paquete",
          ariaLabel: "Tipo de sesión",
        },
        style: defaultStyleFor("select"),
      },
      "photographer-contact-submit": {
        id: "photographer-contact-submit",
        type: "button-submit",
        props: { label: "Enviar solicitud", disabled: false },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "14px 22px" },
            typography: { fontWeight: { token: "typography.weights.bold" }, textAlign: "center" },
            appearance: { background: { token: "colors.text" }, color: { token: "colors.surface.default" }, borderRadius: "6px", cursor: "pointer" },
          },
          states: { hover: { appearance: { background: { token: "colors.muted" } } } },
        },
      },

      // --- Footer oscuro -----------------------------------------------------
      "photographer-footer": {
        id: "photographer-footer",
        type: "footer",
        props: { copyright: "© 2026 Lúmina Estudio · Elena Vidal. Todos los derechos reservados." },
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "32px 20px" },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { spacing: { padding: "56px 20px" } } },
        },
        children: ["photographer-footer-social"],
      },
      "photographer-footer-social": {
        id: "photographer-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
    },

    translations: (() => {
      const t: Record<string, NodeTranslations> = {};

      t["photographer-navbar-brand"] = {
        en: { content: "<strong>LÚMINA ESTUDIO</strong>" },
        it: { content: "<strong>LÚMINA ESTUDIO</strong>" },
      };

      t["photographer-topbar-phone"] = {
        en: { content: "📞 +34 611 223 344 · Madrid and surroundings" },
        it: { content: "📞 +34 611 223 344 · Madrid e dintorni" },
      };

      t["photographer-hero-title"] = {
        en: { content: "<strong>Photography that remembers how the moment felt</strong>" },
        it: { content: "<strong>Fotografia che ricorda come si è sentito il momento</strong>" },
      };
      t["photographer-hero-sub"] = {
        en: { content: "Portrait, landscape, product and event. Based in Madrid, available to travel." },
        it: { content: "Ritratto, paesaggio, prodotto ed evento. Con base a Madrid, disponibile per viaggiare." },
      };
      t["photographer-hero-cta"] = { en: { label: "Check availability" }, it: { label: "Verifica disponibilità" } };

      t["photographer-bio-title"] = { en: { content: "<strong>Elena Vidal, photographer</strong>" }, it: { content: "<strong>Elena Vidal, fotografa</strong>" } };
      t["photographer-bio-text"] = {
        en: {
          content:
            "Twelve years behind the camera, between editorial features and portrait sessions. Her work blends natural light and minimalist composition: every commission is treated as a small series, never a single loose photo.",
        },
        it: {
          content:
            "Dodici anni dietro la macchina fotografica, tra reportage editoriali e sessioni di ritratto. Il suo lavoro unisce luce naturale e composizione minimalista: ogni commissione è pensata come una piccola serie, non come una foto isolata.",
        },
      };
      t["photographer-bio-text-2"] = {
        en: { content: "Trained at ISF Madrid, she has exhibited in Barcelona, Lisbon and Milan. She works in digital and 35mm film depending on the project." },
        it: { content: "Formata all'ISF di Madrid, ha esposto a Barcellona, Lisbona e Milano. Lavora in digitale e in pellicola 35mm secondo il progetto." },
      };
      t["photographer-bio-img"] = { en: { alt: "Portrait of photographer Elena Vidal in her studio" }, it: { alt: "Ritratto della fotografa Elena Vidal nel suo studio" } };

      t["photographer-gallery-title"] = { en: { content: "<strong>Selected work</strong>" }, it: { content: "<strong>Lavori selezionati</strong>" } };
      t["photographer-gallery-sub"] = {
        en: { content: "Portrait, landscape, product and event — every photo opens full screen." },
        it: { content: "Ritratto, paesaggio, prodotto ed evento — ogni foto si apre a schermo intero." },
      };

      const galleryAlts: Record<number, { en: string; it: string; enCat: string; itCat: string }> = {
        1: { en: "Black and white portrait of a young woman", it: "Ritratto in bianco e nero di una giovane donna", enCat: "Portrait", itCat: "Ritratto" },
        2: { en: "Mountain landscape at sunrise", it: "Paesaggio montano all'alba", enCat: "Landscape", itCat: "Paesaggio" },
        3: { en: "Product photography: watch on neutral background", it: "Fotografia di prodotto: orologio su sfondo neutro", enCat: "Product", itCat: "Prodotto" },
        4: { en: "Couple dancing at a wedding", it: "Coppia che danza a un matrimonio", enCat: "Event", itCat: "Evento" },
        5: { en: "Portrait of a man looking at the camera", it: "Ritratto di un uomo che guarda in camera", enCat: "Portrait", itCat: "Ritratto" },
        6: { en: "Rocky coastline with fog", it: "Costa rocciosa con nebbia", enCat: "Landscape", itCat: "Paesaggio" },
        7: { en: "Product photography: perfume on dark background", it: "Fotografia di prodotto: profumo su sfondo scuro", enCat: "Product", itCat: "Prodotto" },
        8: { en: "Guests toasting at a reception", it: "Ospiti che festeggiano a un ricevimento", enCat: "Event", itCat: "Evento" },
      };
      for (const [n, alt] of Object.entries(galleryAlts)) {
        t[`photographer-gallery-${n}-img`] = { en: { alt: alt.en }, it: { alt: alt.it } };
        t[`photographer-gallery-${n}-cat`] = { en: { label: alt.enCat }, it: { label: alt.itCat } };
      }

      t["photographer-testimonials-title"] = {
        en: { content: "<strong>What clients say after their session</strong>" },
        it: { content: "<strong>Cosa dicono i clienti dopo la loro sessione</strong>" },
      };
      t["photographer-testimonial-1-quote"] = {
        en: { content: "<p>Elena made us forget the camera was even there. Our wedding photos look like they're from a magazine, without losing the spontaneity.</p>" },
        it: { content: "<p>Elena ci ha fatto dimenticare la macchina fotografica. Le foto del nostro matrimonio sembrano di una rivista, senza perdere la spontaneità.</p>" },
      };
      t["photographer-testimonial-1-name"] = {
        en: { content: "<strong>Marta and Diego</strong>" },
        it: { content: "<strong>Marta e Diego</strong>" },
      };
      t["photographer-testimonial-1-role"] = {
        en: { content: "Wedding, June 2025" },
        it: { content: "Matrimonio, giugno 2025" },
      };
      t["photographer-testimonial-2-quote"] = {
        en: { content: "<p>We needed product photos for the new catalog and the result exceeded what we asked for. On-time delivery and flawless service.</p>" },
        it: { content: "<p>Avevamo bisogno di foto prodotto per il nuovo catalogo e il risultato ha superato le aspettative. Consegna puntuale e servizio impeccabile.</p>" },
      };
      t["photographer-testimonial-2-name"] = {
        en: { content: "<strong>Carlos Reyes</strong>" },
        it: { content: "<strong>Carlos Reyes</strong>" },
      };
      t["photographer-testimonial-2-role"] = {
        en: { content: "Owner, Taller Reyes" },
        it: { content: "Proprietario, Taller Reyes" },
      };

      t["photographer-pricing-title"] = { en: { content: "<strong>Session packages</strong>" }, it: { content: "<strong>Pacchetti sessione</strong>" } };

      t["photographer-package-1"] = {
        en: { planName: "Individual portrait", price: "€120", period: "/session", features: "1-hour session\n1 location\n15 edited photos\nDelivery in 5 days", ctaLabel: "Book session", popularLabel: "Most chosen" },
        it: { planName: "Ritratto individuale", price: "€120", period: "/sessione", features: "1 ora di sessione\n1 location\n15 foto ritoccate\nConsegna in 5 giorni", ctaLabel: "Prenota sessione", popularLabel: "Più scelto" },
      };
      t["photographer-package-2"] = {
        en: {
          planName: "Couple or family",
          price: "€220",
          period: "/session",
          features: "2-hour session\n2 locations\n30 edited photos\nDelivery in 5 days\nPrivate online gallery",
          ctaLabel: "Book session",
          popularLabel: "Most chosen",
        },
        it: {
          planName: "Coppia o famiglia",
          price: "€220",
          period: "/sessione",
          features: "2 ore di sessione\n2 location\n30 foto ritoccate\nConsegna in 5 giorni\nGalleria online privata",
          ctaLabel: "Prenota sessione",
          popularLabel: "Più scelto",
        },
      };
      t["photographer-package-3"] = {
        en: {
          planName: "Event (half day)",
          price: "€480",
          period: "/session",
          features: "4-hour coverage\nFull reportage\n80 edited photos\nDelivery in 10 days",
          ctaLabel: "Book session",
          popularLabel: "Most chosen",
        },
        it: {
          planName: "Evento (mezza giornata)",
          price: "€480",
          period: "/sessione",
          features: "4 ore di copertura\nReportage completo\n80 foto ritoccate\nConsegna in 10 giorni",
          ctaLabel: "Prenota sessione",
          popularLabel: "Più scelto",
        },
      };

      t["photographer-contact-title"] = { en: { content: "<strong>Book your session</strong>" }, it: { content: "<strong>Prenota la tua sessione</strong>" } };
      t["photographer-contact-sub"] = {
        en: { content: "Tell me what you have in mind and I'll reply within 48 hours with availability." },
        it: { content: "Raccontami cosa hai in mente e ti risponderò entro 48 ore con la disponibilità." },
      };
      t["photographer-contact-name-label"] = { en: { text: "Full name" }, it: { text: "Nome completo" } };
      t["photographer-contact-name"] = { en: { placeholder: "E.g. Marta González" }, it: { placeholder: "Es. Marta González" } };
      t["photographer-contact-email-label"] = { en: { text: "Email address" }, it: { text: "Indirizzo email" } };
      t["photographer-contact-email"] = { en: { placeholder: "marta@email.com" }, it: { placeholder: "marta@email.com" } };
      t["photographer-contact-package-label"] = { en: { text: "Session type" }, it: { text: "Tipo di sessione" } };
      t["photographer-contact-package"] = { en: { placeholder: "Select a package" }, it: { placeholder: "Seleziona un pacchetto" } };
      t["photographer-contact-submit"] = { en: { label: "Send request" }, it: { label: "Invia richiesta" } };

      t["photographer-footer"] = {
        en: { copyright: "© 2026 Lúmina Estudio · Elena Vidal. All rights reserved." },
        it: { copyright: "© 2026 Lúmina Estudio · Elena Vidal. Tutti i diritti riservati." },
      };

      return t;
    })(),
  };
}

/**
 * SEO de la página (docs/42 §2.8): `applyPageLayout` lo escribe en `page.meta`
 * conservando el `slug` del usuario.
 */
export const portfolioPageMeta: LayoutPageMeta = {
  title: "Lúmina Estudio · Fotografía de retrato, evento y producto en Madrid",
  description:
    "Elena Vidal, fotógrafa en Madrid. Retrato, paisaje, producto y evento. Paquetes de sesión y reserva de disponibilidad online.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Lúmina Estudio · Fotografía en Madrid",
      description: "Retrato, paisaje, producto y evento. Reserva tu sesión con Elena Vidal.",
      image: "https://images.unsplash.com/photo-1554080353-a576cf803bda?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Lúmina Estudio · Fotografía en Madrid",
      description: "Retrato, paisaje, producto y evento. Reserva tu sesión con Elena Vidal.",
      image: "https://images.unsplash.com/photo-1554080353-a576cf803bda?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    en: {
      title: "Lúmina Estudio · Portrait, event and product photography in Madrid",
      description: "Elena Vidal, photographer in Madrid. Portrait, landscape, product and event. Session packages and online booking.",
      seo: {
        openGraph: { title: "Lúmina Estudio · Photography in Madrid", description: "Portrait, landscape, product and event. Book your session with Elena Vidal." },
        twitter: { title: "Lúmina Estudio · Photography in Madrid", description: "Portrait, landscape, product and event. Book your session with Elena Vidal." },
      },
    },
    it: {
      title: "Lúmina Estudio · Fotografia di ritratto, evento e prodotto a Madrid",
      description: "Elena Vidal, fotografa a Madrid. Ritratto, paesaggio, prodotto ed evento. Pacchetti sessione e prenotazione online.",
      seo: {
        openGraph: { title: "Lúmina Estudio · Fotografia a Madrid", description: "Ritratto, paesaggio, prodotto ed evento. Prenota la tua sessione con Elena Vidal." },
        twitter: { title: "Lúmina Estudio · Fotografia a Madrid", description: "Ritratto, paesaggio, prodotto ed evento. Prenota la tua sessione con Elena Vidal." },
      },
    },
  },
};
