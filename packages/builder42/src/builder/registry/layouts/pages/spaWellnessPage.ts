import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { darkBandStyleFor, type LayoutPageMeta } from "../helpers";

/**
 * Página "Spa y bienestar" — plantilla NUEVA de sector (docs/48 §2 fila 14,
 * F5): "Alma Spa & Wellness", tratamientos de spa y bienestar.
 *
 * Arquetipo A2b — variante de A2 (split zig-zag, ya usado por
 * `dental-clinic-page` en F2). Difiere de A2 en ≥2/5 rasgos de firma
 * (`layoutSignature.helper.ts`), verificado por `allSignaturesDistinct`:
 *   1. **`gridColumns` distinto**: A2 alterna lado con `flexDirection: row`
 *      (flex, NO grid — `gridColumns.kind === "none"`) sobre pares de hijos
 *      reordenados. A2b usa un **grid real de 2 columnas** en cada par
 *      (`gridTemplateColumns: "1fr 1fr"` desde el breakpoint de switch), así
 *      que `layoutSignature` calcula `gridColumns.kind === "columns"` (count
 *      2, symmetric) — patrón distinto al `"none"` de A2.
 *   2. **`overrideBreakpoints` distinto**: A2 cambia de columna en `md`. A2b
 *      cambia en `sm` (densidad más generosa: pasa a 2 columnas antes, en
 *      pantallas más angostas) — el set de breakpoints con override en el
 *      nodo de contenido difiere (`["sm"]` vs `["md"]`).
 * Suma un tercer rasgo distinto de facto: la banda de horarios usa
 * `accordion` (ausente en `dental-clinic-page`, que no tiene sección de
 * horarios) y la de tratamientos alterna 4 pares (no 3 como dental), con un
 * ritmo de densidad distinto en la franja de reseñas (grid fluido
 * `repeat(auto-fit, minmax(...))`, que A2 tampoco usa en ninguna banda).
 *
 * Tema "Serenity" (salvia/terracota, tipografía Marcellus + Karla —
 * `display` serif para titulares, `sans` para cuerpo).
 *
 * Showcase funcional: `reveal-on-scroll` en las bandas de tratamientos y
 * testimonios, `accordion` de horarios.
 *
 * Anatomía: topbar (horario + language-nav) · navbar · hero relajante ·
 * tratamientos en pares zig-zag (grid 2 col, A2b) · horarios en `accordion` ·
 * testimonios (grid fluido) · reserva/contacto (`form`) · ubicación · footer.
 *
 * Todos los ids con prefijo `spa-`.
 */

const INNER_MAX = "1160px";
const BAND_PADDING = "clamp(48px, 8vw, 96px) 20px";
const REVEAL: BuilderNode["behaviors"] = [{ type: "reveal-on-scroll", options: { threshold: 0.15, once: true } }];

function band(background: StyleValue, padding: string = BAND_PADDING): NodeStyle {
  return { base: { layout: { display: "flex", flexDirection: "column" }, spacing: { padding }, appearance: { background } } };
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

function sectionTitle(color: StyleValue = { token: "colors.text" }): NodeStyle {
  return {
    base: {
      size: { maxWidth: "26ch" },
      typography: {
        fontFamily: { token: "typography.families.display" },
        fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
        fontWeight: { token: "typography.weights.bold" },
        lineHeight: "1.15",
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

/**
 * Par media/copy en GRID real de 2 columnas desde `sm` (A2b, distinto de la
 * flex row/column de A2 que usa `dental-clinic-page`). `reverse` alterna qué
 * hijo va primero en el orden del grid (mismo mecanismo de reordenar hijos
 * que A2, porque el modelo no tiene `direction: rtl` ni grid-auto-flow denso
 * por columna invertida — la alternancia de lado sigue siendo por orden de
 * `children`, lo que cambia es que el contenedor es un GRID, no un flex).
 */
function treatmentPair(
  n: 1 | 2 | 3 | 4,
  title: string,
  text: string,
  imageUrl: string,
  alt: string,
  reverse: boolean,
) {
  const mediaId = `spa-treatment-${n}-media`;
  const copyId = `spa-treatment-${n}-copy`;
  return {
    [`spa-treatment-${n}`]: {
      id: `spa-treatment-${n}`,
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "grid", gridTemplateColumns: "1fr", gap: "clamp(20px, 3vw, 32px)", alignItems: "center" },
        },
        overrides: { sm: { layout: { gridTemplateColumns: "1fr 1fr" } } },
      },
      children: reverse ? [copyId, mediaId] : [mediaId, copyId],
    },
    [mediaId]: {
      id: mediaId,
      type: "image",
      props: { source: { kind: "url", url: imageUrl }, alt, objectFit: "cover", loading: "lazy" },
      style: {
        base: { size: { width: "100%", height: "260px" }, appearance: { borderRadius: "24px", boxShadow: "0 16px 36px rgba(74,66,54,0.14)" } },
        overrides: { sm: { size: { height: "320px" } }, lg: { size: { height: "360px" } } },
      },
    },
    [copyId]: {
      id: copyId,
      type: "container",
      props: {},
      style: { base: { layout: { display: "flex", flexDirection: "column", gap: "12px" } } },
      children: [`spa-treatment-${n}-title`, `spa-treatment-${n}-text`],
    },
    [`spa-treatment-${n}-title`]: {
      id: `spa-treatment-${n}-title`,
      type: "text",
      props: { content: `<strong>${title}</strong>` },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.display" }, fontSize: "1.375rem", lineHeight: "1.3", fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    [`spa-treatment-${n}-text`]: {
      id: `spa-treatment-${n}-text`,
      type: "text",
      props: { content: text },
      style: bodyText(),
    },
  };
}

function reviewCard(n: 1 | 2 | 3, quote: string, name: string, role: string, initials: string) {
  return {
    [`spa-review-${n}`]: {
      id: `spa-review-${n}`,
      type: "testimonial",
      props: { quote, name, role, initials },
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: "12px" },
          spacing: { padding: "clamp(20px, 3vw, 28px)" },
          appearance: {
            background: { token: "colors.surface.default" },
            borderRadius: "20px",
            boxShadow: "0 14px 32px rgba(74,66,54,0.1)",
          },
        },
        states: { hover: { appearance: { boxShadow: "0 20px 44px rgba(74,66,54,0.18)" } } },
      },
    },
  };
}

export function buildSpaWellnessPageFragment(): NodeFragment {
  return {
    rootId: "spa-root",
    nodes: {
      "spa-root": {
        id: "spa-root",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "stretch" } } },
        children: [
          "spa-topbar",
          "spa-navbar",
          "spa-hero",
          "spa-treatments",
          "spa-schedule",
          "spa-reviews",
          "spa-booking",
          "spa-location",
          "spa-footer",
        ],
      },

      // --- Topbar: horario + language-nav ---------------------------------------
      "spa-topbar": {
        id: "spa-topbar",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "8px 20px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { color: { token: "colors.muted" }, background: { token: "colors.surface.alt" } },
          },
        },
        children: ["spa-topbar-hours", "spa-topbar-lang"],
      },
      "spa-topbar-hours": {
        id: "spa-topbar-hours",
        type: "text",
        props: { content: "Todos los días 9:00–20:00" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "spa-topbar-lang": {
        id: "spa-topbar-lang",
        type: "language-nav",
        props: { triggerMode: "text", displayMode: "native", showCurrent: true, ariaLabel: "Idioma" },
        style: defaultStyleFor("language-nav"),
      },

      // --- Navbar -----------------------------------------------------------------
      "spa-navbar": {
        id: "spa-navbar",
        type: "navbar",
        props: { brand: "Alma Spa & Wellness", hiddenPageIds: [] },
        style: defaultStyleFor("navbar"),
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
      },

      // --- Hero relajante -----------------------------------------------------------
      "spa-hero": {
        id: "spa-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "16px" },
            spacing: { padding: "clamp(56px, 9vw, 112px) 20px" },
            size: { width: "100%", minHeight: "420px" },
            typography: { fontFamily: { token: "typography.families.display" }, textAlign: "center" },
            appearance: {
              background:
                "linear-gradient(180deg, rgba(74,90,74,0.6), rgba(74,90,74,0.32)), url('https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              color: { token: "colors.band.on" },
            },
          },
        },
        children: ["spa-hero-title", "spa-hero-sub", "spa-hero-cta"],
      },
      "spa-hero-title": {
        id: "spa-hero-title",
        type: "text",
        props: { content: "<strong>Un espacio para pausar de verdad</strong>" },
        style: {
          base: {
            size: { maxWidth: "20ch" },
            typography: {
              fontFamily: { token: "typography.families.display" },
              fontSize: "clamp(2.25rem, 6vw, 4rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.1",
            },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "spa-hero-sub": {
        id: "spa-hero-sub",
        type: "text",
        props: { content: "Masajes, rituales de bienestar y terapias corporales en un ambiente pensado para desconectar." },
        style: {
          base: {
            size: { maxWidth: "48ch" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: "clamp(1rem, 1.6vw, 1.125rem)" },
            appearance: { color: { token: "colors.band.on" } },
          },
        },
      },
      "spa-hero-cta": {
        id: "spa-hero-cta",
        type: "button",
        props: { label: "Reservar tratamiento", link: { kind: "anchor", nodeId: "spa-booking" } },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: "24px",
              boxShadow: "0 12px 32px rgba(74,66,54,0.28)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(74,66,54,0.36)" } } },
        },
      },

      // --- Tratamientos: A2b, pares en grid, alternando lado ----------------------
      "spa-treatments": {
        id: "spa-treatments",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["spa-treatments-inner"],
      },
      "spa-treatments-inner": {
        id: "spa-treatments-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["spa-treatments-title", "spa-treatments-list"],
      },
      "spa-treatments-title": {
        id: "spa-treatments-title",
        type: "text",
        props: { content: "<strong>Nuestros tratamientos</strong>" },
        style: sectionTitle(),
      },
      "spa-treatments-list": {
        id: "spa-treatments-list",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: "clamp(32px, 5vw, 56px)" } } },
        children: ["spa-treatment-1", "spa-treatment-2", "spa-treatment-3", "spa-treatment-4"],
      },
      ...treatmentPair(
        1,
        "Masaje de piedras calientes",
        "Piedras volcánicas templadas que liberan tensión profunda en espalda, cuello y hombros.",
        "https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80&auto=format&fit=crop",
        "Piedras calientes sobre la espalda durante un masaje",
        false,
      ),
      ...treatmentPair(
        2,
        "Ritual facial de argán",
        "Limpieza profunda, exfoliación suave y masaje facial con aceite de argán para piel luminosa.",
        "https://images.unsplash.com/photo-1616394158624-0cb6490dc1c8?w=800&q=80&auto=format&fit=crop",
        "Aplicación de ritual facial con aceite de argán",
        true,
      ),
      ...treatmentPair(
        3,
        "Circuito de hidroterapia",
        "Piscina de contraste, sauna seco y baño de vapor para reactivar la circulación.",
        "https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80&auto=format&fit=crop",
        "Piscina de hidroterapia con luz cálida",
        false,
      ),
      ...treatmentPair(
        4,
        "Masaje de pareja",
        "Una hora de masaje relajante en sala privada, pensado para compartir el silencio.",
        "https://images.unsplash.com/photo-1596178060810-72660fb6c637?w=800&q=80&auto=format&fit=crop",
        "Sala privada preparada para un masaje de pareja",
        true,
      ),

      // --- Horarios en accordion — banda alt --------------------------------------
      "spa-schedule": {
        id: "spa-schedule",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        children: ["spa-schedule-inner"],
      },
      "spa-schedule-inner": {
        id: "spa-schedule-inner",
        type: "container",
        props: {},
        style: inner("760px"),
        children: ["spa-schedule-title", "spa-schedule-accordion"],
      },
      "spa-schedule-title": {
        id: "spa-schedule-title",
        type: "text",
        props: { content: "<strong>Horarios por servicio</strong>" },
        style: sectionTitle(),
      },
      "spa-schedule-accordion": {
        id: "spa-schedule-accordion",
        type: "accordion",
        props: {},
        style: defaultStyleFor("accordion"),
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["spa-schedule-item-1", "spa-schedule-item-2", "spa-schedule-item-3"],
      },
      "spa-schedule-item-1": {
        id: "spa-schedule-item-1",
        type: "accordion-item",
        props: { label: "Masajes y terapias corporales", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["spa-schedule-item-1-body"],
      },
      "spa-schedule-item-1-body": {
        id: "spa-schedule-item-1-body",
        type: "text",
        props: { content: "Todos los días de 9:00 a 20:00, con última reserva a las 18:30. Recomendamos llegar 15 minutos antes." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "spa-schedule-item-2": {
        id: "spa-schedule-item-2",
        type: "accordion-item",
        props: { label: "Rituales faciales", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["spa-schedule-item-2-body"],
      },
      "spa-schedule-item-2-body": {
        id: "spa-schedule-item-2-body",
        type: "text",
        props: { content: "Martes a domingo de 10:00 a 19:00. Cerrado los lunes para mantenimiento de sala." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "spa-schedule-item-3": {
        id: "spa-schedule-item-3",
        type: "accordion-item",
        props: { label: "Circuito de hidroterapia", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["spa-schedule-item-3-body"],
      },
      "spa-schedule-item-3-body": {
        id: "spa-schedule-item-3-body",
        type: "text",
        props: { content: "Viernes a domingo, sesiones de 90 minutos a las 10:00, 13:00 y 16:00. Cupo limitado a 6 personas." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Testimonios — grid fluido, banda clara ----------------------------------
      "spa-reviews": {
        id: "spa-reviews",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["spa-reviews-inner"],
      },
      "spa-reviews-inner": {
        id: "spa-reviews-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["spa-reviews-title", "spa-reviews-grid"],
      },
      "spa-reviews-title": {
        id: "spa-reviews-title",
        type: "text",
        props: { content: "<strong>Lo que dicen nuestras huéspedes</strong>" },
        style: sectionTitle(),
      },
      "spa-reviews-grid": {
        id: "spa-reviews-grid",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: { token: "spacing.md" } },
            size: { width: "100%", maxWidth: "none" },
            spacing: { padding: "0", margin: "0" },
            appearance: { background: "transparent" },
          },
        },
        children: ["spa-review-1", "spa-review-2", "spa-review-3"],
      },
      ...reviewCard(
        1,
        "Salí del masaje de piedras calientes como nueva. El lugar es tan tranquilo que se me olvidó el teléfono durante dos horas.",
        "Renata Aguayo",
        "Huésped desde 2024",
        "RA",
      ),
      ...reviewCard(
        2,
        "El circuito de hidroterapia es mi ritual de cada mes. El personal siempre recuerda mis preferencias.",
        "Diego Farías",
        "Huésped frecuente",
        "DF",
      ),
      ...reviewCard(
        3,
        "Reservamos el masaje de pareja para nuestro aniversario y fue justo lo que necesitábamos: silencio de verdad.",
        "Camila y Adrián",
        "Huéspedes desde 2023",
        "CA",
      ),

      // --- Reserva/contacto — banda alt ------------------------------------------
      "spa-booking": {
        id: "spa-booking",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        children: ["spa-booking-inner"],
      },
      "spa-booking-inner": {
        id: "spa-booking-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "clamp(24px, 4vw, 40px)" },
            size: { width: "100%", maxWidth: INNER_MAX },
            spacing: { margin: "0 auto" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 320px) 1fr" } } },
        },
        children: ["spa-booking-info", "spa-booking-card"],
      },
      "spa-booking-info": {
        id: "spa-booking-info",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } } },
        children: ["spa-booking-title", "spa-booking-sub"],
      },
      "spa-booking-title": {
        id: "spa-booking-title",
        type: "text",
        props: { content: "<strong>Reserva tu tratamiento</strong>" },
        style: sectionTitle(),
      },
      "spa-booking-sub": {
        id: "spa-booking-sub",
        type: "text",
        props: { content: "Cuéntanos qué tratamiento te interesa y te confirmamos disponibilidad por correo o teléfono." },
        style: bodyText(),
      },
      "spa-booking-card": {
        id: "spa-booking-card",
        type: "card",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px" },
            spacing: { padding: "clamp(20px, 3vw, 28px)" },
            size: { width: "100%" },
            appearance: { background: { token: "colors.surface.default" }, borderRadius: "20px", boxShadow: "0 14px 32px rgba(74,66,54,0.1)" },
          },
        },
        children: ["spa-form"],
      },
      "spa-form": {
        id: "spa-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: defaultStyleFor("form"),
        behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
        children: ["spa-field-name", "spa-field-email", "spa-field-treatment", "spa-field-message", "spa-submit"],
      },
      "spa-field-name": {
        id: "spa-field-name",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["spa-label-name", "spa-input-name"],
      },
      "spa-label-name": {
        id: "spa-label-name",
        type: "label",
        props: { text: "Nombre completo", for: "spa-input-name" },
        style: defaultStyleFor("label"),
      },
      "spa-input-name": {
        id: "spa-input-name",
        type: "input",
        props: { name: "nombre", type: "text", placeholder: "Tu nombre completo", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "spa-field-email": {
        id: "spa-field-email",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["spa-label-email", "spa-input-email"],
      },
      "spa-label-email": {
        id: "spa-label-email",
        type: "label",
        props: { text: "Correo electrónico", for: "spa-input-email" },
        style: defaultStyleFor("label"),
      },
      "spa-input-email": {
        id: "spa-input-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "tu@correo.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "spa-field-treatment": {
        id: "spa-field-treatment",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["spa-label-treatment", "spa-select-treatment"],
      },
      "spa-label-treatment": {
        id: "spa-label-treatment",
        type: "label",
        props: { text: "Tratamiento de interés", for: "spa-select-treatment" },
        style: defaultStyleFor("label"),
      },
      "spa-select-treatment": {
        id: "spa-select-treatment",
        type: "select",
        props: {
          name: "tratamiento",
          placeholder: "Elige una opción…",
          ariaLabel: "Tratamiento de interés",
          options: [
            { label: "Masaje de piedras calientes", value: "piedras" },
            { label: "Ritual facial de argán", value: "facial" },
            { label: "Circuito de hidroterapia", value: "hidroterapia" },
            { label: "Masaje de pareja", value: "pareja" },
          ],
        },
        style: defaultStyleFor("select"),
      },
      "spa-field-message": {
        id: "spa-field-message",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["spa-label-message", "spa-textarea-message"],
      },
      "spa-label-message": {
        id: "spa-label-message",
        type: "label",
        props: { text: "¿Algo que debamos saber?", for: "spa-textarea-message" },
        style: defaultStyleFor("label"),
      },
      "spa-textarea-message": {
        id: "spa-textarea-message",
        type: "textarea",
        props: { name: "mensaje", placeholder: "Ej. Prefiero presión suave, tengo una lesión en el hombro…", rows: 4, required: false, disabled: false },
        style: defaultStyleFor("textarea"),
      },
      "spa-submit": {
        id: "spa-submit",
        type: "button-submit",
        props: { label: "Solicitar reserva", disabled: false },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: "24px",
              boxShadow: "0 12px 32px rgba(74,66,54,0.2)",
            },
          },
          states: { hover: { appearance: { boxShadow: "0 16px 40px rgba(74,66,54,0.28)" } } },
        },
      },

      // --- Ubicación — banda clara ------------------------------------------------
      "spa-location": {
        id: "spa-location",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        children: ["spa-location-inner"],
      },
      "spa-location-inner": {
        id: "spa-location-inner",
        type: "container",
        props: {},
        style: { ...inner("760px", "12px"), base: { ...inner("760px", "12px").base, typography: { textAlign: "center" }, layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" } } },
        children: ["spa-location-title", "spa-location-address"],
      },
      "spa-location-title": {
        id: "spa-location-title",
        type: "text",
        props: { content: "<strong>Cómo llegar</strong>" },
        style: sectionTitle(),
      },
      "spa-location-address": {
        id: "spa-location-address",
        type: "text",
        props: { content: "Av. de las Fuentes 220, San Ángel, Ciudad de México — estacionamiento propio sin costo." },
        style: bodyText(),
      },

      // --- Footer — banda oscura ---------------------------------------------------
      "spa-footer": {
        id: "spa-footer",
        type: "footer",
        props: { copyright: "© 2026 Alma Spa & Wellness. Todos los derechos reservados." },
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
            spacing: { padding: "40px 20px" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { spacing: { padding: "64px 40px" } } },
        },
        children: ["spa-footer-hours", "spa-footer-social"],
      },
      "spa-footer-hours": {
        id: "spa-footer-hours",
        type: "text",
        props: { content: "Todos los días 9:00–20:00" },
        style: { base: { appearance: { color: { token: "colors.band.on" } } } },
      },
      "spa-footer-social": {
        id: "spa-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
    },

    translations: (() => {
      const t: Record<string, NodeTranslations> = {};

      t["spa-topbar-hours"] = { en: { content: "Open every day 9:00 AM–8:00 PM" }, it: { content: "Tutti i giorni 9:00–20:00" } };

      t["spa-hero-title"] = {
        en: { content: "<strong>A space to truly pause</strong>" },
        it: { content: "<strong>Uno spazio per fermarsi davvero</strong>" },
      };
      t["spa-hero-sub"] = {
        en: { content: "Massages, wellness rituals and body therapies in an environment designed to help you disconnect." },
        it: { content: "Massaggi, rituali di benessere e terapie corporee in un ambiente pensato per disconnettersi." },
      };
      t["spa-hero-cta"] = { en: { label: "Book a treatment" }, it: { label: "Prenota un trattamento" } };

      t["spa-treatments-title"] = { en: { content: "<strong>Our treatments</strong>" }, it: { content: "<strong>I nostri trattamenti</strong>" } };

      t["spa-treatment-1-title"] = { en: { content: "<strong>Hot stone massage</strong>" }, it: { content: "<strong>Massaggio con pietre calde</strong>" } };
      t["spa-treatment-1-text"] = {
        en: { content: "Warm volcanic stones that release deep tension in the back, neck and shoulders." },
        it: { content: "Pietre vulcaniche calde che sciolgono la tensione profonda su schiena, collo e spalle." },
      };
      t["spa-treatment-1-media"] = { en: { alt: "Hot stones on the back during a massage" }, it: { alt: "Pietre calde sulla schiena durante un massaggio" } };

      t["spa-treatment-2-title"] = { en: { content: "<strong>Argan facial ritual</strong>" }, it: { content: "<strong>Rituale viso all'argan</strong>" } };
      t["spa-treatment-2-text"] = {
        en: { content: "Deep cleansing, gentle exfoliation and facial massage with argan oil for radiant skin." },
        it: { content: "Pulizia profonda, esfoliazione delicata e massaggio viso con olio di argan per una pelle luminosa." },
      };
      t["spa-treatment-2-media"] = { en: { alt: "Applying an argan oil facial ritual" }, it: { alt: "Applicazione di un rituale viso all'olio di argan" } };

      t["spa-treatment-3-title"] = { en: { content: "<strong>Hydrotherapy circuit</strong>" }, it: { content: "<strong>Percorso di idroterapia</strong>" } };
      t["spa-treatment-3-text"] = {
        en: { content: "Contrast pool, dry sauna and steam bath to boost circulation." },
        it: { content: "Piscina a contrasto, sauna secca e bagno turco per stimolare la circolazione." },
      };
      t["spa-treatment-3-media"] = { en: { alt: "Hydrotherapy pool with warm lighting" }, it: { alt: "Piscina di idroterapia con luce calda" } };

      t["spa-treatment-4-title"] = { en: { content: "<strong>Couples massage</strong>" }, it: { content: "<strong>Massaggio di coppia</strong>" } };
      t["spa-treatment-4-text"] = {
        en: { content: "An hour of relaxing massage in a private room, designed to share the silence." },
        it: { content: "Un'ora di massaggio relax in una sala privata, pensata per condividere il silenzio." },
      };
      t["spa-treatment-4-media"] = { en: { alt: "Private room set up for a couples massage" }, it: { alt: "Sala privata allestita per un massaggio di coppia" } };

      t["spa-schedule-title"] = { en: { content: "<strong>Hours by service</strong>" }, it: { content: "<strong>Orari per servizio</strong>" } };
      t["spa-schedule-item-1"] = { en: { label: "Massages & body therapies" }, it: { label: "Massaggi e terapie corporee" } };
      t["spa-schedule-item-1-body"] = {
        en: { content: "Every day from 9:00 AM to 8:00 PM, last booking at 6:30 PM. We recommend arriving 15 minutes early." },
        it: { content: "Tutti i giorni dalle 9:00 alle 20:00, ultima prenotazione alle 18:30. Consigliamo di arrivare 15 minuti prima." },
      };
      t["spa-schedule-item-2"] = { en: { label: "Facial rituals" }, it: { label: "Rituali viso" } };
      t["spa-schedule-item-2-body"] = {
        en: { content: "Tuesday to Sunday from 10:00 AM to 7:00 PM. Closed on Mondays for room maintenance." },
        it: { content: "Da martedì a domenica dalle 10:00 alle 19:00. Chiuso il lunedì per manutenzione." },
      };
      t["spa-schedule-item-3"] = { en: { label: "Hydrotherapy circuit" }, it: { label: "Percorso di idroterapia" } };
      t["spa-schedule-item-3-body"] = {
        en: { content: "Friday to Sunday, 90-minute sessions at 10:00 AM, 1:00 PM and 4:00 PM. Limited to 6 people." },
        it: { content: "Da venerdì a domenica, sessioni di 90 minuti alle 10:00, 13:00 e 16:00. Massimo 6 persone." },
      };

      t["spa-reviews-title"] = { en: { content: "<strong>What our guests say</strong>" }, it: { content: "<strong>Cosa dicono le nostre ospiti</strong>" } };
      t["spa-review-1"] = {
        en: {
          quote: "I left the hot stone massage feeling brand new. The place is so quiet I forgot my phone for two hours.",
          name: "Renata Aguayo",
          role: "Guest since 2024",
        },
        it: {
          quote: "Sono uscita dal massaggio con pietre calde come nuova. Il posto è così tranquillo che ho dimenticato il telefono per due ore.",
          name: "Renata Aguayo",
          role: "Ospite dal 2024",
        },
      };
      t["spa-review-2"] = {
        en: {
          quote: "The hydrotherapy circuit is my monthly ritual. The staff always remembers my preferences.",
          name: "Diego Farías",
          role: "Regular guest",
        },
        it: {
          quote: "Il percorso di idroterapia è il mio rituale mensile. Il personale ricorda sempre le mie preferenze.",
          name: "Diego Farías",
          role: "Ospite abituale",
        },
      };
      t["spa-review-3"] = {
        en: {
          quote: "We booked the couples massage for our anniversary and it was exactly what we needed: real silence.",
          name: "Camila & Adrián",
          role: "Guests since 2023",
        },
        it: {
          quote: "Abbiamo prenotato il massaggio di coppia per il nostro anniversario ed era esattamente ciò di cui avevamo bisogno: silenzio vero.",
          name: "Camila & Adrián",
          role: "Ospiti dal 2023",
        },
      };

      t["spa-booking-title"] = { en: { content: "<strong>Book your treatment</strong>" }, it: { content: "<strong>Prenota il tuo trattamento</strong>" } };
      t["spa-booking-sub"] = {
        en: { content: "Tell us which treatment you're interested in and we'll confirm availability by email or phone." },
        it: { content: "Dicci quale trattamento ti interessa e ti confermeremo la disponibilità per email o telefono." },
      };
      t["spa-label-name"] = { en: { text: "Full name" }, it: { text: "Nome completo" } };
      t["spa-input-name"] = { en: { placeholder: "Your full name" }, it: { placeholder: "Il tuo nome completo" } };
      t["spa-label-email"] = { en: { text: "Email" }, it: { text: "Email" } };
      t["spa-input-email"] = { en: { placeholder: "you@email.com" }, it: { placeholder: "tu@email.com" } };
      t["spa-label-treatment"] = { en: { text: "Treatment of interest" }, it: { text: "Trattamento di interesse" } };
      t["spa-select-treatment"] = {
        en: {
          placeholder: "Choose an option…",
          ariaLabel: "Treatment of interest",
          options: [
            { label: "Hot stone massage", value: "piedras" },
            { label: "Argan facial ritual", value: "facial" },
            { label: "Hydrotherapy circuit", value: "hidroterapia" },
            { label: "Couples massage", value: "pareja" },
          ],
        },
        it: {
          placeholder: "Scegli un'opzione…",
          ariaLabel: "Trattamento di interesse",
          options: [
            { label: "Massaggio con pietre calde", value: "piedras" },
            { label: "Rituale viso all'argan", value: "facial" },
            { label: "Percorso di idroterapia", value: "hidroterapia" },
            { label: "Massaggio di coppia", value: "pareja" },
          ],
        },
      };
      t["spa-label-message"] = { en: { text: "Anything we should know?" }, it: { text: "C'è qualcosa che dovremmo sapere?" } };
      t["spa-textarea-message"] = {
        en: { placeholder: "E.g. I prefer light pressure, I have a shoulder injury…" },
        it: { placeholder: "Es. Preferisco una pressione leggera, ho un infortunio alla spalla…" },
      };
      t["spa-submit"] = { en: { label: "Request booking" }, it: { label: "Richiedi prenotazione" } };

      t["spa-location-title"] = { en: { content: "<strong>How to get here</strong>" }, it: { content: "<strong>Come arrivare</strong>" } };
      t["spa-location-address"] = {
        en: { content: "220 Fuentes Ave, San Ángel, Mexico City — free parking on site." },
        it: { content: "Av. de las Fuentes 220, San Ángel, Città del Messico — parcheggio gratuito." },
      };

      t["spa-footer"] = {
        en: { copyright: "© 2026 Alma Spa & Wellness. All rights reserved." },
        it: { copyright: "© 2026 Alma Spa & Wellness. Tutti i diritti riservati." },
      };
      t["spa-footer-hours"] = { en: { content: "Open every day 9:00 AM–8:00 PM" }, it: { content: "Tutti i giorni 9:00–20:00" } };

      return t;
    })(),
  };
}

export const spaWellnessPageMeta: LayoutPageMeta = {
  title: "Alma Spa & Wellness · Masajes y rituales de bienestar",
  description: "Spa de bienestar con masajes, rituales faciales e hidroterapia en un ambiente pensado para desconectar.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Alma Spa & Wellness",
      description: "Un espacio para pausar de verdad. Reserva tu tratamiento.",
      image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Alma Spa & Wellness",
      description: "Un espacio para pausar de verdad. Reserva tu tratamiento.",
      image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    en: {
      title: "Alma Spa & Wellness · Massages and wellness rituals",
      description: "Wellness spa with massages, facial rituals and hydrotherapy in an environment designed to help you disconnect.",
      seo: {
        openGraph: { title: "Alma Spa & Wellness", description: "A space to truly pause. Book your treatment." },
        twitter: { title: "Alma Spa & Wellness", description: "A space to truly pause. Book your treatment." },
      },
    },
    it: {
      title: "Alma Spa & Wellness · Massaggi e rituali di benessere",
      description: "Spa di benessere con massaggi, rituali viso e idroterapia in un ambiente pensato per disconnettersi.",
      seo: {
        openGraph: { title: "Alma Spa & Wellness", description: "Uno spazio per fermarsi davvero. Prenota il tuo trattamento." },
        twitter: { title: "Alma Spa & Wellness", description: "Uno spazio per fermarsi davvero. Prenota il tuo trattamento." },
      },
    },
  },
};
