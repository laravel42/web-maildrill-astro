import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Features organizados en pestañas (docs/37 §3.1 #6): primer uso de `tabs` en
 * la galería de layouts (hueco real, docs/37 §1) — interactivo, mayor riesgo.
 * Modelo composite children-based (docs/23): cada pestaña es un nodo `tab`
 * hijo (`slots.itemType`), con `props.label` = título y `children` = panel.
 */
export function buildTabsFeaturesFragment(): NodeFragment {
  return {
    rootId: "tabs-features-root",
    nodes: {
      "tabs-features-root": {
        id: "tabs-features-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.md" } },
          },
        },
        children: ["tabs-features-title", "tabs-features-tabs"],
      },
      "tabs-features-title": {
        id: "tabs-features-title",
        type: "text",
        props: { content: "<strong>Todo lo que incluye tu plan</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
      },
      "tabs-features-tabs": {
        id: "tabs-features-tabs",
        type: "tabs",
        props: {},
        style: defaultStyleFor("tabs"),
        children: ["tabs-features-tab-1", "tabs-features-tab-2", "tabs-features-tab-3"],
      },
      "tabs-features-tab-1": {
        id: "tabs-features-tab-1",
        type: "tab",
        props: { label: "Automatización" },
        style: defaultStyleFor("tab"),
        children: ["tabs-features-tab-1-img", "tabs-features-tab-1-text"],
      },
      "tabs-features-tab-1-img": {
        id: "tabs-features-tab-1-img",
        type: "image",
        props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Panel de automatización", objectFit: "cover" },
        style: { base: { size: { width: "100%" }, appearance: { borderRadius: { token: "radii.md" } } } },
      },
      "tabs-features-tab-1-text": {
        id: "tabs-features-tab-1-text",
        type: "text",
        props: { content: "Reglas que se ejecutan solas: menos trabajo repetitivo para tu equipo." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "tabs-features-tab-2": {
        id: "tabs-features-tab-2",
        type: "tab",
        props: { label: "Reportes" },
        style: defaultStyleFor("tab"),
        children: ["tabs-features-tab-2-img", "tabs-features-tab-2-text"],
      },
      "tabs-features-tab-2-img": {
        id: "tabs-features-tab-2-img",
        type: "image",
        props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Panel de reportes", objectFit: "cover" },
        style: { base: { size: { width: "100%" }, appearance: { borderRadius: { token: "radii.md" } } } },
      },
      "tabs-features-tab-2-text": {
        id: "tabs-features-tab-2-text",
        type: "text",
        props: { content: "Métricas en tiempo real, exportables a CSV en un clic." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "tabs-features-tab-3": {
        id: "tabs-features-tab-3",
        type: "tab",
        props: { label: "Integraciones" },
        style: defaultStyleFor("tab"),
        children: ["tabs-features-tab-3-img", "tabs-features-tab-3-text"],
      },
      "tabs-features-tab-3-img": {
        id: "tabs-features-tab-3-img",
        type: "image",
        props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Panel de integraciones", objectFit: "cover" },
        style: { base: { size: { width: "100%" }, appearance: { borderRadius: { token: "radii.md" } } } },
      },
      "tabs-features-tab-3-text": {
        id: "tabs-features-tab-3-text",
        type: "text",
        props: { content: "Conecta tus herramientas favoritas sin escribir código." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
    },
  };
}
