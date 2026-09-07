import type { BuilderPage, PageId } from "../../model/types";
import { createPage } from "../../model/site";
import { defaultStyleFor } from "./styleFor";

// Página "Componentes": escaparate de los composites con SLOTS children-based
// (docs/23) — `tabs` y `accordion` cuyo contenido son NODOS HIJO reales
// (`tab`/`accordion-item`), no un `props.items` de strings planos. Cada panel
// de pestaña y cada sección del acordeón contiene componentes arrastrables
// (imagen, stats, badge, alert, botón, containers de layout), demostrando el
// potencial del rework: contenido rico y estilizable dentro de cada slot.
//
// OJO: se construye directamente en el formato NUEVO (composite → slots →
// contenido). `migrateSiteCompositeSlots` lo ignora (ya tiene `children` y no
// tiene `props.items`, migración idempotente, docs/23 §7). Los behaviors
// (`tabs`/`accordion`) se declaran a mano en el nodo composite, igual que
// haría `createNodeTreeForType` al arrastrarlo desde la paleta.
export function createFeaturesPage(contactPageId: PageId, homePageId: PageId): BuilderPage {
  return createPage(
    { title: "Componentes", slug: "componentes" },
    {
      rootId: "feat-root",
      meta: { version: 1 },
      nodes: {
        "feat-root": {
          id: "feat-root",
          type: "container",
          props: {},
          style: {
            base: {
              layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
              appearance: { background: { token: "colors.surface.alt" } },
            },
          },
          children: ["feat-wrap"],
        },
        // Contenedor centrado con ancho máximo tokenizado (patrón de la home):
        // acota navbar/hero/tabs/accordion a `sizes.container` y los centra.
        "feat-wrap": {
          id: "feat-wrap",
          type: "container",
          props: {},
          style: {
            base: {
              layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.lg" } },
              spacing: { padding: { token: "spacing.lg" }, margin: "0 auto" },
              size: { width: "100%", maxWidth: { token: "sizes.container" } },
              appearance: { background: { token: "colors.surface.default" } },
            },
          },
          children: ["feat-navbar", "feat-hero", "feat-tabs-section", "feat-acc-section", "feat-footer"],
        },
        "feat-navbar": {
          id: "feat-navbar",
          type: "navbar",
          props: { brand: "Builder42", hiddenPageIds: [] },
          style: defaultStyleFor("navbar"),
          behaviors: [{ type: "navbar", options: { duration: 240 } }],
        },

        // --- Hero de la página ---------------------------------------------
        "feat-hero": {
          id: "feat-hero",
          type: "hero",
          props: {},
          style: defaultStyleFor("hero"),
          children: ["feat-hero-title", "feat-hero-sub"],
        },
        "feat-hero-title": {
          id: "feat-hero-title",
          type: "text",
          props: { content: "<strong>Componentes con slots</strong>" },
          style: defaultStyleFor("text"),
        },
        "feat-hero-sub": {
          id: "feat-hero-sub",
          type: "text",
          props: {
            content:
              "Pestañas y acordeones cuyo contenido son componentes reales: arrastra imágenes, métricas, botones o cualquier bloque dentro de cada panel o sección.",
          },
          style: defaultStyleFor("text"),
        },

        // --- Sección TABS: cada panel = container con contenido rico --------
        "feat-tabs-section": {
          id: "feat-tabs-section",
          type: "section",
          props: {},
          style: {
            base: {
              layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
              spacing: { padding: { token: "spacing.md" } },
            },
          },
          children: ["feat-tabs-heading", "feat-tabs-intro", "feat-tabs"],
        },
        "feat-tabs-heading": {
          id: "feat-tabs-heading",
          type: "text",
          props: { content: "<strong>Pestañas con contenido real</strong>" },
          style: { base: { appearance: { color: { token: "colors.text" } } } },
        },
        "feat-tabs-intro": {
          id: "feat-tabs-intro",
          type: "text",
          props: {
            content: "Cada pestaña es un contenedor: aquí una galería, unas métricas y una llamada a la acción.",
          },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "feat-tabs": {
          id: "feat-tabs",
          type: "tabs",
          props: {},
          style: defaultStyleFor("tabs"),
          behaviors: [{ type: "tabs", options: { duration: 220 } }],
          children: ["feat-tab-1", "feat-tab-2", "feat-tab-3"],
        },
        // Pestaña 1 — Galería: imagen + descripción.
        "feat-tab-1": {
          id: "feat-tab-1",
          type: "tab",
          props: { label: "Galería" },
          style: defaultStyleFor("tab"),
          children: ["feat-tab1-img", "feat-tab1-text"],
        },
        "feat-tab1-img": {
          id: "feat-tab1-img",
          type: "image",
          props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Vista previa", objectFit: "cover" },
          style: { base: { size: { width: "100%" }, appearance: { borderRadius: { token: "radii.md" } } } },
        },
        "feat-tab1-text": {
          id: "feat-tab1-text",
          type: "text",
          props: { content: "Una imagen soltada directamente dentro del panel de la pestaña." },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        // Pestaña 2 — Métricas: grid de 3 `stat`.
        "feat-tab-2": {
          id: "feat-tab-2",
          type: "tab",
          props: { label: "Métricas" },
          style: defaultStyleFor("tab"),
          children: ["feat-tab2-stats"],
        },
        "feat-tab2-stats": {
          id: "feat-tab2-stats",
          type: "container",
          props: {},
          style: {
            base: {
              layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.sm" } },
            },
            overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
          },
          children: ["feat-stat-1", "feat-stat-2", "feat-stat-3"],
        },
        "feat-stat-1": {
          id: "feat-stat-1",
          type: "stat",
          props: { value: "3", label: "componentes por pestaña" },
          style: defaultStyleFor("stat"),
        },
        "feat-stat-2": {
          id: "feat-stat-2",
          type: "stat",
          props: { value: "0 JS", label: "por defecto" },
          style: defaultStyleFor("stat"),
        },
        "feat-stat-3": {
          id: "feat-stat-3",
          type: "stat",
          props: { value: "∞", label: "anidamiento" },
          style: defaultStyleFor("stat"),
        },
        // Pestaña 3 — Empieza: alert + botón (CTA).
        "feat-tab-3": {
          id: "feat-tab-3",
          type: "tab",
          props: { label: "Empieza" },
          style: defaultStyleFor("tab"),
          children: ["feat-tab3-alert", "feat-tab3-btn"],
        },
        "feat-tab3-alert": {
          id: "feat-tab3-alert",
          type: "alert",
          props: {
            message: "Todo lo que ves aquí son nodos del árbol: se editan, mueven y estilizan como cualquier otro.",
            variant: "success",
            showIcon: true,
          },
          style: defaultStyleFor("alert"),
        },
        "feat-tab3-btn": {
          id: "feat-tab3-btn",
          type: "button",
          props: { label: "Ir a contacto", link: { kind: "internal", pageId: contactPageId } },
          style: defaultStyleFor("button"),
        },

        // --- Sección ACORDEÓN: cada sección con contenido rico --------------
        "feat-acc-section": {
          id: "feat-acc-section",
          type: "section",
          props: {},
          style: {
            base: {
              layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
              spacing: { padding: { token: "spacing.md" } },
            },
          },
          children: ["feat-acc-heading", "feat-acc-intro", "feat-accordion"],
        },
        "feat-acc-heading": {
          id: "feat-acc-heading",
          type: "text",
          props: { content: "<strong>Acordeón enriquecido</strong>" },
          style: { base: { appearance: { color: { token: "colors.text" } } } },
        },
        "feat-acc-intro": {
          id: "feat-acc-intro",
          type: "text",
          props: { content: "Cada sección aloja componentes reales, no solo texto plano." },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "feat-accordion": {
          id: "feat-accordion",
          type: "accordion",
          props: {},
          style: defaultStyleFor("accordion"),
          behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
          children: ["feat-acc-1", "feat-acc-2", "feat-acc-3"],
        },
        // Sección 1 (abierta) — texto rich + badge.
        "feat-acc-1": {
          id: "feat-acc-1",
          type: "accordion-item",
          props: { label: "¿Qué puedo poner dentro?", openByDefault: true },
          style: defaultStyleFor("accordion-item"),
          children: ["feat-acc1-text", "feat-acc1-badge"],
        },
        "feat-acc1-text": {
          id: "feat-acc1-text",
          type: "text",
          props: {
            content: "Cualquier componente: <strong>texto rich</strong>, imágenes, botones, listas o containers anidados.",
          },
          style: { base: { appearance: { color: { token: "colors.text" } } } },
        },
        "feat-acc1-badge": {
          id: "feat-acc1-badge",
          type: "badge",
          props: { label: "Children-based" },
          style: defaultStyleFor("badge"),
        },
        // Sección 2 — texto + imagen.
        "feat-acc-2": {
          id: "feat-acc-2",
          type: "accordion-item",
          props: { label: "¿Puedo anidar medios?", openByDefault: false },
          style: defaultStyleFor("accordion-item"),
          children: ["feat-acc2-text", "feat-acc2-img"],
        },
        "feat-acc2-text": {
          id: "feat-acc2-text",
          type: "text",
          props: { content: "Sí — esta imagen vive dentro de la sección del acordeón:" },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "feat-acc2-img": {
          id: "feat-acc2-img",
          type: "image",
          props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Medio anidado", objectFit: "cover" },
          style: { base: { size: { width: "100%" }, appearance: { borderRadius: { token: "radii.md" } } } },
        },
        // Sección 3 — texto + botón (CTA).
        "feat-acc-3": {
          id: "feat-acc-3",
          type: "accordion-item",
          props: { label: "¿Cómo empiezo?", openByDefault: false },
          style: defaultStyleFor("accordion-item"),
          children: ["feat-acc3-text", "feat-acc3-btn"],
        },
        "feat-acc3-text": {
          id: "feat-acc3-text",
          type: "text",
          props: { content: "Arrastra un componente desde la paleta y suéltalo dentro de una pestaña o sección." },
          style: { base: { appearance: { color: { token: "colors.text" } } } },
        },
        "feat-acc3-btn": {
          id: "feat-acc3-btn",
          type: "button",
          props: { label: "Ver inicio", link: { kind: "internal", pageId: homePageId } },
          style: defaultStyleFor("button"),
        },

        "feat-footer": {
          id: "feat-footer",
          type: "footer",
          props: {},
          style: defaultStyleFor("footer"),
          children: ["feat-footer-copyright"],
        },
        "feat-footer-copyright": {
          id: "feat-footer-copyright",
          type: "text",
          props: { content: "© Builder42 — escaparate de componentes." },
          style: {
            base: {
              size: { width: "100%" },
              spacing: { padding: "16px 0 0 0" },
              typography: { textAlign: "center", fontSize: { token: "typography.sizes.sm" } },
              appearance: {
                color: "inherit",
                borderColor: "rgba(0,0,0,0.12)",
                borderWidth: "1px 0 0 0",
                borderStyle: "solid",
              },
            },
          },
        },
      },
    },
  );
}
