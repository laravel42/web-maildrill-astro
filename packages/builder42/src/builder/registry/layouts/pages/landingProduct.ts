import type { NodeFragment } from "../../../model/tree";
import type { BuilderNode, NodeStyle, NodeTranslations, StyleValue } from "../../../model/types";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";
import { NAVBAR_BRAND_STYLE } from "../../components/Navbar";
import { darkBandStyleFor, pricingCardFragment, statFragment, testimonialFragment, type LayoutPageMeta } from "../helpers";

/**
 * Página "Landing de producto" — REESCRITA (docs/48 §2 fila 8, F3) como
 * plantilla de sector: producto SaaS ("Fluxo", plataforma de automatización
 * de flujos de trabajo para equipos). Conserva su `id` ("landing-product") —
 * un sitio guardado que la referencie sigue funcionando — pero el contenido,
 * el arquetipo y el tema son enteramente nuevos.
 *
 * Arquetipo A6 (docs/48 §2) — Producto SaaS: `tabs` de features + `pricing-card`
 * a 3 columnas + `logo-cloud` + `stat` de impacto. El eje NO es una galería ni
 * un carousel (como A9/A9b): es la combinación tabs→pricing→logos→stats propia
 * de una landing de producto B2B.
 *
 * Tema "Signal" (índigo/cian, docs/48 §2): tipografía Plus Jakarta Sans.
 * **Decisión de `colorScheme` (par claro-oscuro, documentada per el plan):**
 * el tema declarativo (`LayoutTheme`, aplicado por `applyPageLayout`) es
 * SIEMPRE una única variante consistente — no puede describir "las dos"
 * porque es un único set de tokens (`colorScheme?: "light" | "dark"`, no un
 * par). Se elige **`light`** como la variante que registra el tema: es la
 * que usan las otras 8 plantillas de sector y no obliga al usuario a partir
 * de un canvas oscuro por defecto. La personalidad "claro-oscuro" del sector
 * SaaS se demuestra igualmente en la propia página con el behavior
 * `theme-toggle` (ver navbar) — el visitante puede cambiar a un preset de
 * `THEME_PRESETS` que sí sea oscuro (p. ej. "Midnight") sin que la plantilla
 * dependa de dos temas declarativos simultáneos, algo que el modelo de
 * `LayoutTheme` no soporta hoy (fuera de alcance de F3 extenderlo).
 *
 * Showcase funcional: `tabs` de features, `theme-toggle` en el navbar (el
 * catálogo NO tiene una acción/behavior "theme-toggle" de acción de click —
 * verificado en `actionRegistry`/`behaviorRegistry`, docs/48; existe como
 * BEHAVIOR de nodo, `registry/behaviors/themeToggle.ts`, que se adjunta al
 * propio botón del navbar), `pricing-card` a 3 planes, `logo-cloud`, `stat`
 * con `count-up`.
 *
 * Anatomía: navbar con theme-toggle · hero con CTA · features en `tabs` ·
 * franja de logos de clientes (`logo-cloud`) · stats de impacto (`count-up`)
 * · pricing 3 planes · testimonios · FAQ (`accordion`) · footer oscuro.
 *
 * Todos los ids con prefijo `saas-` (sin colisión con otras plantillas).
 */

const SHADOW_CARD = "0 12px 32px rgba(15,23,42,0.10)";
const SHADOW_HOVER = "0 20px 44px rgba(15,23,42,0.18)";
const BAND_PADDING = "56px 20px";
const INNER_MAX = "1180px";
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

function sectionTitle(color: StyleValue = { token: "colors.text" }, align: "left" | "center" = "left"): NodeStyle {
  return {
    base: {
      size: { maxWidth: "26ch" },
      typography: {
        fontFamily: { token: "typography.families.sans" },
        fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
        fontWeight: { token: "typography.weights.bold" },
        lineHeight: "1.12",
        textAlign: align,
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

function statCard(n: 1 | 2 | 3 | 4, value: string, label: string) {
  const nodes = statFragment(`saas-stat-${n}`, { value, label }, {
    base: {
      ...defaultStyleFor("stat").base,
      appearance: { color: { token: "colors.band.on" } },
    },
  });
  nodes[`saas-stat-${n}`]!.behaviors = [{ type: "count-up", options: { duration: 1500, threshold: 0.3, once: true } }];
  return nodes;
}

function pricingPlan(
  n: 1 | 2 | 3,
  planName: string,
  price: string,
  period: string,
  features: string,
  popular: boolean,
) {
  const rootStyle = {
    ...defaultStyleFor("pricing-card"),
    base: {
      ...defaultStyleFor("pricing-card").base,
      size: { minHeight: "64px", maxWidth: "360px", width: "100%" },
      appearance: {
        ...defaultStyleFor("pricing-card").base.appearance,
        borderColor: popular ? { token: "colors.primary.default" } : { token: "colors.border" },
        borderWidth: popular ? "2px" : "1px",
        boxShadow: popular ? SHADOW_HOVER : SHADOW_CARD,
      },
    },
    states: { hover: { appearance: { boxShadow: SHADOW_HOVER } } },
  };
  return pricingCardFragment(
    `saas-pricing-plan-${n}`,
    {
      planName,
      price,
      period,
      features: features.split("\n").map((f) => f.trim()).filter((f) => f !== ""),
      ctaLabel: popular ? "Start free trial" : "Choose plan",
      ctaLink: { kind: "anchor", nodeId: "saas-faq" },
      popular,
      popularLabel: "Most popular",
    },
    rootStyle,
  );
}

function logoPlaceholder(n: 1 | 2 | 3 | 4 | 5, label: string) {
  return {
    [`saas-logo-${n}`]: {
      id: `saas-logo-${n}`,
      type: "text",
      props: { content: `<strong>${label}</strong>` },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: "1.375rem",
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: { color: { token: "colors.muted" } },
        },
      },
    },
  };
}

export function buildLandingProductFragment(): NodeFragment {
  return {
    rootId: "saas-root",
    nodes: {
      "saas-root": {
        id: "saas-root",
        type: "container",
        props: {},
        style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "stretch" } } },
        children: [
          "saas-navbar",
          "saas-hero",
          "saas-logos",
          "saas-features",
          "saas-stats",
          "saas-pricing",
          "saas-testimonials",
          "saas-faq",
          "saas-footer",
        ],
      },

      // --- Navbar con theme-toggle (showcase funcional) ---------------------
      "saas-navbar": {
        id: "saas-navbar",
        type: "navbar",
        props: { brand: "Fluxo", hiddenPageIds: [] },
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
        children: ["saas-navbar-brand"],
      },
      "saas-navbar-brand": {
        id: "saas-navbar-brand",
        type: "container",
        props: {},
        style: NAVBAR_BRAND_STYLE,
        children: ["saas-navbar-lang", "saas-navbar-cta"],
      },
      "saas-navbar-lang": {
        id: "saas-navbar-lang",
        type: "language-nav",
        props: { triggerMode: "text", displayMode: "codes", showCurrent: true, ariaLabel: "Idioma" },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "saas-navbar-cta": {
        id: "saas-navbar-cta",
        type: "button",
        props: { label: "Try for free", link: { kind: "anchor", nodeId: "saas-pricing" }, newTab: false },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "14px 22px" },
            typography: { fontWeight: { token: "typography.weights.bold" }, textAlign: "center", textDecoration: "none" },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: "8px",
              cursor: "pointer",
            },
          },
          states: { hover: { appearance: { background: { token: "colors.text" } } } },
        },
        // Behavior de NODO (no acción de click): el catálogo no tiene una
        // acción `theme-toggle` en `actionRegistry` — es un behavior que se
        // adjunta al propio botón (`registry/behaviors/themeToggle.ts`,
        // verificado antes de escribir esta plantilla). Sin temas alternos
        // configurados en el sitio, degrada a un botón normal (docs/48 §5.4).
        behaviors: [{ type: "theme-toggle", options: {} }],
      },

      // --- Hero con CTA -------------------------------------------------------
      "saas-hero": {
        id: "saas-hero",
        type: "hero",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" },
            spacing: { padding: "64px 20px" },
            appearance: {
              background: "linear-gradient(160deg, var(--colors-surface-alt) 0%, var(--colors-surface-default) 60%)",
            },
          },
          overrides: { md: { spacing: { padding: "128px 20px" } } },
        },
        children: ["saas-hero-inner"],
      },
      "saas-hero-inner": {
        id: "saas-hero-inner",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" }, alignItems: "center" },
            spacing: { margin: "0 auto" },
            size: { width: "100%", maxWidth: "780px" },
          },
          overrides: { lg: { size: { maxWidth: "860px" } } },
        },
        children: ["saas-hero-badge", "saas-hero-title", "saas-hero-sub", "saas-hero-ctas"],
      },
      "saas-hero-badge": {
        id: "saas-hero-badge",
        type: "badge",
        props: { label: "New: AI-powered automations" },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "6px 14px" },
            typography: { fontSize: { token: "typography.sizes.sm" }, fontWeight: { token: "typography.weights.bold" } },
            appearance: {
              background: { token: "colors.surface.default" },
              color: { token: "colors.primary.default" },
              borderRadius: "999px",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.border" },
            },
          },
        },
      },
      "saas-hero-title": {
        id: "saas-hero-title",
        type: "text",
        props: { content: "<strong>Automate the workflows that steal your team's time</strong>" },
        style: {
          base: {
            size: { maxWidth: "22ch" },
            typography: {
              fontFamily: { token: "typography.families.sans" },
              fontSize: "clamp(2.25rem, 6vw, 4rem)",
              lineHeight: "1.05",
              fontWeight: { token: "typography.weights.bold" },
              textAlign: "center",
            },
            appearance: { color: { token: "colors.text" } },
          },
        },
      },
      "saas-hero-sub": {
        id: "saas-hero-sub",
        type: "text",
        props: { content: "Fluxo connects your tools and runs the repetitive tasks for you, without writing a single line of code." },
        style: {
          base: {
            size: { maxWidth: "48ch" },
            typography: { fontFamily: { token: "typography.families.sans" }, fontSize: "clamp(1rem, 1.6vw, 1.125rem)", textAlign: "center" },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
      "saas-hero-ctas": {
        id: "saas-hero-ctas",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" }, alignItems: "center" } },
          overrides: { sm: { layout: { flexDirection: "row" } } },
        },
        children: ["saas-hero-cta-primary", "saas-hero-cta-secondary"],
      },
      "saas-hero-cta-primary": {
        id: "saas-hero-cta-primary",
        type: "button",
        props: { label: "Start free trial", link: { kind: "anchor", nodeId: "saas-pricing" }, newTab: false },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "14px 22px" },
            typography: { fontWeight: { token: "typography.weights.bold" }, textAlign: "center", textDecoration: "none" },
            appearance: {
              background: { token: "colors.primary.default" },
              color: { token: "colors.primary.on" },
              borderRadius: "8px",
              cursor: "pointer",
              boxShadow: "0 12px 24px rgba(79,70,229,0.28)",
            },
          },
          states: { hover: { appearance: { background: { token: "colors.text" } } } },
        },
      },
      "saas-hero-cta-secondary": {
        id: "saas-hero-cta-secondary",
        type: "button",
        props: { label: "Watch live demo", link: { kind: "anchor", nodeId: "saas-features" }, newTab: false },
        style: {
          base: {
            layout: { display: "inline-block" },
            spacing: { padding: "14px 22px" },
            typography: { fontWeight: { token: "typography.weights.bold" }, textAlign: "center", textDecoration: "none" },
            appearance: {
              background: "transparent",
              color: { token: "colors.text" },
              borderRadius: "8px",
              borderWidth: "1px",
              borderStyle: "solid",
              borderColor: { token: "colors.border" },
              cursor: "pointer",
            },
          },
          states: { hover: { appearance: { background: { token: "colors.surface.alt" } } } },
        },
      },

      // --- Franja de logos de clientes (logo-cloud) --------------------------
      "saas-logos": {
        id: "saas-logos",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }, "32px 20px", "56px 20px"),
        children: ["saas-logos-inner"],
      },
      "saas-logos-inner": {
        id: "saas-logos-inner",
        type: "container",
        props: {},
        style: { ...inner(INNER_MAX, "16px", "24px"), overrides: { md: { spacing: { padding: "0" } } } },
        children: ["saas-logos-label", "saas-logo-cloud"],
      },
      "saas-logos-label": {
        id: "saas-logos-label",
        type: "text",
        props: { content: "Trusted by teams in more than 40 countries" },
        style: {
          base: {
            typography: { fontSize: { token: "typography.sizes.sm" }, fontWeight: { token: "typography.weights.bold" }, textAlign: "center" },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
      "saas-logo-cloud": {
        id: "saas-logo-cloud",
        type: "logo-cloud",
        props: {},
        style: {
          ...defaultStyleFor("logo-cloud"),
          base: {
            ...defaultStyleFor("logo-cloud").base,
            layout: { ...defaultStyleFor("logo-cloud").base.layout, gap: "20px" },
          },
          overrides: { md: { layout: { gap: "40px" } } },
        },
        children: ["saas-logo-1", "saas-logo-2", "saas-logo-3", "saas-logo-4", "saas-logo-5"],
      },
      ...logoPlaceholder(1, "Nimbus"),
      ...logoPlaceholder(2, "Orbita"),
      ...logoPlaceholder(3, "Kairos"),
      ...logoPlaceholder(4, "Ventura"),
      ...logoPlaceholder(5, "Aleph"),

      // --- Features en pestañas (eje del arquetipo A6) ------------------------
      "saas-features": {
        id: "saas-features",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["saas-features-inner"],
      },
      "saas-features-inner": {
        id: "saas-features-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["saas-features-title", "saas-features-sub", "saas-tabs"],
      },
      "saas-features-title": {
        id: "saas-features-title",
        type: "text",
        props: { content: "<strong>Everything your team needs, in one place</strong>" },
        style: sectionTitle(),
      },
      "saas-features-sub": {
        id: "saas-features-sub",
        type: "text",
        props: { content: "From automating repetitive tasks to connecting your favorite tools." },
        style: bodyText(),
      },
      "saas-tabs": {
        id: "saas-tabs",
        type: "tabs",
        props: {},
        style: { ...defaultStyleFor("tabs"), overrides: { md: { spacing: { padding: "0" } } } },
        behaviors: [{ type: "tabs", options: { duration: 220 } }],
        children: ["saas-tab-automation", "saas-tab-integrations", "saas-tab-analytics"],
      },
      "saas-tab-automation": {
        id: "saas-tab-automation",
        type: "tab",
        props: { label: "Automation" },
        style: defaultStyleFor("tab"),
        children: ["saas-tab-automation-body"],
      },
      "saas-tab-automation-body": {
        id: "saas-tab-automation-body",
        type: "text",
        props: {
          content:
            "Design flows by dragging and dropping: when X happens, do Y. No code, with conditional logic and automatic retries if something fails.",
        },
        style: bodyText(),
      },
      "saas-tab-integrations": {
        id: "saas-tab-integrations",
        type: "tab",
        props: { label: "Integrations" },
        style: defaultStyleFor("tab"),
        children: ["saas-tab-integrations-body"],
      },
      "saas-tab-integrations-body": {
        id: "saas-tab-integrations-body",
        type: "text",
        props: {
          content: "Connect more than 120 tools (Slack, Notion, Google Sheets, your CRM) without writing integrations by hand.",
        },
        style: bodyText(),
      },
      "saas-tab-analytics": {
        id: "saas-tab-analytics",
        type: "tab",
        props: { label: "Analytics" },
        style: defaultStyleFor("tab"),
        children: ["saas-tab-analytics-body"],
      },
      "saas-tab-analytics-body": {
        id: "saas-tab-analytics-body",
        type: "text",
        props: {
          content: "See how much time each flow saves and spot bottlenecks with automatic weekly reports.",
        },
        style: bodyText(),
      },

      // --- Stats de impacto (count-up) -----------------------------------------
      "saas-stats": {
        id: "saas-stats",
        type: "section",
        props: {},
        style: band({ token: "colors.band.dark" }),
        behaviors: REVEAL,
        children: ["saas-stats-inner"],
      },
      "saas-stats-inner": {
        id: "saas-stats-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["saas-stats-title", "saas-stats-grid"],
      },
      "saas-stats-title": {
        id: "saas-stats-title",
        type: "text",
        props: { content: "<strong>Real impact, in numbers</strong>" },
        style: sectionTitle({ token: "colors.band.on" }, "center"),
      },
      "saas-stats-grid": {
        id: "saas-stats-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "16px" } },
          overrides: {
            sm: { layout: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } },
            md: { layout: { gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "32px" } },
          },
        },
        children: ["saas-stat-1", "saas-stat-2", "saas-stat-3", "saas-stat-4"],
      },
      ...statCard(1, "12,400+", "Active teams"),
      ...statCard(2, "3.2M", "Tasks automated per month"),
      ...statCard(3, "18h", "Saved per team/week"),
      ...statCard(4, "99.95%", "Guaranteed uptime"),

      // --- Pricing 3 columnas ---------------------------------------------------
      "saas-pricing": {
        id: "saas-pricing",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        behaviors: REVEAL,
        children: ["saas-pricing-inner"],
      },
      "saas-pricing-inner": {
        id: "saas-pricing-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["saas-pricing-title", "saas-pricing-sub", "saas-pricing-grid"],
      },
      "saas-pricing-title": {
        id: "saas-pricing-title",
        type: "text",
        props: { content: "<strong>A plan for every team size</strong>" },
        style: { ...sectionTitle(), base: { ...sectionTitle().base, typography: { ...sectionTitle().base.typography, textAlign: "center" } } },
      },
      "saas-pricing-sub": {
        id: "saas-pricing-sub",
        type: "text",
        props: { content: "Cancel anytime. All plans include a 14-day free trial." },
        style: { ...bodyText(), base: { ...bodyText().base, typography: { ...bodyText().base.typography, textAlign: "center" } } },
      },
      "saas-pricing-grid": {
        id: "saas-pricing-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", gap: "16px", alignItems: "center" } },
          overrides: { md: { layout: { flexDirection: "row", justifyContent: "center", alignItems: "stretch", gap: "24px" } } },
        },
        children: ["saas-pricing-plan-1", "saas-pricing-plan-2", "saas-pricing-plan-3"],
      },
      ...pricingPlan(1, "Starter", "$0", "/mo", "Up to 3 active flows\n1 user\n5 integrations\nCommunity support", false),
      ...pricingPlan(
        2,
        "Team",
        "$39",
        "/mo",
        "Unlimited flows\nUp to 10 users\nAll integrations\nPriority support\n90-day history",
        true,
      ),
      ...pricingPlan(3, "Enterprise", "$129", "/mo", "Unlimited users\nSSO and access control\nDedicated SLA\nAssisted onboarding", false),

      // --- Testimonios ---------------------------------------------------------
      "saas-testimonials": {
        id: "saas-testimonials",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.alt" }),
        behaviors: REVEAL,
        children: ["saas-testimonials-inner"],
      },
      "saas-testimonials-inner": {
        id: "saas-testimonials-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["saas-testimonials-title", "saas-testimonials-grid"],
      },
      "saas-testimonials-title": {
        id: "saas-testimonials-title",
        type: "text",
        props: { content: "<strong>Teams already moving faster with Fluxo</strong>" },
        style: sectionTitle(),
      },
      "saas-testimonials-grid": {
        id: "saas-testimonials-grid",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "grid", gridTemplateColumns: "1fr", gap: "16px" } },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "28px" } } },
        },
        children: ["saas-testimonial-1", "saas-testimonial-2"],
      },
      ...testimonialFragment(
        "saas-testimonial-1",
        {
          quote: "We cut our customer onboarding process from 6 hours to 40 minutes. Fluxo pays for itself with the time the team saves.",
          name: "Lucía Ferrer",
          role: "COO, Nimbus",
          initials: "LF",
        },
        { base: { ...card().base, spacing: { padding: "20px" } }, overrides: { md: { spacing: { padding: "28px" } } } },
      ),
      ...testimonialFragment(
        "saas-testimonial-2",
        {
          quote: "The learning curve is minimal. Within a week we already had 8 flows running without relying on engineering.",
          name: "Andrés Molina",
          role: "Head of Ops, Kairos",
          initials: "AM",
        },
        { base: { ...card().base, spacing: { padding: "20px" } }, overrides: { md: { spacing: { padding: "28px" } } } },
      ),

      // --- FAQ -------------------------------------------------------------------
      "saas-faq": {
        id: "saas-faq",
        type: "section",
        props: {},
        style: band({ token: "colors.surface.default" }),
        children: ["saas-faq-inner"],
      },
      "saas-faq-inner": {
        id: "saas-faq-inner",
        type: "container",
        props: {},
        style: inner(),
        children: ["saas-faq-title", "saas-faq-list"],
      },
      "saas-faq-title": {
        id: "saas-faq-title",
        type: "text",
        props: { content: "<strong>Frequently asked questions</strong>" },
        style: sectionTitle(),
      },
      "saas-faq-list": {
        id: "saas-faq-list",
        type: "accordion",
        props: {},
        style: { ...defaultStyleFor("accordion"), overrides: { md: { spacing: { padding: "0" } } } },
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["saas-faq-item-1", "saas-faq-item-2", "saas-faq-item-3", "saas-faq-item-4"],
      },
      "saas-faq-item-1": {
        id: "saas-faq-item-1",
        type: "accordion-item",
        props: { label: "Do I need to know how to code to use Fluxo?", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["saas-faq-item-1-body"],
      },
      "saas-faq-item-1-body": {
        id: "saas-faq-item-1-body",
        type: "text",
        props: { content: "No. Flows are designed by dragging visual blocks; code is optional for advanced cases." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "saas-faq-item-2": {
        id: "saas-faq-item-2",
        type: "accordion-item",
        props: { label: "Can I change plans at any time?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["saas-faq-item-2-body"],
      },
      "saas-faq-item-2-body": {
        id: "saas-faq-item-2-body",
        type: "text",
        props: { content: "Yes, you can upgrade or downgrade whenever you want; billing is prorated automatically." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "saas-faq-item-3": {
        id: "saas-faq-item-3",
        type: "accordion-item",
        props: { label: "What happens if I exceed my plan's flow limit?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["saas-faq-item-3-body"],
      },
      "saas-faq-item-3-body": {
        id: "saas-faq-item-3-body",
        type: "text",
        props: { content: "We notify you before you hit the limit and you can upgrade your plan without losing any active automation." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "saas-faq-item-4": {
        id: "saas-faq-item-4",
        type: "accordion-item",
        props: { label: "Do you offer support to migrate from another tool?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["saas-faq-item-4-body"],
      },
      "saas-faq-item-4-body": {
        id: "saas-faq-item-4-body",
        type: "text",
        props: { content: "Yes, the Team and Enterprise plans include assisted onboarding to migrate your existing flows." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },

      // --- Footer oscuro -----------------------------------------------------
      "saas-footer": {
        id: "saas-footer",
        type: "footer",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: "32px 20px" },
            appearance: { background: { token: "colors.band.dark" }, color: { token: "colors.band.on" } },
          },
          overrides: { md: { spacing: { padding: "56px 20px" } } },
        },
        children: ["saas-footer-social", "saas-footer-copyright"],
      },
      "saas-footer-social": {
        id: "saas-footer-social",
        type: "social-links",
        props: {},
        style: darkBandStyleFor("social-links"),
      },
      "saas-footer-copyright": {
        id: "saas-footer-copyright",
        type: "text",
        props: { content: "© 2026 Fluxo Technologies Inc. All rights reserved." },
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

      t["saas-navbar-cta"] = { es: { label: "Probar gratis" }, it: { label: "Prova gratis" } };

      t["saas-hero-badge"] = { es: { label: "Nuevo: automatizaciones con IA" }, it: { label: "Novità: automazioni con IA" } };
      t["saas-hero-title"] = { es: { content: "<strong>Automatiza los flujos de trabajo que le roban tiempo a tu equipo</strong>" }, it: { content: "<strong>Automatizza i flussi di lavoro che rubano tempo al tuo team</strong>" } };
      t["saas-hero-sub"] = { es: { content: "Fluxo conecta tus herramientas y ejecuta las tareas repetitivas por ti, sin escribir una línea de código." }, it: { content: "Fluxo collega i tuoi strumenti ed esegue le attività ripetitive per te, senza scrivere una riga di codice." } };
      t["saas-hero-cta-primary"] = { es: { label: "Empezar prueba gratis" }, it: { label: "Inizia la prova gratuita" } };
      t["saas-hero-cta-secondary"] = { es: { label: "Ver demo en vivo" }, it: { label: "Guarda la demo live" } };

      t["saas-logos-label"] = { es: { content: "Con la confianza de equipos en más de 40 países" }, it: { content: "Scelto da team in oltre 40 paesi" } };

      t["saas-features-title"] = { es: { content: "<strong>Todo lo que tu equipo necesita, en un solo lugar</strong>" }, it: { content: "<strong>Tutto ciò che serve al tuo team, in un solo posto</strong>" } };
      t["saas-features-sub"] = { es: { content: "Desde automatizar tareas repetitivas hasta conectar tus herramientas favoritas." }, it: { content: "Dall'automazione di attività ripetitive alla connessione dei tuoi strumenti preferiti." } };
      t["saas-tab-automation"] = { es: { label: "Automatización" }, it: { label: "Automazione" } };
      t["saas-tab-automation-body"] = { es: { content: "Diseña flujos con arrastrar y soltar: cuando pase X, haz Y. Sin código, con lógica condicional y reintentos automáticos si algo falla." }, it: { content: "Progetta flussi trascinando blocchi: quando succede X, fai Y. Senza codice, con logica condizionale e ritentativi automatici in caso di errore." } };
      t["saas-tab-integrations"] = { es: { label: "Integraciones" }, it: { label: "Integrazioni" } };
      t["saas-tab-integrations-body"] = { es: { content: "Conecta más de 120 herramientas (Slack, Notion, Google Sheets, tu CRM) sin escribir integraciones a mano." }, it: { content: "Collega più di 120 strumenti (Slack, Notion, Google Sheets, il tuo CRM) senza scrivere integrazioni a mano." } };
      t["saas-tab-analytics"] = { es: { label: "Analítica" }, it: { label: "Analisi" } };
      t["saas-tab-analytics-body"] = { es: { content: "Ve cuánto tiempo ahorra cada flujo y detecta cuellos de botella con reportes automáticos semanales." }, it: { content: "Scopri quanto tempo fa risparmiare ogni flusso e individua i colli di bottiglia con report settimanali automatici." } };

      t["saas-logo-1"] = { es: { content: "<strong>Nimbus</strong>" }, it: { content: "<strong>Nimbus</strong>" } };
      t["saas-logo-2"] = { es: { content: "<strong>Orbita</strong>" }, it: { content: "<strong>Orbita</strong>" } };
      t["saas-logo-3"] = { es: { content: "<strong>Kairos</strong>" }, it: { content: "<strong>Kairos</strong>" } };
      t["saas-logo-4"] = { es: { content: "<strong>Ventura</strong>" }, it: { content: "<strong>Ventura</strong>" } };
      t["saas-logo-5"] = { es: { content: "<strong>Aleph</strong>" }, it: { content: "<strong>Aleph</strong>" } };

      t["saas-stats-title"] = { es: { content: "<strong>El impacto real, en números</strong>" }, it: { content: "<strong>L'impatto reale, in numeri</strong>" } };
      t["saas-stat-1-value"] = { es: { value: "12.400+" }, it: { value: "12.400+" } };
      t["saas-stat-1-label"] = { es: { content: "Equipos activos" }, it: { content: "Team attivi" } };
      t["saas-stat-2-value"] = { es: { value: "3.2M" }, it: { value: "3,2M" } };
      t["saas-stat-2-label"] = { es: { content: "Tareas automatizadas al mes" }, it: { content: "Attività automatizzate al mese" } };
      t["saas-stat-3-value"] = { es: { value: "18h" }, it: { value: "18h" } };
      t["saas-stat-3-label"] = { es: { content: "Ahorradas por equipo/semana" }, it: { content: "Risparmiate per team/settimana" } };
      t["saas-stat-4-value"] = { es: { value: "99.95%" }, it: { value: "99,95%" } };
      t["saas-stat-4-label"] = { es: { content: "Uptime garantizado" }, it: { content: "Uptime garantito" } };

      t["saas-pricing-title"] = { es: { content: "<strong>Un plan para cada tamaño de equipo</strong>" }, it: { content: "<strong>Un piano per ogni dimensione di team</strong>" } };
      t["saas-pricing-sub"] = { es: { content: "Cancela cuando quieras. Todos los planes incluyen 14 días de prueba gratis." }, it: { content: "Annulla in qualsiasi momento. Tutti i piani includono 14 giorni di prova gratuita." } };

      t["saas-pricing-plan-1-badge"] = { es: { content: "Más popular" }, it: { content: "Più popolare" } };
      t["saas-pricing-plan-1-plan"] = { es: { content: "Starter" }, it: { content: "Starter" } };
      t["saas-pricing-plan-1-price"] = { es: { content: "$0" }, it: { content: "$0" } };
      t["saas-pricing-plan-1-period"] = { es: { content: "/mes" }, it: { content: "/mese" } };
      t["saas-pricing-plan-1-feature-0-text"] = { es: { content: "✓ Hasta 3 flujos activos" }, it: { content: "✓ Fino a 3 flussi attivi" } };
      t["saas-pricing-plan-1-feature-1-text"] = { es: { content: "✓ 1 usuario" }, it: { content: "✓ 1 utente" } };
      t["saas-pricing-plan-1-feature-2-text"] = { es: { content: "✓ 5 integraciones" }, it: { content: "✓ 5 integrazioni" } };
      t["saas-pricing-plan-1-feature-3-text"] = { es: { content: "✓ Soporte por comunidad" }, it: { content: "✓ Supporto community" } };
      t["saas-pricing-plan-1-cta"] = { es: { label: "Elegir plan" }, it: { label: "Scegli piano" } };

      t["saas-pricing-plan-2-badge"] = { es: { content: "Más popular" }, it: { content: "Più popolare" } };
      t["saas-pricing-plan-2-plan"] = { es: { content: "Team" }, it: { content: "Team" } };
      t["saas-pricing-plan-2-price"] = { es: { content: "$39" }, it: { content: "$39" } };
      t["saas-pricing-plan-2-period"] = { es: { content: "/mes" }, it: { content: "/mese" } };
      t["saas-pricing-plan-2-feature-0-text"] = { es: { content: "✓ Flujos ilimitados" }, it: { content: "✓ Flussi illimitati" } };
      t["saas-pricing-plan-2-feature-1-text"] = { es: { content: "✓ Hasta 10 usuarios" }, it: { content: "✓ Fino a 10 utenti" } };
      t["saas-pricing-plan-2-feature-2-text"] = { es: { content: "✓ Todas las integraciones" }, it: { content: "✓ Tutte le integrazioni" } };
      t["saas-pricing-plan-2-feature-3-text"] = { es: { content: "✓ Soporte prioritario" }, it: { content: "✓ Supporto prioritario" } };
      t["saas-pricing-plan-2-feature-4-text"] = { es: { content: "✓ Historial de 90 días" }, it: { content: "✓ Cronologia di 90 giorni" } };
      t["saas-pricing-plan-2-cta"] = { es: { label: "Empezar prueba gratis" }, it: { label: "Inizia la prova gratuita" } };

      t["saas-pricing-plan-3-badge"] = { es: { content: "Más popular" }, it: { content: "Più popolare" } };
      t["saas-pricing-plan-3-plan"] = { es: { content: "Enterprise" }, it: { content: "Enterprise" } };
      t["saas-pricing-plan-3-price"] = { es: { content: "$129" }, it: { content: "$129" } };
      t["saas-pricing-plan-3-period"] = { es: { content: "/mes" }, it: { content: "/mese" } };
      t["saas-pricing-plan-3-feature-0-text"] = { es: { content: "✓ Usuarios ilimitados" }, it: { content: "✓ Utenti illimitati" } };
      t["saas-pricing-plan-3-feature-1-text"] = { es: { content: "✓ SSO y control de acceso" }, it: { content: "✓ SSO e controllo accessi" } };
      t["saas-pricing-plan-3-feature-2-text"] = { es: { content: "✓ SLA dedicado" }, it: { content: "✓ SLA dedicato" } };
      t["saas-pricing-plan-3-feature-3-text"] = { es: { content: "✓ Onboarding asistido" }, it: { content: "✓ Onboarding assistito" } };
      t["saas-pricing-plan-3-cta"] = { es: { label: "Elegir plan" }, it: { label: "Scegli piano" } };

      t["saas-testimonials-title"] = { es: { content: "<strong>Equipos que ya trabajan más rápido con Fluxo</strong>" }, it: { content: "<strong>Team che lavorano già più velocemente con Fluxo</strong>" } };
      t["saas-testimonial-1-quote"] = { es: { content: "<p>Redujimos de 6 horas a 40 minutos el proceso de onboarding de clientes. Fluxo se paga solo con el tiempo que ahorra el equipo.</p>" }, it: { content: "<p>Abbiamo ridotto il processo di onboarding clienti da 6 ore a 40 minuti. Fluxo si ripaga da solo con il tempo che fa risparmiare al team.</p>" } };
      t["saas-testimonial-1-name"] = { es: { content: "<strong>Lucía Ferrer</strong>" }, it: { content: "<strong>Lucía Ferrer</strong>" } };
      t["saas-testimonial-1-role"] = { es: { content: "COO, Nimbus" }, it: { content: "COO, Nimbus" } };
      t["saas-testimonial-2-quote"] = { es: { content: "<p>La curva de aprendizaje es mínima. En una semana ya teníamos 8 flujos corriendo sin depender de ingeniería.</p>" }, it: { content: "<p>La curva di apprendimento è minima. In una settimana avevamo già 8 flussi attivi senza dipendere dall'ingegneria.</p>" } };
      t["saas-testimonial-2-name"] = { es: { content: "<strong>Andrés Molina</strong>" }, it: { content: "<strong>Andrés Molina</strong>" } };
      t["saas-testimonial-2-role"] = { es: { content: "Head of Ops, Kairos" }, it: { content: "Head of Ops, Kairos" } };

      t["saas-faq-title"] = { es: { content: "<strong>Preguntas frecuentes</strong>" }, it: { content: "<strong>Domande frequenti</strong>" } };
      t["saas-faq-item-1"] = { es: { label: "¿Necesito saber programar para usar Fluxo?" }, it: { label: "Devo sapere programmare per usare Fluxo?" } };
      t["saas-faq-item-1-body"] = { es: { content: "No. Los flujos se diseñan arrastrando bloques visuales; el código es opcional para casos avanzados." }, it: { content: "No. I flussi si progettano trascinando blocchi visivi; il codice è opzionale per casi avanzati." } };
      t["saas-faq-item-2"] = { es: { label: "¿Puedo cambiar de plan en cualquier momento?" }, it: { label: "Posso cambiare piano in qualsiasi momento?" } };
      t["saas-faq-item-2-body"] = { es: { content: "Sí, puedes subir o bajar de plan cuando quieras; el cobro se prorratea automáticamente." }, it: { content: "Sì, puoi passare a un piano superiore o inferiore quando vuoi; la fatturazione viene ricalcolata automaticamente." } };
      t["saas-faq-item-3"] = { es: { label: "¿Qué pasa si supero el número de flujos de mi plan?" }, it: { label: "Cosa succede se supero il limite di flussi del mio piano?" } };
      t["saas-faq-item-3-body"] = { es: { content: "Te avisamos antes de llegar al límite y puedes actualizar tu plan sin perder ninguna automatización activa." }, it: { content: "Ti avvisiamo prima che tu raggiunga il limite e puoi aggiornare il piano senza perdere alcuna automazione attiva." } };
      t["saas-faq-item-4"] = { es: { label: "¿Ofrecen soporte para migrar desde otra herramienta?" }, it: { label: "Offrite supporto per migrare da un altro strumento?" } };
      t["saas-faq-item-4-body"] = { es: { content: "Sí, el plan Team y Enterprise incluyen onboarding asistido para migrar tus flujos existentes." }, it: { content: "Sì, i piani Team ed Enterprise includono un onboarding assistito per migrare i tuoi flussi esistenti." } };

      t["saas-footer-copyright"] = { es: { content: "© 2026 Fluxo Technologies Inc. Todos los derechos reservados." }, it: { content: "© 2026 Fluxo Technologies Inc. Tutti i diritti riservati." } };

      return t;
    })(),
  };
}

export const landingProductPageMeta: LayoutPageMeta = {
  title: "Fluxo · Workflow automation for teams",
  description:
    "Fluxo connects your tools and automates your team's repetitive tasks, no code required. 14-day free trial.",
  seo: {
    robots: "index,follow",
    openGraph: {
      title: "Fluxo · Workflow automation",
      description: "Connect your tools and automate repetitive tasks without code. 14-day free trial.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80&auto=format&fit=crop",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "Fluxo · Workflow automation",
      description: "Connect your tools and automate repetitive tasks without code. 14-day free trial.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80&auto=format&fit=crop",
    },
  },
  metaTranslations: {
    es: {
      title: "Fluxo · Automatización de flujos de trabajo para equipos",
      description: "Fluxo conecta tus herramientas y automatiza las tareas repetitivas de tu equipo, sin código. Prueba gratis 14 días.",
      seo: {
        openGraph: { title: "Fluxo · Automatización de flujos de trabajo", description: "Conecta tus herramientas y automatiza tareas repetitivas sin código. Prueba gratis 14 días." },
        twitter: { title: "Fluxo · Automatización de flujos de trabajo", description: "Conecta tus herramientas y automatiza tareas repetitivas sin código. Prueba gratis 14 días." },
      },
    },
    it: {
      title: "Fluxo · Automazione dei flussi di lavoro per i team",
      description: "Fluxo collega i tuoi strumenti e automatizza le attività ripetitive del tuo team, senza codice. Prova gratuita di 14 giorni.",
      seo: {
        openGraph: { title: "Fluxo · Automazione dei flussi di lavoro", description: "Collega i tuoi strumenti e automatizza le attività ripetitive senza codice. Prova gratuita di 14 giorni." },
        twitter: { title: "Fluxo · Automazione dei flussi di lavoro", description: "Collega i tuoi strumenti e automatizza le attività ripetitive senza codice. Prova gratuita di 14 giorni." },
      },
    },
  },
};
