/**
 * Form validation — behavior tier 2b (docs/15 §2b, docs/16 §10b). En 10.b es
 * solo la DECLARACIÓN: schema de opciones para el Inspector + metadata del
 * runtime (mismo patrón que `carousel`, referencia para deps npm — docs/10
 * §8.3). El `enhanceFormValidation` real (Alpine.js) llega en
 * `runtime/behaviors/formValidation.ts`.
 *
 * Aplica solo a nodos `form` (docs/16 §10b): valida sus campos descendientes
 * en tiempo real, sin tocar el submit nativo HTML5 (progressive enhancement,
 * P8/P9 — sin JS, el `<form>` sigue validando con `required`/`type`/
 * `pattern`/`minlength` nativos).
 */

import type { BehaviorDefinition } from "../types";

export const formValidationBehavior: BehaviorDefinition = {
  type: "form-validation",
  label: "Validación en tiempo real (Alpine)",
  category: "interactive",
  appliesTo: (node) => node.type === "form",
  defaultOptions: {
    validateOn: "blur",
    requiredMessage: "This field is required",
    emailMessage: "Enter a valid email",
    patternMessage: "This format is not valid",
  },
  optionsSchema: {
    fields: [
      {
        key: "validateOn",
        label: "Validar al",
        control: "select",
        group: "Validación",
        options: [
          { label: "Perder el foco (blur)", value: "blur" },
          { label: "Cada cambio (input)", value: "input" },
        ],
      },
      {
        key: "requiredMessage",
        label: "Mensaje: campo requerido",
        control: "text",
        group: "Mensajes",
        translatable: true,
      },
      {
        key: "emailMessage",
        label: "Mensaje: email inválido",
        control: "text",
        group: "Mensajes",
        translatable: true,
      },
      {
        key: "patternMessage",
        label: "Mensaje: formato inválido",
        control: "text",
        group: "Mensajes",
        translatable: true,
      },
    ],
  },
  runtime: {
    moduleId: "formValidation",
    npm: { pkg: "alpinejs", version: "3.14.9" },
    enhance: "enhanceFormValidation",
    // CSS mínimo del mensaje de error inyectado en runtime (docs/16 §10.3):
    // reutiliza los tokens semánticos `colors.error.*` ya declarados en
    // `BASE_TOKENS` (mismo criterio que `input`/`textarea`/`select`). Solo se
    // emite en el export si el behavior está en uso (tree-shake por uso).
    css: [
      ".pb-field-error { display: none; margin-top: 0.25rem; font-size: 0.8125rem; color: var(--colors-error-default, #dc2626); }",
      ".pb-field-error--visible { display: block; }",
      ".pb-field--invalid { border-color: var(--colors-error-default, #dc2626) !important; }",
    ].join("\n"),
    loadPreview: async () =>
      (await import("../../../runtime/behaviors/formValidation")).enhanceFormValidation,
  },
};
