import type { NodeFragment } from "../../../model/tree";

/**
 * Sección "3 columnas de features", con contenido propio (no un recorte del
 * grid de `example-home` — ver deuda cerrada en docs/16 §13.1). Grid
 * mobile-first (1 col → 3 col en `md`) de `card`s con icono + título/
 * descripción, escrito exclusivamente con `BASE_TOKENS` salvo el `boxShadow`
 * (string CSS libre, el modelo de estilos no tokeniza sombras compuestas).
 *
 * Pulido de diseño (feedback: "3 cajas idénticas" se sentía monótono):
 *  - Cada tarjeta abre con un `icon` (lucide) sobre un halo circular
 *    (`background: colors.surface.alt` + `borderRadius: 50%`, o
 *    `colors.primary.default` en la tarjeta con énfasis) en vez de ir directo
 *    al título — da un punto de entrada visual y referencia el contenido
 *    (automatización, temas, edición) antes de leer el copy. Iconos: `Zap`
 *    (rápido de configurar), `Palette` (temas) y `PenTool` (edición pieza a
 *    pieza).
 *  - `boxShadow` con blur real (`0 20px 40px -12px rgba(...)`, offset+blur+
 *    spread negativo) en las 3 tarjetas — no el `0 2px 4px` plano típico de
 *    una sombra de "card" default. Sustituye el `background: surface.alt`
 *    plano anterior: ahora las tarjetas flotan en `colors.surface.default`
 *    con sombra, en vez de diferenciarse solo por un fondo gris alterno.
 *  - La tarjeta del medio ("Se adapta a tu tema") rompe la simetría de 3
 *    cajas idénticas con un `borderColor` de acento + sombra más pronunciada
 *    (no una tarjeta más grande ni reposicionada — el modelo no soporta
 *    `position`/`transform`, así que el énfasis es puramente de superficie).
 *    Es sutil a propósito: sigue leyéndose como una fila de 3 features, no
 *    como "2 features + 1 destacada aparte".
 */
export function buildFeatures3ColFragment(): NodeFragment {
  const cardShadow = "0 20px 40px -12px rgba(15, 23, 42, 0.18), 0 4px 10px -6px rgba(15, 23, 42, 0.10)";
  const cardShadowEmphasis = "0 28px 56px -14px rgba(37, 99, 235, 0.28), 0 6px 14px -6px rgba(37, 99, 235, 0.16)";

  return {
    rootId: "features-3col-root",
    nodes: {
      "features-3col-root": {
        id: "features-3col-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.lg" } },
            spacing: { padding: { token: "spacing.lg" } },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
        },
        children: ["features-3col-1", "features-3col-2", "features-3col-3"],
      },

      // --- 1. Rápido de configurar -------------------------------------------
      "features-3col-1": {
        id: "features-3col-1",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.lg" } },
            appearance: {
              background: { token: "colors.surface.default" },
              borderRadius: { token: "radii.lg" },
              boxShadow: cardShadow,
            },
          },
        },
        children: ["features-3col-1-icon-wrap", "features-3col-1-title", "features-3col-1-body"],
      },
      "features-3col-1-icon-wrap": {
        id: "features-3col-1-icon-wrap",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "center", alignItems: "center" },
            size: { width: "48px", height: "48px" },
            appearance: { background: { token: "colors.surface.alt" }, borderRadius: "50%" },
          },
        },
        children: ["features-3col-1-icon"],
      },
      "features-3col-1-icon": {
        id: "features-3col-1-icon",
        type: "icon",
        props: { name: "Zap", title: "" },
        style: { base: { size: { width: "22px", height: "22px" }, appearance: { color: { token: "colors.primary.default" } } } },
      },
      "features-3col-1-title": {
        id: "features-3col-1-title",
        type: "text",
        props: { content: "<strong>Quick to set up</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "features-3col-1-body": {
        id: "features-3col-1-body",
        type: "text",
        props: { content: "Pick a layout and customize it instead of starting from scratch." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },

      // --- 2. Se adapta a tu tema (énfasis visual) ---------------------------
      "features-3col-2": {
        id: "features-3col-2",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.lg" } },
            appearance: {
              background: { token: "colors.surface.default" },
              borderColor: { token: "colors.primary.default" },
              borderWidth: "1px",
              borderStyle: "solid",
              borderRadius: { token: "radii.lg" },
              boxShadow: cardShadowEmphasis,
            },
          },
        },
        children: ["features-3col-2-icon-wrap", "features-3col-2-title", "features-3col-2-body"],
      },
      "features-3col-2-icon-wrap": {
        id: "features-3col-2-icon-wrap",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "center", alignItems: "center" },
            size: { width: "48px", height: "48px" },
            appearance: { background: { token: "colors.primary.default" }, borderRadius: "50%" },
          },
        },
        children: ["features-3col-2-icon"],
      },
      "features-3col-2-icon": {
        id: "features-3col-2-icon",
        type: "icon",
        props: { name: "Palette", title: "" },
        style: { base: { size: { width: "22px", height: "22px" }, appearance: { color: { token: "colors.primary.on" } } } },
      },
      "features-3col-2-title": {
        id: "features-3col-2-title",
        type: "text",
        props: { content: "<strong>Follows your theme</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "features-3col-2-body": {
        id: "features-3col-2-body",
        type: "text",
        props: { content: "Written with tokens only: change the theme and the section updates itself." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },

      // --- 3. Editable pieza a pieza ------------------------------------------
      "features-3col-3": {
        id: "features-3col-3",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.lg" } },
            appearance: {
              background: { token: "colors.surface.default" },
              borderRadius: { token: "radii.lg" },
              boxShadow: cardShadow,
            },
          },
        },
        children: ["features-3col-3-icon-wrap", "features-3col-3-title", "features-3col-3-body"],
      },
      "features-3col-3-icon-wrap": {
        id: "features-3col-3-icon-wrap",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", justifyContent: "center", alignItems: "center" },
            size: { width: "48px", height: "48px" },
            appearance: { background: { token: "colors.surface.alt" }, borderRadius: "50%" },
          },
        },
        children: ["features-3col-3-icon"],
      },
      "features-3col-3-icon": {
        id: "features-3col-3-icon",
        type: "icon",
        props: { name: "PenTool", title: "" },
        style: { base: { size: { width: "22px", height: "22px" }, appearance: { color: { token: "colors.primary.default" } } } },
      },
      "features-3col-3-title": {
        id: "features-3col-3-title",
        type: "text",
        props: { content: "<strong>Editable piece by piece</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "features-3col-3-body": {
        id: "features-3col-3-body",
        type: "text",
        props: { content: "Each card is a normal container: add, remove, or reorder freely." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
    },
  };
}
