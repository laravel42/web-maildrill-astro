import type { BuilderNode } from "../../../model/types";
import { defaultStyleFor } from "../styleFor";

/**
 * Hero de la home + features (grid img/2 cards) + plan (select) + stats.
 * Función (no `const` de módulo, docs/27 §5 Fase 2): ver `chrome.ts` para el
 * porqué (llama a `defaultStyleFor` → `componentRegistry`, peligroso en
 * tiempo de módulo). Solo se invoca desde dentro de `createExampleDocument()`.
 */
export function heroNodes(): Record<string, BuilderNode> {
  return {
    // --- Hero: título + subtítulo + CTA ----------------------------------
    hero: {
      id: "hero",
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", alignItems: "flex-start", gap: { token: "spacing.sm" } },
          spacing: { padding: { token: "spacing.lg" } },
          appearance: {
            // colors.primary.default = fondo del acento; colors.primary.on = texto sobre ese fondo.
            background: { token: "colors.primary.default" },
            borderRadius: { token: "radii.md" },
          },
        },
      },
      children: ["heroTitle", "heroSubtitle", "heroCta"],
    },
    heroTitle: {
      id: "heroTitle",
      type: "text",
      props: { content: "<strong>Construye páginas sin escribir código</strong>" },
      style: {
        base: {
          size: { maxWidth: "32ch" },
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: { token: "typography.sizes.lg" },
            fontWeight: { token: "typography.weights.bold" },
          },
          appearance: { color: { token: "colors.primary.on" } },
        },
      },
    },
    heroSubtitle: {
      id: "heroSubtitle",
      type: "text",
      props: { content: "Arrastra, suelta y exporta HTML + CSS estático listo para publicar." },
      style: {
        base: {
          size: { maxWidth: "40ch" },
          typography: { fontFamily: { token: "typography.families.sans" } },
          appearance: { color: { token: "colors.primary.on" } },
        },
      },
    },
    heroCta: {
      id: "heroCta",
      type: "button",
      props: { label: "Empezar", link: { kind: "internal", pageId: "about" } },
      style: {
        base: {
          spacing: { padding: "8px 16px" },
          appearance: {
            // Botón invertido: fondo = on-primary, texto = primary.
            background: { token: "colors.primary.on" },
            color: { token: "colors.primary.default" },
            borderRadius: { token: "radii.md" },
          },
        },
      },
    },

    // --- Features: grid 1→3 columnas en md (imagen + 2 tarjetas de texto) -
    features: {
      id: "features",
      type: "section",
      props: {},
      style: {
        base: {
          layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
          spacing: { padding: { token: "spacing.md" } },
        },
        overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
      },
      children: ["img", "featureA", "featureB"],
    },
    img: {
      id: "img",
      type: "image",
      props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Asset de ejemplo", objectFit: "cover" },
      style: { base: { size: { width: "100%" }, appearance: { borderRadius: { token: "radii.md" } } } },
    },
    featureA: {
      id: "featureA",
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
          spacing: { padding: { token: "spacing.md" } },
          appearance: { background: { token: "colors.surface.alt" }, borderRadius: { token: "radii.md" } },
        },
      },
      children: ["featureATitle", "featureABody"],
    },
    featureATitle: {
      id: "featureATitle",
      type: "text",
      props: { content: "<strong>Responsive de fábrica</strong>" },
      // colors.text = texto principal del tema.
      style: { base: { appearance: { color: { token: "colors.text" } } } },
    },
    featureABody: {
      id: "featureABody",
      type: "text",
      props: { content: "Mobile-first con overrides por breakpoint, sin CSS a mano." },
      // colors.muted = texto secundario/descriptivo del tema.
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
    featureB: {
      id: "featureB",
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
          spacing: { padding: { token: "spacing.md" } },
          appearance: { background: { token: "colors.surface.alt" }, borderRadius: { token: "radii.md" } },
        },
      },
      children: ["featureBTitle", "featureBBody"],
    },
    featureBTitle: {
      id: "featureBTitle",
      type: "text",
      props: { content: "<strong>Export 100% estático</strong>" },
      style: { base: { appearance: { color: { token: "colors.text" } } } },
    },
    featureBBody: {
      id: "featureBBody",
      type: "text",
      props: { content: "HTML + CSS listos para desplegar, sin runtime del builder." },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },

    // --- Video: demo embebida + copy (docs/16 §12.1 #9) --------------------
    videoSection: {
      id: "videoSection",
      type: "section",
      props: {},
      style: {
        base: {
          layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" }, alignItems: "center" },
          spacing: { padding: { token: "spacing.md" } },
        },
        overrides: { md: { layout: { gridTemplateColumns: "1fr 1fr" } } },
      },
      children: ["videoEmbed", "videoCopy"],
    },
    videoEmbed: {
      id: "videoEmbed",
      type: "video",
      props: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", aspectRatio: "16:9", title: "Demo del producto" },
      style: defaultStyleFor("video"),
    },
    videoCopy: {
      id: "videoCopy",
      type: "container",
      props: {},
      style: { base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } } } },
      children: ["videoCopyTitle", "videoCopyBody", "videoCopyDivider"],
    },
    videoCopyTitle: {
      id: "videoCopyTitle",
      type: "text",
      props: { content: "<strong>Míralo en acción</strong>" },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.sans" }, fontWeight: { token: "typography.weights.bold" } },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    videoCopyBody: {
      id: "videoCopyBody",
      type: "text",
      props: { content: "Dos minutos para ver cómo tu equipo pasa de idea a sitio publicado." },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
    videoCopyDivider: {
      id: "videoCopyDivider",
      type: "divider",
      props: {},
      style: defaultStyleFor("divider"),
    },

    // --- Plan section: demo del componente `select` (form) ----------------
    planSection: {
      id: "planSection",
      type: "section",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" }, alignItems: "flex-start" },
          spacing: { padding: { token: "spacing.md" } },
          size: { maxWidth: "360px" },
        },
      },
      children: ["planLabel", "planSelect"],
    },
    planLabel: {
      id: "planLabel",
      type: "text",
      props: { content: "<strong>Elige tu plan</strong>" },
      style: {
        base: {
          typography: { fontFamily: { token: "typography.families.sans" } },
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    planSelect: {
      id: "planSelect",
      type: "select",
      props: {
        options: [
          { label: "Gratis", value: "free" },
          { label: "Pro", value: "pro" },
          { label: "Empresa", value: "enterprise" },
        ],
        name: "plan",
        placeholder: "Selecciona un plan…",
        ariaLabel: "Plan",
      },
      style: defaultStyleFor("select"),
    },

    // --- Stats: KPIs con el componente `stat` (Bloque cero-JS) -------------
    statsSection: {
      id: "statsSection",
      type: "section",
      props: {},
      style: {
        base: {
          layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.sm" } },
          spacing: { padding: { token: "spacing.md" } },
        },
        overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
      },
      children: ["statUsers", "statUptime", "statCountries"],
    },
    statUsers: {
      id: "statUsers",
      type: "stat",
      props: { value: "+12k", label: "sitios publicados" },
      style: defaultStyleFor("stat"),
    },
    statUptime: {
      id: "statUptime",
      type: "stat",
      props: { value: "99.9%", label: "uptime del export" },
      style: defaultStyleFor("stat"),
    },
    statCountries: {
      id: "statCountries",
      type: "stat",
      props: { value: "40+", label: "países" },
      style: defaultStyleFor("stat"),
    },
  };
}
