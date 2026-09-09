import type { NodeFragment } from "../../../model/tree";
import type { NodeTranslations } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { NAVBAR_BRAND_STYLE } from "../../components/Navbar";
import { darkBandStyleFor, pricingCardFragment, statFragment, testimonialFragment } from "../helpers";

/**
 * Página "Gimnasio / estudio fitness" — plantilla de negocio real
 * (encargo del orquestador de plantillas multilingües): topbar con horario +
 * `language-nav`, navbar, hero con CTA de clase gratis, horario de clases en
 * `tabs`, franja de `stat`, planes con `pricing-card`, testimonio, FAQ en
 * `accordion` y bloque de inscripción con `form`. Sitio multilingüe (es
 * default, en/it via `fragment.translations`).
 *
 * Lenguaje visual (docs/43): la raíz es FULL-BLEED (sin `maxWidth`); cada
 * banda declara su propio fondo (claro → alt → degradado de acento → oscuro
 * → claro → alt) y envuelve su contenido en un `inner` centrado
 * (`maxWidth: sizes.container`, `margin: 0 auto`). Tipografía fluida con
 * `clamp()` en hero/títulos de sección, tarjetas de plan con sombra + hover,
 * plan destacado con degradado de acento propio, grids mobile-first que
 * escalan en `md`/`lg`. Todos los ids llevan el prefijo `fitness-`; los
 * componentes especializados (`navbar`, `tabs`, `pricing-card`, `testimonial`,
 * `accordion`, `form`…) siguen usando `defaultStyleFor`.
 */
export function buildFitnessStudioPageFragment(): NodeFragment {
  const fragment: NodeFragment = {
    rootId: "fitness-root",
    nodes: {
      // --- Raíz full-bleed (docs/43 §1): SIN maxWidth ------------------------
      "fitness-root": {
        id: "fitness-root",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch", gap: "0px" },
            appearance: { background: { token: "colors.surface.default" } },
          },
        },
        children: [
          "fitness-topbar",
          "fitness-navbar",
          "fitness-hero",
          "fitness-schedule",
          "fitness-stats",
          "fitness-plans",
          "fitness-testimonial-section",
          "fitness-faq",
          "fitness-signup",
          "fitness-footer",
        ],
      },

      // --- Topbar: horario + language-nav a la derecha ---------------------
      "fitness-topbar": {
        id: "fitness-topbar",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "8px 20px" },
            size: { width: "100%" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: { color: { token: "colors.surface.default" }, background: { token: "colors.text" } },
          },
        },
        children: ["fitness-topbar-schedule", "fitness-topbar-lang"],
      },
      "fitness-topbar-schedule": {
        id: "fitness-topbar-schedule",
        type: "text",
        props: { content: "Monday to Friday 6:00–22:00 · Saturdays 8:00–14:00" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "fitness-topbar-lang": {
        id: "fitness-topbar-lang",
        type: "language-nav",
        props: { triggerMode: "text", displayMode: "native", showCurrent: true, ariaLabel: "Idioma" },
        // Banda oscura: el `defaultStyle` del componente usa `colors.text`
        // (docs/43 §3, guarda `lowContrastOnDarkBands`).
        style: darkBandStyleFor("language-nav"),
      },

      // --- Navbar ------------------------------------------------------------
      "fitness-navbar": {
        id: "fitness-navbar",
        type: "navbar",
        props: { hiddenPageIds: [] },
        style: defaultStyleFor("navbar"),
        behaviors: [{ type: "navbar", options: { duration: 240 } }],
        children: ["fitness-navbar-brand-container"],
      },
      "fitness-navbar-brand-container": {
        id: "fitness-navbar-brand-container",
        type: "container",
        props: {},
        style: NAVBAR_BRAND_STYLE,
        children: ["fitness-navbar-brand"],
      },
      "fitness-navbar-brand": {
        id: "fitness-navbar-brand",
        type: "text",
        props: { content: "<strong>Vértice Fitness Studio</strong>" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.sans" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },

      // --- Hero: scrim + foto, titular fluido grande --------------------------
      "fitness-hero": {
        id: "fitness-hero",
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
                "linear-gradient(180deg, rgba(15,23,42,0.72), rgba(15,23,42,0.55)), url('https://images.unsplash.com/photo-1637430308606-86576d8fef3c?w=1600&q=80&auto=format&fit=crop') center/cover no-repeat",
              color: { token: "colors.surface.default" },
            },
          },
          overrides: { md: { layout: { gap: "24px" }, spacing: { padding: "112px 20px" } } },
        },
        children: ["fitness-hero-title", "fitness-hero-sub", "fitness-hero-cta"],
      },
      "fitness-hero-title": {
        id: "fitness-hero-title",
        type: "text",
        props: { content: "<strong>Train hard, train together</strong>" },
        style: {
          base: {
            size: { maxWidth: "22ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(2.25rem, 6vw, 4rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.05",
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "fitness-hero-sub": {
        id: "fitness-hero-sub",
        type: "text",
        props: {
          content:
            "Strength, cardio and mobility classes for every level, with certified coaches and flexible schedules.",
        },
        style: {
          base: {
            size: { maxWidth: "48ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1rem, 1.6vw, 1.125rem)",
              lineHeight: { token: "typography.lineHeights.normal" },
            },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "fitness-hero-cta": {
        id: "fitness-hero-cta",
        type: "button",
        props: { label: "First class free", link: { kind: "anchor", nodeId: "fitness-signup" } },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: { token: "radii.md" },
              boxShadow: "0 12px 32px rgba(15,23,42,0.28)",
            },
          },
          states: {
            hover: {
              appearance: { boxShadow: "0 16px 40px rgba(15,23,42,0.36)" },
            },
          },
        },
      },

      // --- Horario de clases: timeline vertical numerado — banda clara --------
      "fitness-schedule": {
        id: "fitness-schedule",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "48px 20px", margin: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["fitness-schedule-inner"],
      },
      "fitness-schedule-inner": {
        id: "fitness-schedule-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "24px" },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
          overrides: { md: { layout: { gap: "40px" } } },
        },
        children: ["fitness-schedule-title", "fitness-schedule-sub", "fitness-timeline"],
      },
      "fitness-schedule-title": {
        id: "fitness-schedule-title",
        type: "text",
        props: { content: "<strong>Weekly class schedule</strong>" },
        style: {
          base: {
            typography: { fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: { token: "typography.weights.bold" }, lineHeight: "1.15" },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "fitness-schedule-sub": {
        id: "fitness-schedule-sub",
        type: "text",
        props: { content: "Pick the type of training that best fits your goal." },
        style: {
          base: {
            size: { maxWidth: "62ch" },
            typography: { fontSize: "clamp(1rem, 1.6vw, 1.125rem)" },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
      // Arquetipo A11 (docs/48 §2): secuencia VERTICAL numerada en vez de
      // `tabs` horizontales — cada paso es una fila numerada con un
      // separador de borde izquierdo continuo (`::before` no existe en el
      // modelo, así que el "riel" se aproxima con un borde izquierdo grueso
      // en color de acento sobre cada número).
      "fitness-timeline": {
        id: "fitness-timeline",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "0" },
          },
        },
        children: ["fitness-timeline-step-1", "fitness-timeline-step-2", "fitness-timeline-step-3"],
      },
      "fitness-timeline-step-1": {
        id: "fitness-timeline-step-1",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.sm" }, alignItems: "start" },
            spacing: { padding: "16px 0 16px 12px" },
            appearance: { borderWidth: "0 0 0 3px", borderStyle: "solid", borderColor: { token: "colors.primary.default" } },
          },
          overrides: {
            sm: { layout: { gridTemplateColumns: "56px 1fr", gap: { token: "spacing.md" } } },
            md: { layout: { gridTemplateColumns: "72px 1fr" }, spacing: { padding: "24px 0 24px 20px" } },
          },
        },
        children: ["fitness-timeline-step-1-number", "fitness-timeline-step-1-body"],
      },
      "fitness-timeline-step-1-number": {
        id: "fitness-timeline-step-1-number",
        type: "text",
        props: { content: "01" },
        style: {
          base: {
            layout: { display: "flex", justifyContent: "center" },
            spacing: { padding: "0 0 0 12px" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.primary.default" } },
          },
          overrides: { md: { spacing: { padding: "0 0 0 20px" } } },
        },
      },
      "fitness-timeline-step-1-body": {
        id: "fitness-timeline-step-1-body",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["fitness-tab-strength", "fitness-tab-strength-text"],
      },
      "fitness-tab-strength": {
        id: "fitness-tab-strength",
        type: "text",
        props: { content: "<strong>Strength</strong>" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: "1.25rem", fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "fitness-tab-strength-text": {
        id: "fitness-tab-strength-text",
        type: "text",
        props: {
          content:
            "<p>Monday, Wednesday and Friday · 7:00, 13:00 and 19:00. Barbell, dumbbell and bodyweight work, in small groups.</p>",
        },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "fitness-timeline-step-2": {
        id: "fitness-timeline-step-2",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.sm" }, alignItems: "start" },
            spacing: { padding: "16px 0 16px 12px" },
            appearance: { borderWidth: "0 0 0 3px", borderStyle: "solid", borderColor: { token: "colors.primary.default" } },
          },
          overrides: {
            sm: { layout: { gridTemplateColumns: "56px 1fr", gap: { token: "spacing.md" } } },
            md: { layout: { gridTemplateColumns: "72px 1fr" }, spacing: { padding: "24px 0 24px 20px" } },
          },
        },
        children: ["fitness-timeline-step-2-number", "fitness-timeline-step-2-body"],
      },
      "fitness-timeline-step-2-number": {
        id: "fitness-timeline-step-2-number",
        type: "text",
        props: { content: "02" },
        style: {
          base: {
            layout: { display: "flex", justifyContent: "center" },
            spacing: { padding: "0 0 0 12px" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.primary.default" } },
          },
          overrides: { md: { spacing: { padding: "0 0 0 20px" } } },
        },
      },
      "fitness-timeline-step-2-body": {
        id: "fitness-timeline-step-2-body",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["fitness-tab-cardio", "fitness-tab-cardio-text"],
      },
      "fitness-tab-cardio": {
        id: "fitness-tab-cardio",
        type: "text",
        props: { content: "<strong>Cardio</strong>" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: "1.25rem", fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "fitness-tab-cardio-text": {
        id: "fitness-tab-cardio-text",
        type: "text",
        props: {
          content:
            "<p>Tuesday and Thursday · 6:30, 12:00 and 18:30. 45-minute HIIT intervals and cardiovascular endurance sessions.</p>",
        },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "fitness-timeline-step-3": {
        id: "fitness-timeline-step-3",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.sm" }, alignItems: "start" },
            spacing: { padding: "16px 0 16px 12px" },
          },
          overrides: {
            sm: { layout: { gridTemplateColumns: "56px 1fr", gap: { token: "spacing.md" } } },
            md: { layout: { gridTemplateColumns: "72px 1fr" }, spacing: { padding: "24px 0 24px 20px" } },
          },
        },
        children: ["fitness-timeline-step-3-number", "fitness-timeline-step-3-body"],
      },
      "fitness-timeline-step-3-number": {
        id: "fitness-timeline-step-3-number",
        type: "text",
        props: { content: "03" },
        style: {
          base: {
            layout: { display: "flex", justifyContent: "center" },
            spacing: { padding: "0 0 0 12px" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1.5rem, 2.5vw, 2rem)",
              fontWeight: { token: "typography.weights.bold" },
            },
            appearance: { color: { token: "colors.primary.default" } },
          },
          overrides: { md: { spacing: { padding: "0 0 0 20px" } } },
        },
      },
      "fitness-timeline-step-3-body": {
        id: "fitness-timeline-step-3-body",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["fitness-tab-mobility", "fitness-tab-mobility-text"],
      },
      "fitness-tab-mobility": {
        id: "fitness-tab-mobility",
        type: "text",
        props: { content: "<strong>Mobility</strong>" },
        style: {
          base: {
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: "1.25rem", fontWeight: { token: "typography.weights.bold" } },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "fitness-tab-mobility-text": {
        id: "fitness-tab-mobility-text",
        type: "text",
        props: {
          content:
            "<p>Saturdays · 9:00 and 10:30. Guided stretching, joint mobility and breathing, great to complement your week.</p>",
        },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Franja de stats — banda alt --------------------------------------
      "fitness-stats": {
        id: "fitness-stats",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "48px 20px", margin: "0" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["fitness-stats-inner"],
      },
      "fitness-stats-inner": {
        id: "fitness-stats-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
        },
        children: ["fitness-stat-members", "fitness-stat-coaches", "fitness-stat-classes"],
      },
      ...statFragment("fitness-stat-members", { value: "+850", label: "active members" }, {
        base: {
          layout: { display: "block" },
          spacing: { padding: "20px" },
          typography: { fontFamily: { token: "typography.families.sans" }, textAlign: "center" },
          appearance: {
            color: { token: "colors.text" },
            background: { token: "colors.surface.default" },
            borderRadius: { token: "radii.md" },
            boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
          },
        },
        overrides: { md: { spacing: { padding: "28px" } } },
      }),
      ...statFragment("fitness-stat-coaches", { value: "12", label: "certified coaches" }, {
        base: {
          layout: { display: "block" },
          spacing: { padding: "20px" },
          typography: { fontFamily: { token: "typography.families.sans" }, textAlign: "center" },
          appearance: {
            color: { token: "colors.text" },
            background: { token: "colors.surface.default" },
            borderRadius: { token: "radii.md" },
            boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
          },
        },
        overrides: { md: { spacing: { padding: "28px" } } },
      }),
      ...statFragment("fitness-stat-classes", { value: "45", label: "classes per week" }, {
        base: {
          layout: { display: "block" },
          spacing: { padding: "20px" },
          typography: { fontFamily: { token: "typography.families.sans" }, textAlign: "center" },
          appearance: {
            color: { token: "colors.text" },
            background: { token: "colors.surface.default" },
            borderRadius: { token: "radii.md" },
            boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
          },
        },
        overrides: { md: { spacing: { padding: "28px" } } },
      }),

      // --- Planes (pricing-card) — banda con degradado de acento ---------------
      "fitness-plans": {
        id: "fitness-plans",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "48px 20px", margin: "0" },
            appearance: {
              background: "linear-gradient(135deg, var(--colors-primary-default), var(--colors-text))",
            },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["fitness-plans-inner"],
      },
      "fitness-plans-inner": {
        id: "fitness-plans-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "24px" },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
          overrides: { md: { layout: { gap: "40px" } } },
        },
        children: ["fitness-plans-title", "fitness-plans-grid"],
      },
      "fitness-plans-title": {
        id: "fitness-plans-title",
        type: "text",
        props: { content: "<strong>Choose your membership plan</strong>" },
        style: {
          base: {
            typography: { fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: { token: "typography.weights.bold" }, lineHeight: "1.15", textAlign: "center" },
            appearance: { color: { token: "colors.surface.default" } },
          },
        },
      },
      "fitness-plans-grid": {
        id: "fitness-plans-grid",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" }, justifyContent: "center" },
            size: { width: "100%", maxWidth: "none" },
            spacing: { padding: "0", margin: "0" },
            appearance: { background: "transparent" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" } } },
        },
        children: ["fitness-plan-monthly", "fitness-plan-quarterly", "fitness-plan-annual"],
      },
      ...pricingCardFragment(
        "fitness-plan-monthly",
        {
          planName: "Monthly",
          price: "$650",
          period: "MXN/month",
          features: ["Access to all classes", "Initial fitness assessment", "No commitment"],
          ctaLabel: "I want to sign up",
          ctaLink: { kind: "anchor", nodeId: "fitness-signup" },
          popular: false,
          popularLabel: "Popular",
        },
        {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "stretch" },
            spacing: { padding: "20px" },
            size: { minHeight: "64px", width: "100%", maxWidth: "none" },
            typography: { fontFamily: { token: "typography.families.sans" } },
            appearance: {
              background: { token: "colors.surface.default" },
              color: { token: "colors.text" },
              borderColor: { token: "colors.border" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderRadius: "18px",
              boxShadow: "0 12px 32px rgba(15,23,42,0.16)",
            },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
          states: {
            hover: {
              appearance: { boxShadow: "0 18px 44px rgba(15,23,42,0.24)", borderColor: { token: "colors.primary.default" } },
            },
          },
        },
      ),
      ...pricingCardFragment(
        "fitness-plan-quarterly",
        {
          planName: "Quarterly",
          price: "$1,750",
          period: "MXN/3 months",
          features: ["Access to all classes", "Monthly fitness assessment", "1 nutrition class included"],
          ctaLabel: "I want to sign up",
          ctaLink: { kind: "anchor", nodeId: "fitness-signup" },
          popular: true,
          popularLabel: "Most popular",
        },
        {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "stretch" },
            spacing: { padding: "24px" },
            size: { minHeight: "64px", width: "100%", maxWidth: "none" },
            typography: { fontFamily: { token: "typography.families.sans" } },
            appearance: {
              background: { token: "colors.surface.default" },
              color: { token: "colors.text" },
              borderColor: { token: "colors.primary.default" },
              borderWidth: "2px",
              borderStyle: "solid",
              borderRadius: "18px",
              boxShadow: "0 20px 48px rgba(15,23,42,0.32)",
            },
          },
          overrides: { md: { spacing: { padding: "32px" } } },
          states: {
            hover: {
              appearance: { boxShadow: "0 24px 56px rgba(15,23,42,0.4)" },
            },
          },
        },
      ),
      ...pricingCardFragment(
        "fitness-plan-annual",
        {
          planName: "Annual",
          price: "$6,200",
          period: "MXN/year",
          features: ["Access to all classes", "Monthly fitness assessment", "Up to 30 days freeze"],
          ctaLabel: "I want to sign up",
          ctaLink: { kind: "anchor", nodeId: "fitness-signup" },
          popular: false,
          popularLabel: "Popular",
        },
        {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "stretch" },
            spacing: { padding: "20px" },
            size: { minHeight: "64px", width: "100%", maxWidth: "none" },
            typography: { fontFamily: { token: "typography.families.sans" } },
            appearance: {
              background: { token: "colors.surface.default" },
              color: { token: "colors.text" },
              borderColor: { token: "colors.border" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderRadius: "18px",
              boxShadow: "0 12px 32px rgba(15,23,42,0.16)",
            },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
          states: {
            hover: {
              appearance: { boxShadow: "0 18px 44px rgba(15,23,42,0.24)", borderColor: { token: "colors.primary.default" } },
            },
          },
        },
      ),

      // --- Testimonio — banda clara -----------------------------------------
      "fitness-testimonial-section": {
        id: "fitness-testimonial-section",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "48px 20px", margin: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["fitness-testimonial-inner"],
      },
      "fitness-testimonial-inner": {
        id: "fitness-testimonial-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center" },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
        },
        children: ["fitness-testimonial"],
      },
      ...testimonialFragment(
        "fitness-testimonial",
        {
          quote:
            "I've been training at Vértice for eight months and it's the first time I've kept up a routine without losing motivation. The coaches really support you.",
          name: "Paola Jiménez",
          role: "Member since 2025",
          initials: "PJ",
        },
        defaultStyleFor("testimonial"),
      ),

      // --- FAQ (accordion) — banda alt -------------------------------------------
      "fitness-faq": {
        id: "fitness-faq",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "48px 20px", margin: "0" },
            appearance: { background: { token: "colors.surface.alt" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["fitness-faq-inner"],
      },
      "fitness-faq-inner": {
        id: "fitness-faq-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "24px" },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
          overrides: { md: { layout: { gap: "40px" } } },
        },
        children: ["fitness-faq-title", "fitness-accordion"],
      },
      "fitness-faq-title": {
        id: "fitness-faq-title",
        type: "text",
        props: { content: "<strong>Frequently asked questions</strong>" },
        style: {
          base: {
            typography: { fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: { token: "typography.weights.bold" }, lineHeight: "1.15" },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "fitness-accordion": {
        id: "fitness-accordion",
        type: "accordion",
        props: {},
        style: defaultStyleFor("accordion"),
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["fitness-faq-item-1", "fitness-faq-item-2", "fitness-faq-item-3"],
      },
      "fitness-faq-item-1": {
        id: "fitness-faq-item-1",
        type: "accordion-item",
        props: { label: "Can I freeze my membership?", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["fitness-faq-item-1-body"],
      },
      "fitness-faq-item-1-body": {
        id: "fitness-faq-item-1-body",
        type: "text",
        props: { content: "Yes, the quarterly and annual plans allow you to freeze your membership for up to 30 days a year, with one week's notice at the front desk." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "fitness-faq-item-2": {
        id: "fitness-faq-item-2",
        type: "accordion-item",
        props: { label: "Does the studio have showers and lockers?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["fitness-faq-item-2-body"],
      },
      "fitness-faq-item-2-body": {
        id: "fitness-faq-item-2-body",
        type: "text",
        props: { content: "Yes, we have changing rooms with showers and daily lockers at no extra cost; just bring your own lock." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },
      "fitness-faq-item-3": {
        id: "fitness-faq-item-3",
        type: "accordion-item",
        props: { label: "Can I try a class before signing up?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["fitness-faq-item-3-body"],
      },
      "fitness-faq-item-3-body": {
        id: "fitness-faq-item-3-body",
        type: "text",
        props: { content: "Of course, your first class is completely free. Just book your preferred time through the sign-up form." },
        style: { base: { size: { maxWidth: "70ch" }, appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Inscripción (form) — banda clara --------------------------------------
      "fitness-signup": {
        id: "fitness-signup",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
            size: { width: "100%" },
            spacing: { padding: "48px 20px", margin: "0" },
            appearance: { background: { token: "colors.surface.default" } },
          },
          overrides: { md: { spacing: { padding: "96px 20px" } } },
        },
        children: ["fitness-signup-inner"],
      },
      "fitness-signup-inner": {
        id: "fitness-signup-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: "24px" },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            spacing: { margin: "0 auto" },
          },
          overrides: { md: { layout: { gridTemplateColumns: "minmax(0, 320px) 1fr", gap: "40px" } } },
        },
        children: ["fitness-signup-info", "fitness-signup-card"],
      },
      "fitness-signup-info": {
        id: "fitness-signup-info",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } } },
        children: ["fitness-signup-title", "fitness-signup-sub"],
      },
      "fitness-signup-title": {
        id: "fitness-signup-title",
        type: "text",
        props: { content: "<strong>Book your free first class</strong>" },
        style: {
          base: {
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(1.5rem, 3vw, 2rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: "1.15",
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "fitness-signup-sub": {
        id: "fitness-signup-sub",
        type: "text",
        props: { content: "Leave us your details and an advisor will contact you to confirm your schedule." },
        style: {
          base: {
            typography: { fontSize: "clamp(1rem, 1.6vw, 1.125rem)" },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
      "fitness-signup-card": {
        id: "fitness-signup-card",
        type: "card",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "stretch" },
            spacing: { padding: "20px" },
            size: { minHeight: "64px", width: "100%" },
            appearance: {
              background: { token: "colors.surface.default" },
              borderColor: { token: "colors.border" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderRadius: "18px",
              boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
            },
          },
          overrides: { md: { spacing: { padding: "28px" } } },
        },
        children: ["fitness-form"],
      },
      "fitness-form": {
        id: "fitness-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: defaultStyleFor("form"),
        behaviors: [{ type: "form-validation", options: { validateOn: "blur" } }],
        children: ["fitness-field-name", "fitness-field-email", "fitness-field-phone", "fitness-submit"],
      },
      "fitness-field-name": {
        id: "fitness-field-name",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["fitness-label-name", "fitness-input-name"],
      },
      "fitness-label-name": {
        id: "fitness-label-name",
        type: "label",
        props: { text: "Full name", for: "fitness-input-name" },
        style: defaultStyleFor("label"),
      },
      "fitness-input-name": {
        id: "fitness-input-name",
        type: "input",
        props: { name: "nombre", type: "text", placeholder: "Your full name", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "fitness-field-email": {
        id: "fitness-field-email",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["fitness-label-email", "fitness-input-email"],
      },
      "fitness-label-email": {
        id: "fitness-label-email",
        type: "label",
        props: { text: "Email", for: "fitness-input-email" },
        style: defaultStyleFor("label"),
      },
      "fitness-input-email": {
        id: "fitness-input-email",
        type: "input",
        props: { name: "email", type: "email", placeholder: "you@email.com", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "fitness-field-phone": {
        id: "fitness-field-phone",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.xs" } } } },
        children: ["fitness-label-phone", "fitness-input-phone"],
      },
      "fitness-label-phone": {
        id: "fitness-label-phone",
        type: "label",
        props: { text: "Phone", for: "fitness-input-phone" },
        style: defaultStyleFor("label"),
      },
      "fitness-input-phone": {
        id: "fitness-input-phone",
        type: "input",
        props: { name: "telefono", type: "tel", placeholder: "5512345678", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "fitness-submit": {
        id: "fitness-submit",
        type: "button-submit",
        props: { label: "Book my free class", disabled: false },
        style: {
          base: {
            spacing: { padding: "14px 26px" },
            typography: { fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: { token: "radii.md" },
              boxShadow: "0 12px 32px rgba(15,23,42,0.2)",
            },
          },
          states: {
            hover: {
              appearance: { boxShadow: "0 16px 40px rgba(15,23,42,0.28)" },
            },
          },
        },
      },

      // --- Footer — banda oscura -------------------------------------------------
      "fitness-footer": {
        id: "fitness-footer",
        type: "footer",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
            spacing: { padding: "40px 20px" },
            size: { width: "100%" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
            appearance: {
              background: { token: "colors.text" },
              color: { token: "colors.surface.default" },
            },
          },
          overrides: { md: { spacing: { padding: "64px 40px" } } },
        },
        children: ["fitness-footer-address", "fitness-footer-social", "fitness-footer-copyright"],
      },
      "fitness-footer-address": {
        id: "fitness-footer-address",
        type: "text",
        props: { content: "245 Athletes Ave, Las Águilas, Guadalajara, Jalisco" },
        style: { base: { appearance: { color: { token: "colors.surface.default" } } } },
      },
      "fitness-footer-social": {
        id: "fitness-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
      "fitness-footer-copyright": {
        id: "fitness-footer-copyright",
        type: "text",
        props: { content: "© 2026 Vértice Fitness Studio. All rights reserved." },
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
  };

  const translations: Record<string, NodeTranslations> = {
    "fitness-topbar-schedule": { es: { content: "Lunes a viernes 6:00–22:00 · Sábados 8:00–14:00" }, it: { content: "Lunedì-venerdì 6:00–22:00 · Sabato 8:00–14:00" } },
    "fitness-navbar-brand": { es: { content: "<strong>Vértice Fitness Studio</strong>" }, it: { content: "<strong>Vértice Fitness Studio</strong>" } },
    "fitness-hero-title": { es: { content: "<strong>Entrena fuerte, entrena en comunidad</strong>" }, it: { content: "<strong>Allenati forte, allenati in comunità</strong>" } },
    "fitness-hero-sub": { es: { content: "Clases de fuerza, cardio y movilidad para todos los niveles, con entrenadores certificados y horarios flexibles." }, it: { content: "Corsi di forza, cardio e mobilità per tutti i livelli, con allenatori certificati e orari flessibili." } },
    "fitness-hero-cta": { es: { label: "Primera clase gratis" }, it: { label: "Prima lezione gratis" } },
    "fitness-schedule-title": { es: { content: "<strong>Horario semanal de clases</strong>" }, it: { content: "<strong>Orario settimanale delle lezioni</strong>" } },
    "fitness-schedule-sub": { es: { content: "Elige el tipo de entrenamiento que mejor se adapta a tu objetivo." }, it: { content: "Scegli il tipo di allenamento più adatto al tuo obiettivo." } },
    "fitness-timeline-step-1-number": { es: { content: "01" }, it: { content: "01" } },
    "fitness-timeline-step-2-number": { es: { content: "02" }, it: { content: "02" } },
    "fitness-timeline-step-3-number": { es: { content: "03" }, it: { content: "03" } },
    "fitness-tab-strength": { es: { content: "<strong>Fuerza</strong>" }, it: { content: "<strong>Forza</strong>" } },
    "fitness-tab-strength-text": { es: { content: "<p>Lunes, miércoles y viernes · 7:00, 13:00 y 19:00. Trabajo con barra, mancuernas y peso corporal, en grupos reducidos.</p>" }, it: { content: "<p>Lunedì, mercoledì e venerdì · 7:00, 13:00 e 19:00. Lavoro con bilanciere, manubri e corpo libero, in piccoli gruppi.</p>" } },
    "fitness-tab-cardio": { es: { content: "<strong>Cardio</strong>" }, it: { content: "<strong>Cardio</strong>" } },
    "fitness-tab-cardio-text": { es: { content: "<p>Martes y jueves · 6:30, 12:00 y 18:30. Sesiones de intervalos (HIIT) y resistencia cardiovascular de 45 minutos.</p>" }, it: { content: "<p>Martedì e giovedì · 6:30, 12:00 e 18:30. Sessioni HIIT e di resistenza cardiovascolare di 45 minuti.</p>" } },
    "fitness-tab-mobility": { es: { content: "<strong>Movilidad</strong>" }, it: { content: "<strong>Mobilità</strong>" } },
    "fitness-tab-mobility-text": { es: { content: "<p>Sábados · 9:00 y 10:30. Estiramiento guiado, movilidad articular y respiración, ideal para complementar tu semana.</p>" }, it: { content: "<p>Sabato · 9:00 e 10:30. Stretching guidato, mobilità articolare e respirazione, ideale per completare la settimana.</p>" } },
    "fitness-stat-members-value": { es: { value: "+850" }, it: { value: "+850" } },
    "fitness-stat-members-label": { es: { content: "socios activos" }, it: { content: "iscritti attivi" } },
    "fitness-stat-coaches-value": { es: { value: "12" }, it: { value: "12" } },
    "fitness-stat-coaches-label": { es: { content: "entrenadores certificados" }, it: { content: "allenatori certificati" } },
    "fitness-stat-classes-value": { es: { value: "45" }, it: { value: "45" } },
    "fitness-stat-classes-label": { es: { content: "clases por semana" }, it: { content: "lezioni a settimana" } },
    "fitness-plans-title": { es: { content: "<strong>Elige tu plan de membresía</strong>" }, it: { content: "<strong>Scegli il tuo piano di abbonamento</strong>" } },
    "fitness-plan-monthly-plan": { es: { content: "Mensual" }, it: { content: "Mensile" } },
    "fitness-plan-monthly-price": { es: { content: "$650" }, it: { content: "$650" } },
    "fitness-plan-monthly-period": { es: { content: "MXN/mes" }, it: { content: "MXN/mese" } },
    "fitness-plan-monthly-feature-0-text": { es: { content: "✓ Acceso a todas las clases" }, it: { content: "✓ Accesso a tutte le lezioni" } },
    "fitness-plan-monthly-feature-1-text": { es: { content: "✓ Evaluación física inicial" }, it: { content: "✓ Valutazione fisica iniziale" } },
    "fitness-plan-monthly-feature-2-text": { es: { content: "✓ Sin permanencia" }, it: { content: "✓ Nessun vincolo" } },
    "fitness-plan-monthly-cta": { es: { label: "Quiero inscribirme" }, it: { label: "Voglio iscrivermi" } },

    "fitness-plan-quarterly-badge": { es: { content: "Más elegido" }, it: { content: "Più scelto" } },
    "fitness-plan-quarterly-plan": { es: { content: "Trimestral" }, it: { content: "Trimestrale" } },
    "fitness-plan-quarterly-price": { es: { content: "$1,750" }, it: { content: "$1.750" } },
    "fitness-plan-quarterly-period": { es: { content: "MXN/3 meses" }, it: { content: "MXN/3 mesi" } },
    "fitness-plan-quarterly-feature-0-text": { es: { content: "✓ Acceso a todas las clases" }, it: { content: "✓ Accesso a tutte le lezioni" } },
    "fitness-plan-quarterly-feature-1-text": { es: { content: "✓ Evaluación física cada mes" }, it: { content: "✓ Valutazione fisica mensile" } },
    "fitness-plan-quarterly-feature-2-text": { es: { content: "✓ 1 clase de nutrición incluida" }, it: { content: "✓ 1 lezione di nutrizione inclusa" } },
    "fitness-plan-quarterly-cta": { es: { label: "Quiero inscribirme" }, it: { label: "Voglio iscrivermi" } },

    "fitness-plan-annual-plan": { es: { content: "Anual" }, it: { content: "Annuale" } },
    "fitness-plan-annual-price": { es: { content: "$6,200" }, it: { content: "$6.200" } },
    "fitness-plan-annual-period": { es: { content: "MXN/año" }, it: { content: "MXN/anno" } },
    "fitness-plan-annual-feature-0-text": { es: { content: "✓ Acceso a todas las clases" }, it: { content: "✓ Accesso a tutte le lezioni" } },
    "fitness-plan-annual-feature-1-text": { es: { content: "✓ Evaluación física mensual" }, it: { content: "✓ Valutazione fisica mensile" } },
    "fitness-plan-annual-feature-2-text": { es: { content: "✓ Congelamiento de hasta 30 días" }, it: { content: "✓ Congelamento fino a 30 giorni" } },
    "fitness-plan-annual-cta": { es: { label: "Quiero inscribirme" }, it: { label: "Voglio iscrivermi" } },
    "fitness-testimonial-quote": { es: { content: "<p>Llevo ocho meses entrenando en Vértice y es la primera vez que sostengo una rutina sin perder la motivación. Los entrenadores realmente te acompañan.</p>" }, it: { content: "<p>Mi alleno da Vértice da otto mesi ed è la prima volta che riesco a mantenere una routine senza perdere la motivazione. Gli allenatori ti seguono davvero.</p>" } },
    "fitness-testimonial-name": { es: { content: "<strong>Paola Jiménez</strong>" }, it: { content: "<strong>Paola Jiménez</strong>" } },
    "fitness-testimonial-role": { es: { content: "Socia desde 2025" }, it: { content: "Iscritta dal 2025" } },
    "fitness-faq-title": { es: { content: "<strong>Preguntas frecuentes</strong>" }, it: { content: "<strong>Domande frequenti</strong>" } },
    "fitness-faq-item-1": { es: { label: "¿Puedo congelar mi membresía?" }, it: { label: "Posso congelare il mio abbonamento?" } },
    "fitness-faq-item-1-body": { es: { content: "Sí, el plan trimestral y anual permiten congelar la membresía hasta por 30 días al año, avisando con una semana de anticipación en recepción." }, it: { content: "Sì, i piani trimestrale e annuale permettono di congelare l'abbonamento fino a 30 giorni all'anno, avvisando una settimana prima in reception." } },
    "fitness-faq-item-2": { es: { label: "¿El estudio tiene duchas y casilleros?" }, it: { label: "Lo studio ha docce e armadietti?" } },
    "fitness-faq-item-2-body": { es: { content: "Sí, contamos con vestidores con regaderas y casilleros diarios sin costo adicional; solo debes traer tu candado." }, it: { content: "Sì, disponiamo di spogliatoi con docce e armadietti giornalieri senza costo aggiuntivo; porta solo il tuo lucchetto." } },
    "fitness-faq-item-3": { es: { label: "¿Puedo probar una clase antes de inscribirme?" }, it: { label: "Posso provare una lezione prima di iscrivermi?" } },
    "fitness-faq-item-3-body": { es: { content: "Claro, tu primera clase es completamente gratis. Solo agenda tu horario preferido desde el formulario de inscripción." }, it: { content: "Certo, la tua prima lezione è completamente gratuita. Prenota l'orario che preferisci dal modulo di iscrizione." } },
    "fitness-signup-title": { es: { content: "<strong>Agenda tu primera clase gratis</strong>" }, it: { content: "<strong>Prenota la tua prima lezione gratuita</strong>" } },
    "fitness-signup-sub": { es: { content: "Déjanos tus datos y un asesor te contactará para confirmar tu horario." }, it: { content: "Lasciaci i tuoi dati e un consulente ti contatterà per confermare l'orario." } },
    "fitness-label-name": { es: { text: "Nombre completo" }, it: { text: "Nome completo" } },
    "fitness-input-name": { es: { placeholder: "Tu nombre completo" }, it: { placeholder: "Il tuo nome completo" } },
    "fitness-label-email": { es: { text: "Correo electrónico" }, it: { text: "Email" } },
    "fitness-input-email": { es: { placeholder: "tu@correo.com" }, it: { placeholder: "tu@email.com" } },
    "fitness-label-phone": { es: { text: "Teléfono" }, it: { text: "Telefono" } },
    "fitness-input-phone": { es: { placeholder: "5512345678" }, it: { placeholder: "5512345678" } },
    "fitness-submit": { es: { label: "Reservar mi clase gratis" }, it: { label: "Prenota la mia lezione gratuita" } },
    "fitness-footer-copyright": { es: { content: "© 2026 Vértice Fitness Studio. Todos los derechos reservados." }, it: { content: "© 2026 Vértice Fitness Studio. Tutti i diritti riservati." } },
    "fitness-footer-address": { es: { content: "Av. de los Deportistas 245, Col. Las Águilas, Guadalajara, Jalisco" }, it: { content: "Av. de los Deportistas 245, Las Águilas, Guadalajara, Jalisco" } },
  };

  fragment.translations = translations;
  return fragment;
}
