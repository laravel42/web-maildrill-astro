import type { BuilderNode } from "../../../model/types";
import { defaultStyleFor } from "../styleFor";

/**
 * Prueba social de la home: testimonio+quote, pricing, FAQ y logo cloud.
 * Función (no `const` de módulo, docs/27 §5 Fase 2): ver `chrome.ts` para el
 * porqué (llama a `defaultStyleFor` → `componentRegistry`, peligroso en
 * tiempo de módulo). Solo se invoca desde dentro de `createExampleDocument()`.
 */
export function contentNodes(): Record<string, BuilderNode> {
  return {
    // --- Testimonial + Quote + Badge + Alert (prueba social) --------------
    testimonialSection: {
      id: "testimonialSection",
      type: "section",
      props: {},
      style: {
        base: {
          layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
          spacing: { padding: { token: "spacing.md" } },
        },
        overrides: { md: { layout: { gridTemplateColumns: "1fr 1fr" } } },
      },
      children: ["testimonialCard", "quoteAside"],
    },
    testimonialCard: {
      id: "testimonialCard",
      type: "testimonial",
      props: {
        quote: "Publicamos nuestro sitio en una tarde, sin escribir una línea de CSS.",
        name: "Marta Ruiz",
        role: "Fundadora, Studio Nimbus",
        initials: "MR",
      },
      style: defaultStyleFor("testimonial"),
    },
    quoteAside: {
      id: "quoteAside",
      type: "container",
      props: {},
      style: {
        base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } },
      },
      children: ["newBadge", "quoteBlock", "infoAlert"],
    },
    newBadge: {
      id: "newBadge",
      type: "badge",
      props: { label: "Nuevo en Fase 12" },
      style: defaultStyleFor("badge"),
    },
    quoteBlock: {
      id: "quoteBlock",
      type: "quote",
      props: { content: "El mejor código es el que no tienes que mantener.", attribution: "Anónimo" },
      style: defaultStyleFor("quote"),
    },
    infoAlert: {
      id: "infoAlert",
      type: "alert",
      props: { message: "Este sitio se exporta como HTML + CSS estático, sin runtime del builder.", variant: "info", showIcon: true },
      style: defaultStyleFor("alert"),
    },

    // --- Pricing: dos planes con el componente `pricing-card` --------------
    pricingSection: {
      id: "pricingSection",
      type: "section",
      props: {},
      style: {
        base: {
          layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" }, justifyContent: "center" },
          spacing: { padding: { token: "spacing.md" } },
        },
        overrides: { md: { layout: { gridTemplateColumns: "repeat(2, minmax(0, 360px))" } } },
      },
      children: ["pricingFree", "pricingPro"],
    },
    pricingFree: {
      id: "pricingFree",
      type: "pricing-card",
      props: {
        planName: "Free",
        price: "$0",
        period: "/mes",
        features: "1 sitio\nExport HTML/CSS\nComponentes base",
        ctaLabel: "Empezar gratis",
        ctaLink: { kind: "internal", pageId: "contact" },
        popular: false,
        popularLabel: "Popular",
      },
      style: defaultStyleFor("pricing-card"),
    },
    pricingPro: {
      id: "pricingPro",
      type: "pricing-card",
      props: {
        planName: "Pro",
        price: "$29",
        period: "/mes",
        features: "Sitios ilimitados\nDominios propios\nSoporte prioritario",
        ctaLabel: "Empezar",
        ctaLink: { kind: "internal", pageId: "contact" },
        popular: true,
        popularLabel: "Popular",
      },
      style: defaultStyleFor("pricing-card"),
    },

    // --- FAQ: `accordion` interactivo (Bloque D, runtime opt-in) -----------
    faqSection: {
      id: "faqSection",
      type: "section",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
          spacing: { padding: { token: "spacing.md" } },
        },
      },
      children: ["faqTitle", "faqAccordion"],
    },
    faqTitle: {
      id: "faqTitle",
      type: "text",
      props: { content: "<strong>Preguntas frecuentes</strong>" },
      style: { base: { appearance: { color: { token: "colors.text" } } } },
    },
    faqAccordion: {
      id: "faqAccordion",
      type: "accordion",
      props: {
        items: [
          { label: "¿El sitio exportado necesita el builder para funcionar?", value: "No. El export es HTML + CSS estático; el builder no se incluye en el output." },
          { label: "¿Puedo usar mi propio dominio?", value: "Sí, el export es un sitio estático normal: se publica donde quieras." },
          { label: "¿Incluye JavaScript?", value: "Solo el que tú activas de forma explícita (behaviors como este acordeón o el carrusel)." },
        ],
        openFirst: true,
      },
      style: defaultStyleFor("accordion"),
    },

    // --- Logo cloud: prueba social con logos (imagen dentro) ---------------
    logoCloudSection: {
      id: "logoCloudSection",
      type: "section",
      props: {},
      style: {
        base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } }, spacing: { padding: { token: "spacing.md" } } },
      },
      children: ["logoCloudTitle", "logoCloud", "socialRow"],
    },
    logoCloudTitle: {
      id: "logoCloudTitle",
      type: "text",
      props: { content: "Con la confianza de" },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
    logoCloud: {
      id: "logoCloud",
      type: "logo-cloud",
      props: {},
      style: defaultStyleFor("logo-cloud"),
      children: ["logoCloudImg1", "logoCloudImg2", "logoCloudImg3"],
    },
    logoCloudImg1: {
      id: "logoCloudImg1",
      type: "image",
      props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Cliente 1", objectFit: "contain" },
      style: { base: { size: { width: "120px" } } },
    },
    logoCloudImg2: {
      id: "logoCloudImg2",
      type: "image",
      props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Cliente 2", objectFit: "contain" },
      style: { base: { size: { width: "120px" } } },
    },
    logoCloudImg3: {
      id: "logoCloudImg3",
      type: "image",
      props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Cliente 3", objectFit: "contain" },
      style: { base: { size: { width: "120px" } } },
    },
    socialRow: {
      id: "socialRow",
      type: "social-links",
      props: {},
      style: defaultStyleFor("social-links"),
    },
  };
}
