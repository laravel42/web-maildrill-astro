/**
 * Form validation — runtime del OUTPUT (docs/15 §2b, docs/16 §10b). Hidrata un
 * `<form data-pb-behavior="form-validation">` con Alpine.js
 * (https://alpinejs.dev): valida cada campo descendiente en tiempo real
 * leyendo sus atributos HTML5 nativos (`required`, `type="email"`, `pattern`,
 * `minlength`/`maxlength`), muestra un mensaje de error inline y deshabilita
 * el submit mientras el form es inválido.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/` (core del editor). Solo conoce el DOM, `alpinejs` y sus
 * `options` (JSON plano, ya validadas por el `optionsSchema` del behavior).
 *
 * Progressive enhancement (docs/15 §2b.6): sin Alpine, el `<form>` sigue
 * validando con HTML5 nativo (`required`/`type`/`pattern`) al hacer submit —
 * este runtime solo AÑADE feedback en tiempo real, nunca es la única
 * validación. Los campos que no exponen validación nativa (`select` custom,
 * docs/14) quedan fuera del alcance de este MVP (docs/16 §10b): solo se
 * hidratan `<input>`/`<textarea>` reales, que es donde vive `checkValidity()`.
 */

import Alpine from "alpinejs";

export interface FormValidationOptions {
  /** Cuándo revalidar un campo tras su primera interacción. Default "blur". */
  validateOn?: "blur" | "input";
  requiredMessage?: string;
  emailMessage?: string;
  patternMessage?: string;
}

export type Cleanup = () => void;

type ValidatableField = HTMLInputElement | HTMLTextAreaElement;

const DEFAULT_REQUIRED_MESSAGE = "This field is required";
const DEFAULT_EMAIL_MESSAGE = "Enter a valid email";
const DEFAULT_PATTERN_MESSAGE = "This format is not valid";

let alpineStarted = false;

/**
 * Alpine.start() es global e idempotente-por-proceso: una sola vez por
 * página. Este behavior no declara ningún `x-data` en el markup (el HTML
 * exportado sigue siendo cero-JS por defecto, P8/P9) — arrancar Alpine solo
 * habilita que OTROS behaviors Alpine (`conditional-fields`, futuros) que
 * convivan en la misma página puedan usar directivas `x-*` sin arrancar el
 * runtime dos veces.
 */
function ensureAlpineStarted(): void {
  if (alpineStarted) return;
  alpineStarted = true;
  Alpine.start();
}

function isValidatable(el: Element): el is ValidatableField {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/** Mensaje de error específico según qué regla de validez nativa falla. */
function messageFor(field: ValidatableField, options: FormValidationOptions): string {
  const validity = field.validity;
  if (validity.valueMissing) return options.requiredMessage ?? DEFAULT_REQUIRED_MESSAGE;
  if (validity.typeMismatch || validity.patternMismatch) {
    if (field instanceof HTMLInputElement && field.type === "email") {
      return options.emailMessage ?? DEFAULT_EMAIL_MESSAGE;
    }
    return options.patternMessage ?? DEFAULT_PATTERN_MESSAGE;
  }
  return field.validationMessage || (options.patternMessage ?? DEFAULT_PATTERN_MESSAGE);
}

/** Busca (o crea) el `<span class="pb-field-error">` inmediatamente después del campo. */
function ensureErrorEl(field: ValidatableField): HTMLElement {
  const next = field.nextElementSibling;
  if (next instanceof HTMLElement && next.classList.contains("pb-field-error")) return next;
  const span = document.createElement("span");
  span.className = "pb-field-error";
  span.setAttribute("role", "alert");
  field.insertAdjacentElement("afterend", span);
  return span;
}

/**
 * Hidrata un `<form>`: valida cada `<input>`/`<textarea>` descendiente en el
 * evento configurado (`validateOn`), muestra/oculta su mensaje de error y
 * deshabilita el botón de submit mientras el form es inválido. No usa
 * componentes de Alpine (`x-data`) declarados en el HTML exportado (P8: el
 * HTML estático no lleva ningún atributo `x-*` — los agrega este `enhance` en
 * runtime, así el export sigue siendo cero-JS por defecto); usa la API
 * imperativa de Alpine (`Alpine.reactive`) para el estado de validez del
 * form, que es lo único que este behavior necesita de un framework reactivo
 * (recalcular `disabled` del submit cuando cualquier campo cambia).
 */
export function enhanceFormValidation(
  el: HTMLElement,
  options: FormValidationOptions = {},
): Cleanup | void {
  if (!(el instanceof HTMLFormElement)) return;
  ensureAlpineStarted();

  const validateOn = options.validateOn ?? "blur";
  const fields = Array.from(el.querySelectorAll<Element>("input, textarea")).filter(isValidatable);
  if (fields.length === 0) return;

  const submitButton = el.querySelector<HTMLButtonElement>('button[type="submit"]');

  // Estado de validez del form: cuántos campos tocados son inválidos ahora
  // mismo. Se recalcula de forma SINCRÓNICA en cada validación (sin pasar
  // por el scheduler reactivo de Alpine — `Alpine.reactive`/`Alpine.effect`
  // procesan efectos en un microtask, lo que introduciría un frame de
  // desfase entre "el campo ya es inválido" y "el botón ya está
  // deshabilitado", detectable incluso a ojo). El único valor real que este
  // behavior toma de Alpine es `Alpine.start()` (ver arriba): deja el
  // runtime disponible para behaviors hermanos (`conditional-fields`) que sí
  // se beneficien de `x-data` declarativo.
  let invalidCount = 0;
  const touched = new WeakSet<ValidatableField>();

  function updateSubmitState(): void {
    if (submitButton) submitButton.disabled = invalidCount > 0;
  }

  function validate(field: ValidatableField): void {
    const errorEl = ensureErrorEl(field);
    const isValid = field.checkValidity();
    const wasInvalid = errorEl.classList.contains("pb-field-error--visible");

    if (isValid) {
      errorEl.textContent = "";
      errorEl.classList.remove("pb-field-error--visible");
      field.classList.remove("pb-field--invalid");
      field.removeAttribute("aria-invalid");
      if (wasInvalid) invalidCount = Math.max(0, invalidCount - 1);
    } else {
      errorEl.textContent = messageFor(field, options);
      errorEl.classList.add("pb-field-error--visible");
      field.classList.add("pb-field--invalid");
      field.setAttribute("aria-invalid", "true");
      if (!wasInvalid) invalidCount += 1;
    }
    updateSubmitState();
  }

  const listeners: Array<{ field: ValidatableField; type: string; handler: () => void }> = [];

  function addListener(field: ValidatableField, type: string, handler: () => void): void {
    field.addEventListener(type, handler);
    listeners.push({ field, type, handler });
  }

  for (const field of fields) {
    const errorEl = ensureErrorEl(field);
    errorEl.id = errorEl.id || `${field.id || field.name}-error`;
    field.setAttribute("aria-describedby", errorEl.id);

    // Revalida en el evento configurado tras el primer touch; SIEMPRE revalida
    // en "input" una vez que el campo ya fue tocado, para que el mensaje
    // desaparezca en cuanto el usuario corrige (UX estándar de forms).
    addListener(field, "blur", () => {
      touched.add(field);
      validate(field);
    });
    if (validateOn === "input") {
      addListener(field, "input", () => {
        touched.add(field);
        validate(field);
      });
    } else {
      addListener(field, "input", () => {
        if (touched.has(field)) validate(field);
      });
    }
  }

  // Al intentar enviar: valida TODO el form de una vez (marca todos como
  // touched) y bloquea el submit nativo si algo es inválido — refuerzo del
  // `disabled` del botón para el caso de Enter/submit programático.
  function handleSubmit(event: SubmitEvent): void {
    let anyInvalid = false;
    for (const field of fields) {
      touched.add(field);
      validate(field);
      if (!field.checkValidity()) anyInvalid = true;
    }
    if (anyInvalid) event.preventDefault();
  }
  el.addEventListener("submit", handleSubmit);

  return () => {
    for (const { field, type, handler } of listeners) field.removeEventListener(type, handler);
    el.removeEventListener("submit", handleSubmit);
    if (submitButton) submitButton.disabled = false;
    for (const field of fields) {
      field.classList.remove("pb-field--invalid");
      field.removeAttribute("aria-invalid");
      const next = field.nextElementSibling;
      if (next instanceof HTMLElement && next.classList.contains("pb-field-error")) {
        next.textContent = "";
        next.classList.remove("pb-field-error--visible");
      }
    }
  };
}

// ---------------------------------------------------------------------------
// Auto-registro para el loader (docs/10 §11, `enhance.ts`)
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __pbBehaviors?: Record<string, (el: HTMLElement, options: Record<string, unknown>) => (() => void) | void>;
  }
}

if (typeof window !== "undefined") {
  window.__pbBehaviors = window.__pbBehaviors ?? {};
  window.__pbBehaviors.enhanceFormValidation = (el, options) =>
    enhanceFormValidation(el, options as FormValidationOptions);
}
