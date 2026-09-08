import type { NodeFragment } from "../../../model/tree";
import { defaultStyleFor } from "../../../store/exampleSite/styleFor";

/**
 * Botón que dispara un modal con formulario de suscripción a novedades del
 * producto (docs/37 §3.1 #7): primer uso de `modal` en la galería de layouts
 * (hueco real, docs/37 §1) — interactivo, mayor riesgo. Demuestra el patrón
 * de disparo externo (docs/20 §3): el botón trigger vive en la raíz
 * (`onClick: { type: "open-modal", target: <modalId> }`), el `modal` es un
 * elemento no-visible (no ocupa layout) con un `form` + `input` +
 * `button-submit` dentro.
 *
 * Pulido de diseño (ronda de mejora visual del catálogo): antes el trigger
 * era un `button` plano (`defaultStyleFor("button")`, padding `8px 16px`,
 * sin sombra) suelto a mitad del canvas — se sentía como un botón perdido, no
 * como una sección con intención propia. Ahora:
 *   - un texto de apoyo (`newsletter-modal-eyebrow`) arriba del botón
 *     ("Nuevas funciones cada mes") le da contexto a la sección antes de
 *     pedir el clic — mismo rol que un eyebrow/kicker sobre un CTA.
 *   - el botón gana `appearance.boxShadow` con blur real (mismo patrón
 *     `cardShadow` de `features3Col.ts`/`teamGrid.ts` — offset+blur+spread
 *     negativo con el tinte de `colors.primary`, no el `shadows.sm` plano) +
 *     padding vertical/horizontal más generoso (`14px 28px` en vez de
 *     `8px 16px`) + `radii.md` explícito, para que se lea como una llamada a
 *     la acción real, no un link con fondo.
 *   - `states.hover` sube la sombra un poco (mismo criterio que
 *     `ctaBanner`/`agency-hero-cta`: feedback de interactividad sin mover el
 *     layout — sin `transform`, el modelo de estilos no lo soporta).
 *
 * Responsive (mobile angosto 320-375px): el padding horizontal generoso
 * (`28px`) se definió pensando en 375px+; en `base` (320px) se reduce a
 * `20px` vía override inverso — en realidad `base` YA es el valor angosto
 * (`20px`) y `sm` sube a `28px`, para que el botón no se vea deforme
 * (demasiado ancho de "aire" a los lados del texto) en el viewport más
 * angosto soportado. El `container` raíz mantiene su padding original.
 */
export function buildNewsletterModalTriggerFragment(): NodeFragment {
  const buttonShadow = "0 12px 24px -8px rgba(37, 99, 235, 0.35), 0 3px 8px -2px rgba(37, 99, 235, 0.2)";
  const buttonShadowHover = "0 16px 32px -10px rgba(37, 99, 235, 0.45), 0 4px 10px -2px rgba(37, 99, 235, 0.28)";
  const defaultButtonStyle = defaultStyleFor("button");

  return {
    rootId: "newsletter-modal-root",
    nodes: {
      "newsletter-modal-root": {
        id: "newsletter-modal-root",
        type: "container",
        props: {},
        style: {
          base: {
            layout: { display: "flex", flexDirection: "column", alignItems: "center", gap: { token: "spacing.xs" } },
            spacing: { padding: { token: "spacing.md" } },
          },
        },
        children: ["newsletter-modal-eyebrow", "newsletter-modal-trigger-btn", "newsletter-modal-dialog"],
      },
      "newsletter-modal-eyebrow": {
        id: "newsletter-modal-eyebrow",
        type: "text",
        props: { content: "Nuevas funciones cada mes" },
        style: {
          base: {
            typography: { fontSize: { token: "typography.sizes.sm" }, textAlign: "center" },
            appearance: { color: { token: "colors.muted" } },
          },
        },
      },
      "newsletter-modal-trigger-btn": {
        id: "newsletter-modal-trigger-btn",
        type: "button",
        props: { label: "Entérate de nuevas funciones", link: { kind: "external", href: "" } },
        style: {
          base: {
            ...defaultButtonStyle.base,
            spacing: { padding: "14px 20px" },
            appearance: {
              ...defaultButtonStyle.base.appearance,
              borderRadius: { token: "radii.md" },
              boxShadow: buttonShadow,
            },
          },
          overrides: {
            sm: { spacing: { padding: "14px 28px" } },
          },
          states: {
            hover: { appearance: { boxShadow: buttonShadowHover } },
          },
        },
        onClick: { type: "open-modal", target: "newsletter-modal-dialog" },
      },
      "newsletter-modal-dialog": {
        id: "newsletter-modal-dialog",
        type: "modal",
        props: { title: "Entérate de las novedades de Maildrill" },
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
        props: { label: "Avísame de novedades", disabled: false },
        style: defaultStyleFor("button-submit"),
      },
    },
  };
}
