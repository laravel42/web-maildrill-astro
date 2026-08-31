import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Banda de llamada a la acción: título + subtítulo + botón, cerrada con un
 * `divider` (docs/37 §3.1 #4 — primer uso de `divider` en la galería de
 * layouts). Escrita exclusivamente con `BASE_TOKENS`.
 */
export function buildCtaBannerFragment(): NodeFragment {
  return {
    rootId: "cta-banner-root",
    nodes: {
      "cta-banner-root": {
        id: "cta-banner-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.lg" } },
            appearance: { background: { token: "colors.primary.default" }, borderRadius: { token: "radii.md" } },
          },
        },
        children: ["cta-banner-title", "cta-banner-sub", "cta-banner-btn", "cta-banner-divider"],
      },
      "cta-banner-title": {
        id: "cta-banner-title",
        type: "text",
        props: { content: "<strong>Da el siguiente paso hoy</strong>" },
        style: { base: { appearance: { color: { token: "colors.primary.on" } } } },
      },
      "cta-banner-sub": {
        id: "cta-banner-sub",
        type: "text",
        props: { content: "Sin tarjeta de crédito. Cancela cuando quieras." },
        style: { base: { appearance: { color: { token: "colors.primary.on" } } } },
      },
      "cta-banner-btn": {
        id: "cta-banner-btn",
        type: "button",
        props: { label: "Comenzar gratis", link: { kind: "external", href: "#" } },
        style: {
          base: {
            appearance: {
              background: { token: "colors.primary.on" },
              color: { token: "colors.primary.default" },
              borderRadius: { token: "radii.md" },
            },
          },
        },
      },
      "cta-banner-divider": {
        id: "cta-banner-divider",
        type: "divider",
        props: {},
        style: defaultStyleFor("divider"),
      },
    },
  };
}
