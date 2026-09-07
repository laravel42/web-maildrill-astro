import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * FAQ standalone reutilizable (docs/37 §3.1 #3): antes solo existía embebido
 * dentro de `example-home` (`store/exampleSite/home/content.ts`), sin una
 * entrada propia en `layoutRegistry`. Preguntas propias, distintas de las de
 * `example-home` (sin duplicar contenido, docs/16 §13.1). Modelo composite
 * children-based (docs/23): cada pregunta es un nodo `accordion-item` hijo,
 * no `props.items` (ese formato es legado, ver `Accordion.tsx`/`AccordionItem.tsx`).
 */
export function buildFaqAccordionFragment(): NodeFragment {
  return {
    rootId: "faq-accordion-root",
    nodes: {
      "faq-accordion-root": {
        id: "faq-accordion-root",
        type: "section",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.sm" } },
            spacing: { padding: { token: "spacing.md" } },
          },
        },
        children: ["faq-accordion-title", "faq-accordion-list"],
      },
      "faq-accordion-title": {
        id: "faq-accordion-title",
        type: "text",
        props: { content: "<strong>Todo lo que necesitas saber</strong>" },
        style: { base: { appearance: { color: { token: "colors.text" } } } },
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
        props: { label: "¿Cómo cancelo mi suscripción?", openByDefault: true },
        style: defaultStyleFor("accordion-item"),
        children: ["faq-accordion-item-1-body"],
      },
      "faq-accordion-item-1-body": {
        id: "faq-accordion-item-1-body",
        type: "text",
        props: { content: "Desde ajustes de cuenta, en cualquier momento, sin llamadas ni correos." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "faq-accordion-item-2": {
        id: "faq-accordion-item-2",
        type: "accordion-item",
        props: { label: "¿Ofrecen descuento anual?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["faq-accordion-item-2-body"],
      },
      "faq-accordion-item-2-body": {
        id: "faq-accordion-item-2-body",
        type: "text",
        props: { content: "Sí, el plan anual tiene un 20% de descuento frente al mensual." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
      "faq-accordion-item-3": {
        id: "faq-accordion-item-3",
        type: "accordion-item",
        props: { label: "¿Hay periodo de prueba?", openByDefault: false },
        style: defaultStyleFor("accordion-item"),
        children: ["faq-accordion-item-3-body"],
      },
      "faq-accordion-item-3-body": {
        id: "faq-accordion-item-3-body",
        type: "text",
        props: { content: "Sí, 14 días gratis en cualquier plan, sin tarjeta de crédito." },
        style: { base: { appearance: { color: { token: "colors.muted" } } } },
      },
    },
  };
}
