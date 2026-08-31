import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Franja de KPIs con icono (docs/37 §3.1 #5): 3 `stat` + `icon`, distinta de
 * la de `example-home` (sin duplicar contenido, docs/16 §13.1). Grid
 * mobile-first, escrita exclusivamente con `BASE_TOKENS`.
 */
export function buildStatsStripFragment(): NodeFragment {
  return {
    rootId: "stats-strip-root",
    nodes: {
      "stats-strip-root": {
        id: "stats-strip-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
            spacing: { padding: { token: "spacing.md" } },
          },
          overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
        },
        children: ["stats-strip-1", "stats-strip-2", "stats-strip-3"],
      },
      "stats-strip-1": {
        id: "stats-strip-1",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.xs" } } },
        },
        children: ["stats-strip-1-icon", "stats-strip-1-stat"],
      },
      "stats-strip-1-icon": {
        id: "stats-strip-1-icon",
        type: "icon",
        props: { name: "Zap", title: "" },
        style: defaultStyleFor("icon"),
      },
      "stats-strip-1-stat": {
        id: "stats-strip-1-stat",
        type: "stat",
        props: { value: "3x", label: "más rápido de lanzar" },
        style: defaultStyleFor("stat"),
      },
      "stats-strip-2": {
        id: "stats-strip-2",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.xs" } } },
        },
        children: ["stats-strip-2-icon", "stats-strip-2-stat"],
      },
      "stats-strip-2-icon": {
        id: "stats-strip-2-icon",
        type: "icon",
        props: { name: "ShieldCheck", title: "" },
        style: defaultStyleFor("icon"),
      },
      "stats-strip-2-stat": {
        id: "stats-strip-2-stat",
        type: "stat",
        props: { value: "99.9%", label: "disponibilidad" },
        style: defaultStyleFor("stat"),
      },
      "stats-strip-3": {
        id: "stats-strip-3",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.xs" } } },
        },
        children: ["stats-strip-3-icon", "stats-strip-3-stat"],
      },
      "stats-strip-3-icon": {
        id: "stats-strip-3-icon",
        type: "icon",
        props: { name: "Globe", title: "" },
        style: defaultStyleFor("icon"),
      },
      "stats-strip-3-stat": {
        id: "stats-strip-3-stat",
        type: "stat",
        props: { value: "80+", label: "países con usuarios activos" },
        style: defaultStyleFor("stat"),
      },
    },
  };
}
