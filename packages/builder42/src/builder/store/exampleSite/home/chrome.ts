import type { BuilderNode } from "../../../model/types";
import { defaultStyleFor } from "../styleFor";

/**
 * Chrome de la home: root, wrap centrado, navbar (logo + language-nav) y
 * footer. Función (no `const` de módulo, docs/27 §5 Fase 2): llama a
 * `defaultStyleFor`, que a su vez lee del `componentRegistry` — evaluar este
 * mapa en tiempo de módulo repetiría el ciclo peligroso que Fase 2 elimina en
 * `documentStore.ts`. Solo se invoca desde dentro de `createExampleDocument()`.
 */
export function chromeNodes(): Record<string, BuilderNode> {
  return {
    root: {
      id: "root",
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
          appearance: { background: { token: "colors.surface.alt" } },
        },
      },
      children: ["wrap"],
    },
    // Contenedor centrado con ancho máximo tokenizado (docs/08 §1): la pieza
    // que prueba `sizes.container`. `margin: "0 auto"` centra el bloque
    // dentro del `root` (que ocupa el 100% del viewport).
    wrap: {
      id: "wrap",
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
          spacing: { padding: { token: "spacing.lg" }, margin: "0 auto" },
          size: { width: "100%", maxWidth: { token: "sizes.container" } },
          // Token semántico en vez de valor hardcodeado: cambia con el tema.
          appearance: { background: { token: "colors.surface.default" } },
        },
      },
      children: [
        "header",
        "hero",
        "features",
        "videoSection",
        "planSection",
        "statsSection",
        "testimonialSection",
        "pricingSection",
        "faqSection",
        "logoCloudSection",
        "footer",
      ],
    },

    // --- Navbar: logo (text) + langNav como children del slot; el menú de
    // páginas se genera solo desde `ctx.pagesInfo` (docs/16 §12.4 rework) —
    // reemplaza el `header` a mano (container + botones) de antes.
    header: {
      id: "header",
      type: "navbar",
      props: { hiddenPageIds: [] },
      style: defaultStyleFor("navbar"),
      behaviors: [{ type: "navbar", options: { duration: 240 } }],
      children: ["logo", "langNav"],
    },
    logo: {
      id: "logo",
      type: "text",
      props: { content: "<strong>Builder42</strong>" },
      style: {
        base: {
          typography: {
            fontFamily: { token: "typography.families.sans" },
            fontSize: { token: "typography.sizes.lg" },
            fontWeight: { token: "typography.weights.bold" },
          },
          // colors.text es el color de texto semántico (oscuro en claro, claro en oscuro).
          appearance: { color: { token: "colors.text" } },
        },
      },
    },
    // Selector de idioma del sitio publicado (docs/14 §2): dropdown cero-JS
    // (<details>) con ícono de globo. Enlaza a las versiones localizadas de
    // la página actual (es/en/it) — SEO-safe, sin runtime. Vive dentro del
    // slot del navbar junto al logo (dos hijos en `.pb-navbar__brand`).
    langNav: {
      id: "langNav",
      type: "language-nav",
      props: { triggerMode: "icon", displayMode: "native", showCurrent: true, ariaLabel: "Idioma" },
      style: {
        base: {
          // colors.muted = texto secundario del tema activo.
          appearance: { color: { token: "colors.muted" } },
        },
      },
    },

    // --- Footer -----------------------------------------------------------
    footer: {
      id: "footer",
      type: "container",
      props: {},
      style: {
        base: {
          layout: { display: "flex", justifyContent: "center" },
          spacing: { padding: { token: "spacing.md" } },
        },
      },
      children: ["footerNote"],
    },
    footerNote: {
      id: "footerNote",
      type: "text",
      props: { content: "© Builder42 — documento de ejemplo." },
      style: { base: { appearance: { color: { token: "colors.muted" } } } },
    },
  };
}
