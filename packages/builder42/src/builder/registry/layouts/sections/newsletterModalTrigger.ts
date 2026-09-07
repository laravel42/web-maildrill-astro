import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Botón que dispara un modal con formulario de newsletter (docs/37 §3.1 #7):
 * primer uso de `modal` en la galería de layouts (hueco real, docs/37 §1) —
 * interactivo, mayor riesgo. Demuestra el patrón de disparo externo (docs/20
 * §3): el botón trigger vive en la raíz (`onClick: { type: "open-modal",
 * target: <modalId> }`), el `modal` es un elemento no-visible (no ocupa
 * layout) con un `form` + `input` + `button-submit` dentro.
 */
export function buildNewsletterModalTriggerFragment(): NodeFragment {
  return {
    rootId: "newsletter-modal-root",
    nodes: {
      "newsletter-modal-root": {
        id: "newsletter-modal-root",
        type: "container",
        props: {},
        style: {
          base: { layout: { display: "flex", flexDirection: "column", alignItems: "center" }, spacing: { padding: { token: "spacing.md" } } },
        },
        children: ["newsletter-modal-trigger-btn", "newsletter-modal-dialog"],
      },
      "newsletter-modal-trigger-btn": {
        id: "newsletter-modal-trigger-btn",
        type: "button",
        props: { label: "Suscribirme al newsletter", link: { kind: "external", href: "" } },
        style: defaultStyleFor("button"),
        onClick: { type: "open-modal", target: "newsletter-modal-dialog" },
      },
      "newsletter-modal-dialog": {
        id: "newsletter-modal-dialog",
        type: "modal",
        props: { title: "Suscríbete a nuestro newsletter" },
        style: defaultStyleFor("modal"),
        behaviors: [{ type: "modal", options: { closeOnBackdrop: true, duration: 200 } }],
        children: ["newsletter-modal-form"],
      },
      "newsletter-modal-form": {
        id: "newsletter-modal-form",
        type: "form",
        props: { action: "", method: "post", noValidate: false },
        style: defaultStyleFor("form"),
        children: ["newsletter-modal-input", "newsletter-modal-submit"],
      },
      "newsletter-modal-input": {
        id: "newsletter-modal-input",
        type: "input",
        props: { name: "email", placeholder: "tucorreo@ejemplo.com", type: "email", required: true, disabled: false },
        style: defaultStyleFor("input"),
      },
      "newsletter-modal-submit": {
        id: "newsletter-modal-submit",
        type: "button-submit",
        props: { label: "Suscribirme", disabled: false },
        style: defaultStyleFor("button-submit"),
      },
    },
  };
}
