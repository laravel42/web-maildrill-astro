import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Features organizados en pestañas (docs/37 §3.1 #6): primer uso de `tabs` en
 * la galería de layouts (hueco real, docs/37 §1) — interactivo, mayor riesgo.
 * Modelo composite children-based (docs/23): cada pestaña es un nodo `tab`
 * hijo (`slots.itemType`), con `props.label` = título y `children` = panel.
 *
 * Pulido (docs/builder-sections-plan.md #10): las 3 pestañas usaban
 * `source: { kind: "asset", assetId: "asset-demo" }` (assetId ficticio que
 * no existe en la librería de medios). Se reemplazan por
 * `source: { kind: "url", url: "<unsplash-url>" }` con una foto temática
 * distinta por pestaña — dashboard/workflow para Automatización,
 * analytics/gráficas en pantalla para Reportes, código/conexiones API para
 * Integraciones — cada una con `alt` descriptivo.
 *
 * Pulido de diseño (ronda de mejora visual, tabsFeatures/logoCloudStrip): el
 * `section` raíz flotaba sin separación del resto de la página (mismo fondo,
 * sin borde ni sombra). Se añade un contenedor "card grande"
 * (`tabs-features-card`, `type: "container"`) entre el `section` y el título/
 * `tabs`: `size.maxWidth` centrado (`sizes.container` = 1200px vía
 * `margin: "0 auto"`) + `boxShadow` compuesto con blur real (mismo patrón
 * `cardShadow` de `features3Col.ts`/`teamGrid.ts` — offset+blur+spread
 * negativo, no el `shadows.sm` casi imperceptible) + `radii.lg` + fondo
 * `colors.surface.default`. La sombra vive en este wrapper, NO en el nodo
 * `tabs`: `tabsDefinition.defaultStyle` (`registry/components/Tabs.tsx`,
 * `TABS_DEFAULT_STYLE`) no declara `boxShadow` propio — solo `border-bottom`
 * en `.pb-tabs__list` vía `TABS_CSS` — así que no hay sombra que duplicar; el
 * `tabs` sigue con su `defaultStyleFor("tabs")` intacto, ahora enmarcado por
 * la card.
 *
 * El título de sección sube de tipografía default (`~16px`, se perdía como
 * cualquier párrafo) al mismo patrón `clamp()` fluido de `hero`/`ctaBanner`
 * (`fontSize: "clamp(...)"` + `fontWeight: bold` + `lineHeight` ajustado): no
 * hay token `typography.sizes.xl`/`2xl` en `BASE_TOKENS` (solo
 * `sm`/`base`/`lg`), así que la jerarquía se logra con un tamaño fluido
 * explícito, igual que el título de `cta-banner`.
 *
 * Responsive (mobile angosto 320-375px): el padding de la card y el `clamp`
 * del título arrancan pequeños en `base` y solo crecen desde `sm`/`md`
 * (`DEFAULT_BREAKPOINTS`, `builder/model/types.ts`) para que en 375px el
 * título no desborde su `maxWidth` en ch y la card no quede sin aire lateral.
 */
export function buildTabsFeaturesFragment(): NodeFragment {
  const cardShadow = "0 20px 40px -12px rgba(15, 23, 42, 0.16), 0 4px 10px -6px rgba(15, 23, 42, 0.08)";

  return {
    rootId: "tabs-features-root",
    nodes: {
      "tabs-features-root": {
        id: "tabs-features-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center" },
            spacing: { padding: { token: "spacing.md" } },
          },
        },
        children: ["tabs-features-card"],
      },
      "tabs-features-card": {
        id: "tabs-features-card",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.md" } },
            size: { width: "100%", maxWidth: { token: "sizes.container" } },
            appearance: {
              background: { token: "colors.surface.default" },
              borderRadius: { token: "radii.lg" },
              boxShadow: cardShadow,
            },
          },
          overrides: {
            sm: { spacing: { padding: { token: "spacing.lg" } } },
            md: { spacing: { padding: "40px" } },
          },
        },
        children: ["tabs-features-title", "tabs-features-tabs"],
      },
      "tabs-features-title": {
        id: "tabs-features-title",
        type: "text",
        props: { content: "<strong>Everything in your plan</strong>" },
        style: {
          base: {
            typography: {
              fontSize: "clamp(1.375rem, 5vw, 1.75rem)",
              fontWeight: { token: "typography.weights.bold" },
              lineHeight: { token: "typography.lineHeights.tight" },
            },
            appearance: { color: { token: "colors.text" } },
          },
          overrides: {
            md: { typography: { fontSize: "clamp(1.75rem, 2.5vw, 2.25rem)" } },
          },
        },
      },
      "tabs-features-tabs": {
        id: "tabs-features-tabs",
        type: "tabs",
        props: {},
        style: defaultStyleFor("tabs"),
        behaviors: [{ type: "tabs", options: { duration: 220 } }],
        children: ["tabs-features-tab-1", "tabs-features-tab-2", "tabs-features-tab-3"],
      },
      "tabs-features-tab-1": {
        id: "tabs-features-tab-1",
        type: "tab",
        props: { label: "Automation" },
        style: defaultStyleFor("tab"),
        children: ["tabs-features-tab-1-img", "tabs-features-tab-1-text"],
      },
      "tabs-features-tab-1-img": {
        id: "tabs-features-tab-1-img",
        type: "image",
        props: {
          source: {
            kind: "url",
            url: "https://images.unsplash.com/photo-1518186285589-2f7649de83e0?w=800&q=80&auto=format&fit=crop",
          },
          alt: "Messaging automation panel on a screen",
          objectFit: "cover",
        },
        style: { base: { size: { width: "100%" }, appearance: { borderRadius: { token: "radii.md" } } } },
      },
      "tabs-features-tab-1-text": {
        id: "tabs-features-tab-1-text",
        type: "text",
        props: { content: "Rules that run themselves: less repetitive work for your team." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "tabs-features-tab-2": {
        id: "tabs-features-tab-2",
        type: "tab",
        props: { label: "Reports" },
        style: defaultStyleFor("tab"),
        children: ["tabs-features-tab-2-img", "tabs-features-tab-2-text"],
      },
      "tabs-features-tab-2-img": {
        id: "tabs-features-tab-2-img",
        type: "image",
        props: {
          source: {
            kind: "url",
            url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80&auto=format&fit=crop",
          },
          alt: "Deliverability analytics charts on a dashboard",
          objectFit: "cover",
        },
        style: { base: { size: { width: "100%" }, appearance: { borderRadius: { token: "radii.md" } } } },
      },
      "tabs-features-tab-2-text": {
        id: "tabs-features-tab-2-text",
        type: "text",
        props: { content: "Real-time metrics, exportable to CSV in one click." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "tabs-features-tab-3": {
        id: "tabs-features-tab-3",
        type: "tab",
        props: { label: "Integrations" },
        style: defaultStyleFor("tab"),
        children: ["tabs-features-tab-3-img", "tabs-features-tab-3-text"],
      },
      "tabs-features-tab-3-img": {
        id: "tabs-features-tab-3-img",
        type: "image",
        props: {
          source: {
            kind: "url",
            url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&q=80&auto=format&fit=crop",
          },
          alt: "API integration code shown in an editor",
          objectFit: "cover",
        },
        style: { base: { size: { width: "100%" }, appearance: { borderRadius: { token: "radii.md" } } } },
      },
      "tabs-features-tab-3-text": {
        id: "tabs-features-tab-3-text",
        type: "text",
        props: { content: "Connect your favorite tools without writing code." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
    },
  };
}
