import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, statFragment, testimonialFragment, type LayoutPageMeta } from "../helpers";

/**
 * Página "Taller mecánico" — plantilla NUEVA de sector (docs/48 §2 fila 17,
 * F6, ÚLTIMA de la fase): "Torque & Fierro Servicio Automotriz", taller
 * mecánico de mantenimiento y reparación general.
 *
 * Arquetipo A5b — variante de A5 (Conversión mono-columna, ya usado por
 * `signup-page` en F4). Difiere de A5 en ≥2/5 rasgos de firma
 * (`layoutSignature.helper.ts`), verificado por `allSignaturesDistinct` y por
 * la firma real de A5 medida directamente sobre `buildSignupPageFragment()`:
 *   1. **`gridColumns` distinto**: la firma medida de A5 (`signup-page`) da
 *      `gridColumns.kind === "none"` en TODAS sus bandas de primer nivel —
 *      es, literalmente, la definición del arquetipo ("ninguna banda supera
 *      una sola columna", verificado también por su propio test
 *      `signupPage.test.ts` con la aserción "is a mono-column layout"). A5b
 *      introduce, dentro de esa misma restricción de A5 (secciones angostas
 *      centradas, cero distracción — el fragmento SIGUE siendo mono-columna
 *      en el sentido de "una columna de lectura", docs/48 §2), un grid REAL
 *      de 2 columnas en la banda de estadísticas de trayectoria
 *      (`gridTemplateColumns: "1fr 1fr"` desde un breakpoint) para el
 *      showcase de `stat`/`count-up` — `layoutSignature` calcula
 *      `gridColumns.kind === "columns"` (count 2, symmetric) en esa banda,
 *      un patrón que A5 no produce nunca (medido).
 *   2. **`overrideBreakpoints` distinto**: A5 no declara ningún `overrides`
 *      de `layout` en ninguna de sus bandas de primer nivel — todas sus
 *      bandas son `flex column` fijo, sin cambiar de forma en ningún
 *      breakpoint (medido: `overridesOf(band) === []` en las 8 bandas de
 *      `academy-root`). La banda de estadísticas de A5b SÍ cambia de forma
 *      en `sm` (pasa de 1 a 2 columnas), así que su `overrideBreakpoints`
 *      es `["sm"]` — un valor que A5 no produce en ninguna banda.
 * Suma un tercer rasgo distinto de facto: **`hasMedia`** — A5 no tiene
 * ninguna imagen en todo el fragmento (su hero es solo tipografía + badge +
 * CTA, sin foto de fondo ni imagen de producto). A5b sí tiene una imagen real
 * del taller en el hero (banda con `background` de imagen, mismo patrón que
 * `spa-wellness-page`/`barbershop-page`: `hasMedia: true` en esa banda,
 * ausente en las 8 bandas de A5).
 *
 * Tema "Torque" (grafito/rojo, docs/48 §2): tipografía Barlow Condensed para
 * `display` — condensada de alto contraste, propia de rotulación de taller e
 * industria automotriz; el cuerpo usa un sans-serif de sistema neutro (mismo
 * criterio que Oswald/Fade en `barbershop-page`, F6: un display de carácter +
 * un texto de lectura cómoda, sin forzar dos condensadas). Tema `light`
 * (grafito como color de texto/acento oscuro, no como base — a diferencia de
 * Studio/Fade, que son los dos únicos `colorScheme: "dark"` de la galería).
 *
 * Showcase funcional: `form-validation` (validación en tiempo real del
 * formulario de solicitud de cita), `alert` informativo (horario de recepción
 * de vehículos y política de diagnóstico sin costo — sin lenguaje de urgencia
 * agresivo, mismo criterio que `academy-alert` en `signup-page`), `stat` +
 * `count-up` (años de servicio, vehículos atendidos, mecánicos certificados).
 *
 * Anatomía: navbar · hero de propuesta de valor con foto real del taller ·
 * estadísticas de trayectoria (`stat` + `count-up`, grid 2 col — A5b) ·
 * servicios breves · testimonios de clientes · FAQ (`accordion`) · alert
 * informativo de recepción · formulario de solicitud de cita (`form` +
 * `select` + `form-validation`) · footer oscuro.
 *
 * Todos los ids con prefijo `torque-` (sin colisión con otras plantillas).
 */

const SHADOW_CARD = "0 12px 32px rgba(30,30,30,0.12)";
const BAND_PADDING = "56px 20px";
const BAND_PADDING_MD = "96px 20px";
const NARROW_MAX = "640px";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true } }];

function band(background: StyleValue, padding: string = BAND_PADDING, paddingMd: string = BAND_PADDING_MD): NodeStyle {
  return {
    base: { spacing: { padding }, appearance: { background } },
    overrides: { md: { spacing: { padding: paddingMd } } },
  };
}

/** A5b: inner angosto y centrado — igual que A5, ninguna banda de LECTURA supera `NARROW_MAX`. */
function inner(maxWidth: string = NARROW_MAX, gap = "20px"): NodeStyle {
  return {
    base: {
      layout: { display: "flex", flexDirection: "column", gap, alignItems: "center" },
      spacing: { margin: "0 auto" },
      size: { width: "100%", maxWidth },
    },
    overrides: { sm: { spacing: { padding: "0 8px" } }, md: { layout: { gap: "32px" } } },
  };
}

function sectionTitle(color: StyleValue = { token: "colors.text" }): NodeStyle {
  return {
    base: {
      size: { maxWidth: "26ch" },
      typography: {
        fontFamily: { token: "typography.families.display" },
        fontSize: "clamp(1.6rem, 4vw, 2.25rem)",
        fontWeight: { token: "typography.weights.bold" },
        lineHeight: "1.15",
        textAlign: "center",
      },
      appearance: { color },
    },
  };
}

function bodyText(color: StyleValue = { token: "colors.muted" }, maxWidth = "56ch"): NodeStyle {
  return {
    base: {
      size: { maxWidth },
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
        lineHeight: { token: "typography.lineHeights.normal" },
        textAlign: "center",
      },
      appearance: { color },
    },
  };
}

/** `stat` + `count-up` en grid 2 col desde `sm` — el rasgo que distingue A5b de A5 (ver comentario superior). */
function statCard(n: 1 | 2 | 3, value: string, label: string) {
  const nodes = statFragment(`torque-stat-${n}`, { value, label }, {
    base: { ...defaultStyleFor("stat").base, appearance: { color: { token: "colors.band.on" } } },
  });
  nodes[`torque-stat-${n}`]!.behaviors = [{ type: "count-up", options: { duration: 1500, threshold: 0.3, once: true } }];
  return nodes;
}

function service(n: 1 | 2 | 3, iconName: string, title: string, text: string) {
  return {
    [`torque-service-${n}`]: {
      id: `torque-service-${n}`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "8px", alignItems: "center" },
          size: { width: "100%" },
          spacing: { padding: "16px" },
          typography: { textAlign: "center" },
          appearance: { borderRadius: "16px" },
        },
        states: { hover: { appearance: { background: { token: "colors.surface.alt" } } } },
      },
      children: [`torque-service-${n}-icon`, `torque-service-${n}-title`, `torque-service-${n}-text`],
    },
    [`torque-service-${n}-icon`]: {
      id: `torque-service-${n}-icon`,
      type: "icon",
      props: { name: iconName, pressedName: "", title },
      style: {
        ...defaultStyleFor("icon"),
        base: { ...defaultStyleFor("icon").base, appearance: { color: { token: "colors.primary.default" } } },
      },
    },
    [`torque-service-${n}-title`]: {
      id: `torque-service-${n}-title`,
      type: "text",
      props: { content: `<strong>${title}</strong>` },
      style: { base: { typography: { fontWeight: { token: "typography.weights.bold" } }, appearance: { color: { token: "colors.text" } } } },
    },
    [`torque-service-${n}-text`]: {
      id: `torque-service-${n}-text`,
      type: "text",
      props: { content: text },
      style: { base: { size: { maxWidth: "40ch" }, typography: { textAlign: "center" }, appearance: { color: { token: "colors.muted" } } } },
    },
  };
}

function customerTestimonial(n: 1 | 2, quote: string, name: string, role: string, initials: string) {
  return testimonialFragment(`torque-testimonial-${n}`, { quote, name, role, initials }, {
    base: {
      appearance: {
        background: { token: "colors.surface.default" },
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: { token: "colors.border" },
        borderRadius: "16px",
        boxShadow: SHADOW_CARD,
      },
      spacing: { padding: "20px" },
    },
    overrides: { md: { spacing: { padding: "28px" } } },
    states: { hover: { appearance: { boxShadow: "0 18px 40px rgba(30,30,30,0.18)" } } },
  });
}

export function buildAutoRepairPageFragment(): NodeFragment {
  return {
    rootId: "torque-root",
    nodes: {
      "torque-root": {
        id: "torque-root",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "stretch" } } },
        children: [
          "torque-navbar",
          "torque-hero",
          "torque-stats",
          "torque-services",
          "torque-testimonials",
          "torque-faq",
          "torque-reception-alert",
          "torque-appointment",
          "torque-footer",
        ],
      },

      // --- Navbar ----------------------------------------------------------------
      "torque-navbar": {
        id: "torque-navbar",
        type: "navbar",
        props: { brand: "Torque & Fierro", hiddenPageIds: [] },
        style: defaultStyleFor("navbar"),
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
      },

      // --- Hero de propuesta de valor con foto real — A5b: angosto y centrado ------
      "torque-hero": {
        id: "torque-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "16px" },
            spacing: { padding: "56px 20px" },
            size: { width: "100%", minHeight: "420px" },
            typography: { fontFamily: { token: "typography.families.sans" }, textAlign: "center" },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(30,30,30,0.72), rgba(30,30,30,0.5)), url('https://images.unsplash.com/photo-1632823469850-1b7b1e8b7692?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              color: { token: "colors.band.on" },
            },
          },
          overrides: { md: { spacing: { padding: "112px 20px" } } },
        },
        children: ["torque-hero-badge", "torque-hero-title", "torque-hero-sub", "torque-hero-cta"],
      },
      "torque-hero-badge": {
        id: "torque-hero-badge",
        type: "badge",
        props: { label: "Free diagnostic check" },
        style: defaultStyleFor("badge"),
      },
      "torque-hero-title": {
        id: "torque-hero-title",
        type: "text",
        props: { content: "<strong>Your car in the hands of certified mechanics</strong>" },
        style: {
          base: {
            size: { maxWidth: "20ch" },
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(2rem, 5.5vw, 3.25rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.08",
              textAlign: "center",
            },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "torque-hero-sub": {
        id: "torque-hero-sub",
        type: "text",
        props: {
          content:
            "Preventive maintenance, computerized diagnostics and general repair, with original parts and a written warranty.",
        },
        style: bodyText({ token: "colors.band.on" }),
      },
      "torque-hero-cta": {
        id: "torque-hero-cta",
        type: "button",
        props: { label: "Book my appointment", link: { kind: "anchor", nodeId: "torque-appointment" } },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: { token: "radii.md" },
              boxShadow: "0 12px 32px rgba(30,30,30,0.32)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(30,30,30,0.4)" } } },
        },
      },

      // --- Estadísticas de trayectoria — GRID 2 col desde `sm` (rasgo A5b) --------
      "torque-stats": {
        id: "torque-stats",
        type: "section",
        props: {},
        style: band("linear-gradient(135deg, var(--colors-text), var(--colors-band-dark))", "40px 20px", "64px 20px"),
        behaviors: REVEAL,
        children: ["torque-stats-inner"],
      },
      "torque-stats-inner": {
        id: "torque-stats-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "20px" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: "760px" },
          },
          overrides: { sm: { layout: { gridTemplateColumns: "1fr 1fr" } }, md: { layout: { gap: "32px" } } },
        },
        children: ["torque-stat-1", "torque-stat-2", "torque-stat-3"],
      },
      ...statCard(1, "18", "years in business"),
      ...statCard(2, "42000", "vehicles serviced"),
      ...statCard(3, "9", "certified mechanics"),

      // --- Servicios breves — banda clara ------------------------------------------
      "torque-services": {
        id: "torque-services",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["torque-services-inner"],
      },
      "torque-services-inner": {
        id: "torque-services-inner",
        type: "container",
        props: {},
        style: inner("680px"),
        children: ["torque-services-title", "torque-services-grid"],
      },
      "torque-services-title": {
        id: "torque-services-title",
        type: "text",
        props: { content: "<strong>What we do for your car</strong>" },
        style: sectionTitle(),
      },
      "torque-services-grid": {
        id: "torque-services-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "24px" }, size: { width: "100%" } },
          overrides: { md: { layout: { gap: "36px" } } },
        },
        children: ["torque-service-1", "torque-service-2", "torque-service-3"],
      },
      ...service(1, "Wrench", "Preventive maintenance", "Oil and filter changes, brakes and a 30-point inspection to catch failures before they happen."),
      ...service(2, "Gauge", "Computerized diagnostics", "Full electronic scan of the engine and electrical systems with professional scanning equipment."),
      ...service(3, "ShieldCheck", "Written warranty", "Every major repair includes a 6-month or 10,000 km warranty, whichever comes first."),

      // --- Testimonios de clientes — banda alt --------------------------------------
      "torque-testimonials": {
        id: "torque-testimonials",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["torque-testimonials-inner"],
      },
      "torque-testimonials-inner": {
        id: "torque-testimonials-inner",
        type: "container",
        props: {},
        style: inner("680px"),
        children: ["torque-testimonials-title", "torque-testimonials-list"],
      },
      "torque-testimonials-title": {
        id: "torque-testimonials-title",
        type: "text",
        props: { content: "<strong>What our customers say</strong>" },
        style: sectionTitle(),
      },
      "torque-testimonials-list": {
        id: "torque-testimonials-list",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: "16px" }, size: { width: "100%" } }, overrides: { md: { layout: { gap: "24px" } } } },
        children: ["torque-testimonial-1", "torque-testimonial-2"],
      },
      ...customerTestimonial(
        1,
        "I brought my car in thinking it was the transmission and it was just a sensor. Total honesty, they didn't overcharge me.",
        "Rodrigo Elizalde",
        "Customer since 2021",
        "RE",
      ),
      ...customerTestimonial(
        2,
        "The free diagnostic saved me from a very expensive quote at another shop. Now I bring both family cars here.",
        "Fernanda Ibarra",
        "Customer since 2023",
        "FI",
      ),

      // --- FAQ — banda clara --------------------------------------------------------
      "torque-faq": {
        id: "torque-faq",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        children: ["torque-faq-inner"],
      },
      "torque-faq-inner": {
        id: "torque-faq-inner",
        type: "container",
        props: {},
        style: inner("680px"),
        children: ["torque-faq-title", "torque-accordion"],
      },
      "torque-faq-title": {
        id: "torque-faq-title",
        type: "text",
        props: { content: "<strong>Frequently asked questions</strong>" },
        style: sectionTitle(),
      },
      "torque-accordion": {
        id: "torque-accordion",
        type: "accordion",
        props: {},
        style: { ...defaultStyleFor("accordion"), base: { ...defaultStyleFor("accordion").base, size: { width: "100%" } } },
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["torque-faq-item-1", "torque-faq-item-2", "torque-faq-item-3"],
      },
      "torque-faq-item-1": {
        id: "torque-faq-item-1",
        type: "accordion-item",
        props: { label: "Is the diagnostic really free?", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["torque-faq-item-1-body"],
      },
      "torque-faq-item-1-body": {
        id: "torque-faq-item-1-body",
        type: "text",
        props: { content: "Yes. The scan and 30-point inspection are free, whether or not you accept the repair we propose." },
        style: { base: { size: { maxWidth: "56ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "torque-faq-item-2": {
        id: "torque-faq-item-2",
        type: "accordion-item",
        props: { label: "Do you use original or generic parts?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["torque-faq-item-2-body"],
      },
      "torque-faq-item-2-body": {
        id: "torque-faq-item-2-body",
        type: "text",
        props: { content: "We work with original parts by default; if a certified quality generic alternative exists, we offer it as an option with the corresponding savings." },
        style: { base: { size: { maxWidth: "56ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "torque-faq-item-3": {
        id: "torque-faq-item-3",
        type: "accordion-item",
        props: { label: "How long until I get my car back?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["torque-faq-item-3-body"],
      },
      "torque-faq-item-3-body": {
        id: "torque-faq-item-3-body",
        type: "text",
        props: { content: "Preventive maintenance is delivered the same day. For major repairs we give you a written time estimate before authorizing the work." },
        style: { base: { size: { maxWidth: "56ch" }, appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Alert informativo de recepción — banda con degradado de acento ---------
      "torque-reception-alert": {
        id: "torque-reception-alert",
        type: "section",
        props: {},
        style: band("linear-gradient(135deg, var(--colors-primary-default), var(--colors-text))", "32px 20px", "48px 20px"),
        children: ["torque-reception-alert-inner"],
      },
      "torque-reception-alert-inner": {
        id: "torque-reception-alert-inner",
        type: "container",
        props: {},
        style: inner("680px", "0px"),
        children: ["torque-alert"],
      },
      "torque-alert": {
        id: "torque-alert",
        type: "alert",
        props: {
          // Informativo, no manipulador (mismo criterio que academy-alert en
          // signup-page): horario real de recepción, sin cuenta atrás ni
          // lenguaje de presión.
          message: "We receive vehicles Monday to Saturday, 8:00 AM to 6:00 PM. The initial diagnostic is free and does not commit you to repairing with us.",
          variant: "info",
          showIcon: true,
        },
        style: {
          base: {
            ...defaultStyleFor("alert").base,
            size: { width: "100%" },
            appearance: {
              ...defaultStyleFor("alert").base.appearance,
              background: { token: "colors.surface.default" },
              borderRadius: "16px",
              boxShadow: SHADOW_CARD,
            },
          },
        },
      },

      // --- Formulario de cita — banda alt (form-validation + select) --------------
      "torque-appointment": {
        id: "torque-appointment",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        children: ["torque-appointment-inner"],
      },
      "torque-appointment-inner": {
        id: "torque-appointment-inner",
        type: "container",
        props: {},
        style: inner("560px"),
        children: ["torque-appointment-title", "torque-appointment-sub", "torque-appointment-card"],
      },
      "torque-appointment-title": {
        id: "torque-appointment-title",
        type: "text",
        props: { content: "<strong>Book your appointment</strong>" },
        style: sectionTitle(),
      },
      "torque-appointment-sub": {
        id: "torque-appointment-sub",
        type: "text",
        props: { content: "Fill out the form and we'll confirm an available time slot within 2 hours." },
        style: bodyText(),
      },
      "torque-appointment-card": {
        id: "torque-appointment-card",
        type: "card",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px" },
            spacing: { padding: "20px" },
            size: { width: "100%" },
            appearance: {
              background: { token: "colors.surface.default" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.border" },
              borderRadius: "16px",
              boxShadow: SHADOW_CARD,
            },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
        },
        children: ["torque-form"],
      },
      "torque-form": {
        id: "torque-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: defaultStyleFor("form"),
        behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
        children: ["torque-field-name", "torque-field-email", "torque-field-service", "torque-submit"],
      },
      "torque-field-name": {
        id: "torque-field-name",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["torque-label-name", "torque-input-name"],
      },
      "torque-label-name": {
        id: "torque-label-name",
        type: "label",
        props: { text: "Full name", for: "torque-input-name" },
        style: defaultStyleFor("label"),
      },
      "torque-input-name": {
        id: "torque-input-name",
        type: "input",
        props: { name: "nombre", type: "text", placeholder: "Your full name", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "torque-field-email": {
        id: "torque-field-email",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["torque-label-email", "torque-input-email"],
      },
      "torque-label-email": {
        id: "torque-label-email",
        type: "label",
        props: { text: "Email", for: "torque-input-email" },
        style: defaultStyleFor("label"),
      },
      "torque-input-email": {
        id: "torque-input-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "you@email.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "torque-field-service": {
        id: "torque-field-service",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["torque-label-service", "torque-select-service"],
      },
      "torque-label-service": {
        id: "torque-label-service",
        type: "label",
        props: { text: "Service needed", for: "torque-select-service" },
        style: defaultStyleFor("label"),
      },
      "torque-select-service": {
        id: "torque-select-service",
        type: "select",
        props: {
          name: "servicio",
          placeholder: "Choose a service…",
          ariaLabel: "Service needed",
          options: [
            { label: "Preventive maintenance", value: "mantenimiento" },
            { label: "Computerized diagnostics", value: "diagnostico" },
            { label: "General repair", value: "reparacion" },
            { label: "Not sure yet, I want an inspection", value: "revision" },
          ],
        },
        style: defaultStyleFor("select"),
      },
      "torque-submit": {
        id: "torque-submit",
        type: "button-submit",
        props: { label: "Request appointment", disabled: false },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: { token: "radii.md" },
              boxShadow: "0 12px 32px rgba(30,30,30,0.2)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(30,30,30,0.28)" } } },
        },
      },

      // --- Footer — banda oscura ----------------------------------------------------
      "torque-footer": {
        id: "torque-footer",
        type: "footer",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "32px 20px" },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { spacing: { padding: "48px 20px" } } },
        },
        children: ["torque-footer-social", "torque-footer-copyright"],
      },
      "torque-footer-social": {
        id: "torque-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
      "torque-footer-copyright": {
        id: "torque-footer-copyright",
        type: "text",
        props: { content: "© 2026 Torque & Fierro Auto Service. All rights reserved." },
        style: {
          base: {
            size: { width: "100%" },
            spacing: { padding: "16px 0 0 0" },
            typography: { textAlign: "center", fontSize: { token: "typography.sizes.sm" } },
            appearance: {
              color: "inherit",
              borderColor: "rgba(255,255,255,0.16)",
              borderWidth: "1px 0 0 0",
              borderStyle: "solid",
            },
          },
        },
      },
    },

    translations: (() => {
      const t: Record<string, NodeTranslations> = {};

      t["torque-hero-badge"] = { es: { label: "Diagnóstico sin costo" }, it: { label: "Diagnosi gratuita" } };
      t["torque-hero-title"] = { es: { content: "<strong>Tu auto en manos de mecánicos certificados</strong>" }, it: { content: "<strong>La tua auto nelle mani di meccanici certificati</strong>" } };
      t["torque-hero-sub"] = { es: { content: "Mantenimiento preventivo, diagnóstico computarizado y reparación general, con repuestos originales y garantía por escrito." }, it: { content: "Manutenzione preventiva, diagnosi computerizzata e riparazioni generali, con ricambi originali e garanzia scritta." } };
      t["torque-hero-cta"] = { es: { label: "Agendar mi cita" }, it: { label: "Prenota il mio appuntamento" } };

      t["torque-stat-1-value"] = { es: { value: "18" }, it: { value: "18" } };
      t["torque-stat-1-label"] = { es: { content: "años de servicio" }, it: { content: "anni di attività" } };
      t["torque-stat-2-value"] = { es: { value: "42000" }, it: { value: "42000" } };
      t["torque-stat-2-label"] = { es: { content: "vehículos atendidos" }, it: { content: "veicoli riparati" } };
      t["torque-stat-3-value"] = { es: { value: "9" }, it: { value: "9" } };
      t["torque-stat-3-label"] = { es: { content: "mecánicos certificados" }, it: { content: "meccanici certificati" } };

      t["torque-services-title"] = { es: { content: "<strong>Lo que hacemos por tu auto</strong>" }, it: { content: "<strong>Cosa facciamo per la tua auto</strong>" } };

      t["torque-service-1-icon"] = { es: { title: "Mantenimiento preventivo" }, it: { title: "Manutenzione preventiva" } };
      t["torque-service-1-title"] = { es: { content: "<strong>Mantenimiento preventivo</strong>" }, it: { content: "<strong>Manutenzione preventiva</strong>" } };
      t["torque-service-1-text"] = { es: { content: "Cambio de aceite, filtros, frenos y revisión de 30 puntos para evitar fallas antes de que ocurran." }, it: { content: "Cambio olio e filtri, freni e controllo di 30 punti per prevenire i guasti prima che accadano." } };
      t["torque-service-2-icon"] = { es: { title: "Diagnóstico computarizado" }, it: { title: "Diagnosi computerizzata" } };
      t["torque-service-2-title"] = { es: { content: "<strong>Diagnóstico computarizado</strong>" }, it: { content: "<strong>Diagnosi computerizzata</strong>" } };
      t["torque-service-2-text"] = { es: { content: "Escaneo electrónico completo del motor y sistemas eléctricos con equipo de escáner profesional." }, it: { content: "Scansione elettronica completa del motore e dei sistemi elettrici con apparecchiature professionali." } };
      t["torque-service-3-icon"] = { es: { title: "Garantía por escrito" }, it: { title: "Garanzia scritta" } };
      t["torque-service-3-title"] = { es: { content: "<strong>Garantía por escrito</strong>" }, it: { content: "<strong>Garanzia scritta</strong>" } };
      t["torque-service-3-text"] = { es: { content: "Toda reparación mayor incluye garantía de 6 meses o 10,000 km, lo que ocurra primero." }, it: { content: "Ogni riparazione importante include una garanzia di 6 mesi o 10.000 km, a seconda di cosa avviene prima." } };

      t["torque-testimonials-title"] = { es: { content: "<strong>Lo que dicen nuestros clientes</strong>" }, it: { content: "<strong>Cosa dicono i nostri clienti</strong>" } };
      t["torque-testimonial-1-quote"] = { es: { content: "<p>Llevé mi auto pensando que era la transmisión y solo era un sensor. Honestidad total, no me cobraron de más.</p>" }, it: { content: "<p>Ho portato la macchina pensando fosse il cambio ed era solo un sensore. Onestà totale, non mi hanno sovraccaricato.</p>" } };
      t["torque-testimonial-1-name"] = { es: { content: "<strong>Rodrigo Elizalde</strong>" }, it: { content: "<strong>Rodrigo Elizalde</strong>" } };
      t["torque-testimonial-1-role"] = { es: { content: "Cliente desde 2021" }, it: { content: "Cliente dal 2021" } };
      t["torque-testimonial-2-quote"] = { es: { content: "<p>El diagnóstico sin costo me ahorró una cotización carísima en otro taller. Ahora llevo los dos autos de la familia aquí.</p>" }, it: { content: "<p>La diagnosi gratuita mi ha risparmiato un preventivo carissimo in un'altra officina. Ora porto qui entrambe le auto di famiglia.</p>" } };
      t["torque-testimonial-2-name"] = { es: { content: "<strong>Fernanda Ibarra</strong>" }, it: { content: "<strong>Fernanda Ibarra</strong>" } };
      t["torque-testimonial-2-role"] = { es: { content: "Cliente desde 2023" }, it: { content: "Cliente dal 2023" } };

      t["torque-faq-title"] = { es: { content: "<strong>Preguntas frecuentes</strong>" }, it: { content: "<strong>Domande frequenti</strong>" } };
      t["torque-faq-item-1"] = { es: { label: "¿El diagnóstico realmente no tiene costo?" }, it: { label: "La diagnosi è davvero gratuita?" } };
      t["torque-faq-item-1-body"] = { es: { content: "Correcto. El escaneo y la revisión de 30 puntos no tienen costo, aceptes o no la reparación que propongamos." }, it: { content: "Sì. La scansione e il controllo di 30 punti sono gratuiti, indipendentemente dal fatto che tu accetti la riparazione proposta." } };
      t["torque-faq-item-2"] = { es: { label: "¿Usan repuestos originales o genéricos?" }, it: { label: "Usate ricambi originali o generici?" } };
      t["torque-faq-item-2-body"] = { es: { content: "Trabajamos con repuestos originales por defecto; si existe una alternativa genérica de calidad certificada, te la ofrecemos como opción con el ahorro correspondiente." }, it: { content: "Lavoriamo con ricambi originali per impostazione predefinita; se esiste un'alternativa generica di qualità certificata, te la offriamo come opzione con il relativo risparmio." } };
      t["torque-faq-item-3"] = { es: { label: "¿Cuánto tiempo tardan en devolverme el auto?" }, it: { label: "Quanto tempo impiegate per restituire l'auto?" } };
      t["torque-faq-item-3-body"] = { es: { content: "El mantenimiento preventivo se entrega el mismo día. Las reparaciones mayores te damos un tiempo estimado por escrito antes de autorizar el trabajo." }, it: { content: "La manutenzione preventiva viene consegnata lo stesso giorno. Per le riparazioni importanti forniamo una stima scritta prima di autorizzare il lavoro." } };

      t["torque-alert"] = { es: { message: "Recibimos vehículos de lunes a sábado de 8:00 a 18:00. El diagnóstico inicial no tiene costo y no compromete a reparar con nosotros." }, it: { message: "Riceviamo veicoli dal lunedì al sabato, dalle 8:00 alle 18:00. La diagnosi iniziale è gratuita e non ti impegna a riparare con noi." } };

      t["torque-appointment-title"] = { es: { content: "<strong>Agenda tu cita</strong>" }, it: { content: "<strong>Prenota il tuo appuntamento</strong>" } };
      t["torque-appointment-sub"] = { es: { content: "Completa el formulario y te confirmamos horario disponible en menos de 2 horas." }, it: { content: "Compila il modulo e ti confermeremo un orario disponibile entro 2 ore." } };
      t["torque-label-name"] = { es: { text: "Nombre completo" }, it: { text: "Nome completo" } };
      t["torque-input-name"] = { es: { placeholder: "Tu nombre completo" }, it: { placeholder: "Il tuo nome completo" } };
      t["torque-label-email"] = { es: { text: "Correo electrónico" }, it: { text: "Email" } };
      t["torque-input-email"] = { es: { placeholder: "tu@correo.com" }, it: { placeholder: "tu@email.com" } };
      t["torque-label-service"] = { es: { text: "Servicio requerido" }, it: { text: "Servizio richiesto" } };
      t["torque-select-service"] = { es: { placeholder: "Elige un servicio…", ariaLabel: "Servicio requerido", label: "Aún no lo sé, quiero una revisión", value: "revision" }, it: { placeholder: "Scegli un servizio…", ariaLabel: "Servizio richiesto", label: "Non sono ancora sicuro, vorrei un controllo", value: "revision" } };
      t["torque-submit"] = { es: { label: "Solicitar cita" }, it: { label: "Richiedi appuntamento" } };

      t["torque-footer-copyright"] = { es: { content: "© 2026 Torque & Fierro Servicio Automotriz. Todos los derechos reservados." }, it: { content: "© 2026 Torque & Fierro Servizio Automotivo. Tutti i diritti riservati." } };

      return t;
    })(),
  };
}

export const autoRepairPageMeta: LayoutPageMeta = {
  title: "Torque & Fierro · Auto repair and general mechanics",
  description:
    "Auto repair shop with free diagnostics, preventive maintenance and general repair with a written warranty. Book your appointment.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Torque & Fierro · Auto repair and general mechanics",
      description: "Free diagnostics, preventive maintenance and a written warranty. Book your appointment today.",
      image: "https://images.unsplash.com/photo-1632823469850-1b7b1e8b7692?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Torque & Fierro · Auto repair and general mechanics",
      description: "Free diagnostics, preventive maintenance and a written warranty. Book your appointment today.",
      image: "https://images.unsplash.com/photo-1632823469850-1b7b1e8b7692?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    es: {
      title: "Torque & Fierro · Servicio automotriz y mecánica general",
      description: "Taller mecánico con diagnóstico sin costo, mantenimiento preventivo y reparación general con garantía por escrito. Agenda tu cita.",
      seo: {
        openGraph: { title: "Torque & Fierro · Servicio automotriz y mecánica general", description: "Diagnóstico sin costo, mantenimiento preventivo y garantía por escrito. Agenda tu cita hoy." },
        twitter: { title: "Torque & Fierro · Servicio automotriz y mecánica general", description: "Diagnóstico sin costo, mantenimiento preventivo y garantía por escrito. Agenda tu cita hoy." },
      },
    },
    it: {
      title: "Torque & Fierro · Officina meccanica e riparazioni auto",
      description: "Officina meccanica con diagnosi gratuita, manutenzione preventiva e riparazioni generali con garanzia scritta. Prenota il tuo appuntamento.",
      seo: {
        openGraph: { title: "Torque & Fierro · Officina meccanica e riparazioni auto", description: "Diagnosi gratuita, manutenzione preventiva e garanzia scritta. Prenota oggi il tuo appuntamento." },
        twitter: { title: "Torque & Fierro · Officina meccanica e riparazioni auto", description: "Diagnosi gratuita, manutenzione preventiva e garanzia scritta. Prenota oggi il tuo appuntamento." },
      },
    },
  },
};
