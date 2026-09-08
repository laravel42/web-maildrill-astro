import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * FAQ standalone reutilizable (docs/37 §3.1 #3): antes solo existía embebido
 * dentro de `example-home` (`store/exampleSite/home/content.ts`), sin una
 * entrada propia en `layoutRegistry`. Preguntas propias, distintas de las de
 * `example-home` (sin duplicar contenido, docs/16 §13.1). Modelo composite
 * children-based (docs/23): cada pregunta es un nodo `accordion-item` hijo,
 * no `props.items` (ese formato es legado, ver `Accordion.tsx`/`AccordionItem.tsx`).
 * Preguntas reales de producto de mensajería multicanal (canales, deliverability,
 * límites de envío).
 *
 * Pulido de diseño (ronda de mejora visual del catálogo): la sección era solo
 * un título + `accordion` plano, sin contenedor visual propio (sin sombra, sin
 * límite de ancho legible) — a todo el ancho del `section` se sentía como una
 * lista suelta, no como un bloque de contenido. Ahora:
 *   - se inserta una "card" (`faq-accordion-card`, `type: "container"`) entre
 *     el `section` y el título/`accordion`: `size.maxWidth: "68ch"` +
 *     `spacing.margin: "0 auto"` (no se estira a todo el ancho en pantallas
 *     grandes — mismo criterio de "ancho de lectura" que `quoteStrip`/
 *     `aboutSplit`) + `boxShadow` compuesto con blur real (mismo patrón
 *     `cardShadow` de `features3Col.ts`/`teamGrid.ts`/`tabsFeatures.ts` —
 *     offset+blur+spread negativo, no el `shadows.sm` casi imperceptible) +
 *     `radii.lg` + fondo `colors.surface.default`.
 *   - el título sube de tipografía default (`~16px`, se perdía como un
 *     párrafo más) al mismo patrón `clamp()` fluido de `hero`/`ctaBanner`/
 *     `tabsFeatures` (no hay token `typography.sizes.xl`/`2xl` en
 *     `BASE_TOKENS`, solo `sm`/`base`/`lg` — la jerarquía se logra con un
 *     tamaño fluido explícito + peso bold).
 *   - cada `accordion-item` gana `spacing.padding` propio (aplica al
 *     `<details>` raíz del item, docs/23 — separa visualmente una pregunta de
 *     la siguiente además del `border-bottom` que ya trae `ACCORDION_CSS`) en
 *     vez de depender solo del padding fijo (`14px 4px`/`0 4px 16px`) del CSS
 *     estático compartido de `Accordion.tsx`.
 *
 * Responsive (mobile angosto 320-375px): el padding de la card y el `clamp`
 * del título arrancan pequeños en `base` y solo crecen desde `sm`/`md`
 * (`DEFAULT_BREAKPOINTS`, `builder/model/types.ts`), y el padding extra de
 * cada `accordion-item` es modesto (`4px 0`) para no desperdiciar ancho útil
 * en 375px donde cada pregunta ya compite por espacio horizontal.
 */
export function buildFaqAccordionFragment(): NodeFragment {
  const cardShadow = "0 20px 40px -12px rgba(15, 23, 42, 0.16), 0 4px 10px -6px rgba(15, 23, 42, 0.08)";
  const itemStyle = {
    base: {
      ...defaultStyleFor("accordion-item").base,
      spacing: { padding: "4px 0" },
    },
  };

  return {
    rootId: "faq-accordion-root",
    nodes: {
      "faq-accordion-root": {
        id: "faq-accordion-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center" },
            spacing: { padding: { token: "spacing.md" } },
          },
        },
        children: ["faq-accordion-card"],
      },
      "faq-accordion-card": {
        id: "faq-accordion-card",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.md" }, margin: "0 auto" },
            size: { width: "100%", maxWidth: "68ch" },
            appearance: {
              background: { token: "colors.surface.default" },
              borderRadius: { token: "radii.lg" },
              boxShadow: cardShadow,
            },
          },
          overrides: {
            sm: { spacing: { padding: { token: "spacing.lg" }, margin: "0 auto" } },
            md: { spacing: { padding: "40px", margin: "0 auto" } },
          },
        },
        children: ["faq-accordion-title", "faq-accordion-list"],
      },
      "faq-accordion-title": {
        id: "faq-accordion-title",
        type: "text",
        props: { content: "<strong>Todo lo que necesitas saber sobre Maildrill</strong>" },
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
      "faq-accordion-list": {
        id: "faq-accordion-list",
        type: "accordion",
        props: {},
        style: defaultStyleFor("accordion"),
        behaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
        children: ["faq-accordion-item-1", "faq-accordion-item-2", "faq-accordion-item-3"],
      },
      "faq-accordion-item-1": {
        id: "faq-accordion-item-1",
        type: "accordion-item",
        props: { label: "¿Qué canales soporta Maildrill?", openByDefault: true },
        style: itemStyle,
        children: ["faq-accordion-item-1-body"],
      },
      "faq-accordion-item-1-body": {
        id: "faq-accordion-item-1-body",
        type: "text",
        props: { content: "Email, SMS, WhatsApp y voz, todo desde un solo workspace y con la misma lista de contactos." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "faq-accordion-item-2": {
        id: "faq-accordion-item-2",
        type: "accordion-item",
        props: { label: "¿Cuál es la tasa de entrega (deliverability)?", openByDefault: false },
        style: itemStyle,
        children: ["faq-accordion-item-2-body"],
      },
      "faq-accordion-item-2-body": {
        id: "faq-accordion-item-2-body",
        type: "text",
        props: { content: "Mantenemos un 99.9% de entrega gracias a IPs cuidadas, autenticación SPF/DKIM/DMARC y monitoreo en tiempo real." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "faq-accordion-item-3": {
        id: "faq-accordion-item-3",
        type: "accordion-item",
        props: { label: "¿Puedo migrar mis contactos desde otro proveedor?", openByDefault: false },
        style: itemStyle,
        children: ["faq-accordion-item-3-body"],
      },
      "faq-accordion-item-3-body": {
        id: "faq-accordion-item-3-body",
        type: "text",
        props: { content: "Sí, importa tus listas por CSV o API y empieza a enviar en minutos, sin perder tu historial de contactos." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
    },
  };
}
