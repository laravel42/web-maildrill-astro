import type { BuilderPage } from "../../model/types";
import { createPage } from "../../model/site";
import { defaultStyleFor } from "./styleFor";

// Añade una segunda página vacía ("Acerca de") para demostrar el multipágina.
// Página "Acerca de": navbar + hero + stats + equipo (cards+avatar) + tabs
// (historia/misión/valores, con contenido real por panel) + quote + logo
// cloud (prueba social) + modal de contacto rápido. Usa componentes del
// Bloque D (navbar, tabs, modal), cero-JS (hero, card, avatar, badge, stat,
// quote, logo-cloud, divider, icon) además de los base (container, text,
// image, button). Todos con su `defaultStyle`/`defaultProps` de fábrica —
// sin overrides de estilo manuales, solo estructura (containers de layout).
export function createAboutPage(): BuilderPage {
  return createPage(
    { title: "Acerca de", slug: "about" },
    {
      rootId: "about-root",
      meta: { version: 1 },
      nodes: {
        "about-root": {
          id: "about-root",
          type: "container",
          props: {},
          style: {
            base: {
              layout: { display: "flex", flexDirection: "column", alignItems: "stretch" },
              appearance: { background: { token: "colors.surface.alt" } },
            },
          },
          children: ["about-wrap"],
        },
        // Contenedor centrado con ancho máximo tokenizado (mismo patrón que la
        // home): acota el contenido a `sizes.container` y lo centra, en vez de
        // dejar navbar/hero/tabs expandirse a todo el ancho del viewport.
        "about-wrap": {
          id: "about-wrap",
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
          children: [
            "about-navbar",
            "about-hero",
            "about-stats",
            "about-team",
            "about-tabs-section",
            "about-quote",
            "about-logo-cloud",
            "about-modal-trigger",
            "about-modal",
            "about-footer",
          ],
        },
        "about-navbar": {
          id: "about-navbar",
          type: "navbar",
          // Sin `links`: se generan de `ctx.pagesInfo` (docs/16 §12.4 rework).
          props: { brand: "Builder42", hiddenPageIds: [] },
          style: defaultStyleFor("navbar"),
          behaviors: [{ type: "navbar", options: { duration: 240 } }],
        },
        "about-hero": {
          id: "about-hero",
          type: "hero",
          props: {},
          style: defaultStyleFor("hero"),
          children: ["about-hero-badge", "about-hero-title", "about-hero-subtitle", "about-hero-cta"],
        },
        "about-hero-badge": {
          id: "about-hero-badge",
          type: "badge",
          props: { label: "Desde 2026" },
          style: defaultStyleFor("badge"),
        },
        "about-hero-title": {
          id: "about-hero-title",
          type: "text",
          props: { content: "<strong>Sobre Builder42</strong>" },
          style: defaultStyleFor("text"),
        },
        "about-hero-subtitle": {
          id: "about-hero-subtitle",
          type: "text",
          props: { content: "Un equipo pequeño construyendo un page builder que exporta HTML y CSS de verdad." },
          style: defaultStyleFor("text"),
        },
        "about-hero-cta": {
          id: "about-hero-cta",
          type: "button",
          props: { label: "Contáctanos", link: { kind: "internal", pageId: "contact" } },
          style: defaultStyleFor("button"),
        },
        // --- Stats: 3 KPIs con icono ----------------------------------------
        "about-stats": {
          id: "about-stats",
          type: "section",
          props: {},
          style: {
            base: {
              layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
              spacing: { padding: { token: "spacing.md" } },
            },
            overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
          },
          children: ["about-stats-1", "about-stats-2", "about-stats-3"],
        },
        "about-stats-1": {
          id: "about-stats-1",
          type: "container",
          props: {},
          style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.xs" } } } },
          children: ["about-stats-1-icon", "about-stats-1-stat"],
        },
        "about-stats-1-icon": {
          id: "about-stats-1-icon",
          type: "icon",
          props: { name: "Users", title: "" },
          style: defaultStyleFor("icon"),
        },
        "about-stats-1-stat": {
          id: "about-stats-1-stat",
          type: "stat",
          props: { value: "3", label: "personas en el equipo" },
          style: defaultStyleFor("stat"),
        },
        "about-stats-2": {
          id: "about-stats-2",
          type: "container",
          props: {},
          style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.xs" } } } },
          children: ["about-stats-2-icon", "about-stats-2-stat"],
        },
        "about-stats-2-icon": {
          id: "about-stats-2-icon",
          type: "icon",
          props: { name: "Code", title: "" },
          style: defaultStyleFor("icon"),
        },
        "about-stats-2-stat": {
          id: "about-stats-2-stat",
          type: "stat",
          props: { value: "100%", label: "open source" },
          style: defaultStyleFor("stat"),
        },
        "about-stats-3": {
          id: "about-stats-3",
          type: "container",
          props: {},
          style: { base: { layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.xs" } } } },
          children: ["about-stats-3-icon", "about-stats-3-stat"],
        },
        "about-stats-3-icon": {
          id: "about-stats-3-icon",
          type: "icon",
          props: { name: "Rocket", title: "" },
          style: defaultStyleFor("icon"),
        },
        "about-stats-3-stat": {
          id: "about-stats-3-stat",
          type: "stat",
          props: { value: "2026", label: "año de lanzamiento" },
          style: defaultStyleFor("stat"),
        },
        // --- Equipo: 3 cards con avatar + nombre + rol ----------------------
        "about-team": {
          id: "about-team",
          type: "section",
          props: {},
          style: {
            base: {
              layout: { display: "grid", gridTemplateColumns: "1fr", gap: { token: "spacing.md" } },
              spacing: { padding: { token: "spacing.md" } },
            },
            overrides: { md: { layout: { gridTemplateColumns: "repeat(3, 1fr)" } } },
          },
          children: ["about-card-1", "about-card-2", "about-card-3"],
        },
        "about-card-1": {
          id: "about-card-1",
          type: "card",
          props: {},
          style: defaultStyleFor("card"),
          children: ["about-avatar-1", "about-name-1", "about-role-1"],
        },
        "about-avatar-1": {
          id: "about-avatar-1",
          type: "avatar",
          props: { source: { kind: "url", url: "" }, alt: "", initials: "JC" },
          style: defaultStyleFor("avatar"),
        },
        "about-name-1": {
          id: "about-name-1",
          type: "text",
          props: { content: "<strong>Jose Cortez</strong>" },
          style: { base: { appearance: { color: { token: "colors.text" } } } },
        },
        "about-role-1": {
          id: "about-role-1",
          type: "text",
          props: { content: "Fundador &amp; desarrollo" },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "about-card-2": {
          id: "about-card-2",
          type: "card",
          props: {},
          style: defaultStyleFor("card"),
          children: ["about-avatar-2", "about-name-2", "about-role-2"],
        },
        "about-avatar-2": {
          id: "about-avatar-2",
          type: "avatar",
          props: { source: { kind: "url", url: "" }, alt: "", initials: "AL" },
          style: defaultStyleFor("avatar"),
        },
        "about-name-2": {
          id: "about-name-2",
          type: "text",
          props: { content: "<strong>Ana López</strong>" },
          style: { base: { appearance: { color: { token: "colors.text" } } } },
        },
        "about-role-2": {
          id: "about-role-2",
          type: "text",
          props: { content: "Diseño de producto" },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "about-card-3": {
          id: "about-card-3",
          type: "card",
          props: {},
          style: defaultStyleFor("card"),
          children: ["about-avatar-3", "about-name-3", "about-role-3"],
        },
        "about-avatar-3": {
          id: "about-avatar-3",
          type: "avatar",
          props: { source: { kind: "url", url: "" }, alt: "", initials: "MR" },
          style: defaultStyleFor("avatar"),
        },
        "about-name-3": {
          id: "about-name-3",
          type: "text",
          props: { content: "<strong>Marco Rossi</strong>" },
          style: { base: { appearance: { color: { token: "colors.text" } } } },
        },
        "about-role-3": {
          id: "about-role-3",
          type: "text",
          props: { content: "Soporte &amp; comunidad" },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        // --- Tabs: historia / misión / valores, con contenido REAL por panel
        // (modelo composite children-based, docs/23 — NO `props.items`: ese
        // formato es legado y el render de `Tabs` lo ignora silenciosamente,
        // ver AccordionItem/Tab. Corregido respecto a la versión anterior de
        // esta página, que quedaba con pestañas vacías).
        "about-tabs-section": {
          id: "about-tabs-section",
          type: "section",
          props: {},
          style: {
            base: { layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } }, spacing: { padding: { token: "spacing.md" } } },
          },
          children: ["about-tabs"],
        },
        "about-tabs": {
          id: "about-tabs",
          type: "tabs",
          props: {},
          style: defaultStyleFor("tabs"),
          behaviors: [{ type: "tabs", options: { duration: 220 } }],
          children: ["about-tab-history", "about-tab-mission", "about-tab-values"],
        },
        "about-tab-history": {
          id: "about-tab-history",
          type: "tab",
          props: { label: "Historia" },
          style: defaultStyleFor("tab"),
          children: ["about-tab-history-text"],
        },
        "about-tab-history-text": {
          id: "about-tab-history-text",
          type: "text",
          props: { content: "Empezamos como un experimento de fin de semana: ¿un page builder cuya única fuente de verdad fuera un JSON normalizado?" },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "about-tab-mission": {
          id: "about-tab-mission",
          type: "tab",
          props: { label: "Misión" },
          style: defaultStyleFor("tab"),
          children: ["about-tab-mission-text"],
        },
        "about-tab-mission-text": {
          id: "about-tab-mission-text",
          type: "text",
          props: { content: "Que cualquiera pueda publicar un sitio rápido, accesible y sin runtime innecesario." },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "about-tab-values": {
          id: "about-tab-values",
          type: "tab",
          props: { label: "Valores" },
          style: defaultStyleFor("tab"),
          children: ["about-tab-values-text", "about-tab-values-divider", "about-tab-values-badge"],
        },
        "about-tab-values-text": {
          id: "about-tab-values-text",
          type: "text",
          props: { content: "JSON como fuente de verdad, cero-JS por defecto y componentes accesibles desde el primer día." },
          style: { base: { appearance: { color: { token: "colors.muted" } } } },
        },
        "about-tab-values-divider": {
          id: "about-tab-values-divider",
          type: "divider",
          props: {},
          style: defaultStyleFor("divider"),
        },
        "about-tab-values-badge": {
          id: "about-tab-values-badge",
          type: "badge",
          props: { label: "Cero-JS por defecto" },
          style: defaultStyleFor("badge"),
        },
        // --- Quote: cita destacada -------------------------------------------
        "about-quote": {
          id: "about-quote",
          type: "quote",
          props: {
            content: "El mejor código es el que no tienes que mantener.",
            attribution: "Principio de diseño del equipo",
          },
          style: defaultStyleFor("quote"),
        },
        // --- Logo cloud: prueba social ---------------------------------------
        "about-logo-cloud": {
          id: "about-logo-cloud",
          type: "logo-cloud",
          props: {},
          style: defaultStyleFor("logo-cloud"),
          children: ["about-logo-1", "about-logo-2", "about-logo-3"],
        },
        "about-logo-1": {
          id: "about-logo-1",
          type: "image",
          props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Cliente 1", objectFit: "contain" },
          style: { base: { size: { width: "120px" } } },
        },
        "about-logo-2": {
          id: "about-logo-2",
          type: "image",
          props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Cliente 2", objectFit: "contain" },
          style: { base: { size: { width: "120px" } } },
        },
        "about-logo-3": {
          id: "about-logo-3",
          type: "image",
          props: { source: { kind: "asset", assetId: "asset-demo" }, alt: "Cliente 3", objectFit: "contain" },
          style: { base: { size: { width: "120px" } } },
        },
        // --- Modal de contacto rápido (elemento no-visible, docs/20) --------
        "about-modal-trigger": {
          id: "about-modal-trigger",
          type: "button",
          props: { label: "Hablemos", link: { kind: "external", href: "#" } },
          style: defaultStyleFor("button"),
          onClick: { type: "open-modal", target: "about-modal" },
        },
        "about-modal": {
          id: "about-modal",
          type: "modal",
          props: { title: "Escríbenos" },
          style: defaultStyleFor("modal"),
          behaviors: [{ type: "modal", options: { closeOnBackdrop: true, duration: 200 } }],
          children: ["about-modal-text"],
        },
        "about-modal-text": {
          id: "about-modal-text",
          type: "text",
          props: { content: "Visita la página de contacto para escribirnos directamente." },
          style: defaultStyleFor("text"),
        },
        "about-footer": {
          id: "about-footer",
          type: "footer",
          props: {},
          style: defaultStyleFor("footer"),
          children: ["about-footer-social", "about-footer-copyright"],
        },
        "about-footer-social": {
          id: "about-footer-social",
          type: "social-links",
          props: {},
          style: defaultStyleFor("social-links"),
        },
        "about-footer-copyright": {
          id: "about-footer-copyright",
          type: "text",
          props: { content: "© Builder42 — página de ejemplo." },
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
