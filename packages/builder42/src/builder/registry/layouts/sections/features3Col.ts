import type { NodeFragment } from "../../../model/tree";

/**
 * Sección "3 columnas de features", con contenido propio (no un recorte del
 * grid de `example-home` — ver deuda cerrada en docs/16 §13.1). Grid
 * mobile-first (1 col → 3 col en `md`) de `card`s con título/descripción,
 * escrito exclusivamente con `BASE_TOKENS`.
 */
export function buildFeatures3ColFragment(): NodeFragment {
  return {
    rootId: "features-3col-root",
    nodes: {
      "features-3col-root": {
        id: "features-3col-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
            spacing: { padding: { token: "spacing.md" } },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
        },
        children: ["features-3col-1", "features-3col-2", "features-3col-3"],
      },
      "features-3col-1": {
        id: "features-3col-1",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.md" } },
            appearance: { background: { token: "colors.surface.alt" }, borderRadius: { token: "radii.md" } },
          },
        },
        children: ["features-3col-1-title", "features-3col-1-body"],
      },
      "features-3col-1-title": {
        id: "features-3col-1-title",
        type: "text",
        props: { content: "<strong>Rápido de configurar</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "features-3col-1-body": {
        id: "features-3col-1-body",
        type: "text",
        props: { content: "Elige un layout y personalízalo en lugar de partir de cero." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "features-3col-2": {
        id: "features-3col-2",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.md" } },
            appearance: { background: { token: "colors.surface.alt" }, borderRadius: { token: "radii.md" } },
          },
        },
        children: ["features-3col-2-title", "features-3col-2-body"],
      },
      "features-3col-2-title": {
        id: "features-3col-2-title",
        type: "text",
        props: { content: "<strong>Se adapta a tu tema</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "features-3col-2-body": {
        id: "features-3col-2-body",
        type: "text",
        props: { content: "Escrito solo con tokens: cambia de tema y la sección se actualiza sola." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "features-3col-3": {
        id: "features-3col-3",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.md" } },
            appearance: { background: { token: "colors.surface.alt" }, borderRadius: { token: "radii.md" } },
          },
        },
        children: ["features-3col-3-title", "features-3col-3-body"],
      },
      "features-3col-3-title": {
        id: "features-3col-3-title",
        type: "text",
        props: { content: "<strong>Editable pieza a pieza</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "features-3col-3-body": {
        id: "features-3col-3-body",
        type: "text",
        props: { content: "Cada tarjeta es un contenedor normal: agrega, quita o reordena libremente." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
    },
  };
}
