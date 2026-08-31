/**
 * Form actions — runtime de `submit-form`/`reset-form` (docs/44 §4 fila P2).
 * Un solo módulo para ambas acciones (decisión documentada en
 * `registry/actions/resetForm.ts`): localizar el `<form>` ancestro real vía
 * `el.closest("form")` y la gestión de a11y es idéntica; solo cambia el
 * método invocado sobre el form encontrado.
 *
 * A diferencia de `scroll-to`/`dismiss` (que resuelven un nodeId o el propio
 * elemento), este runtime NO necesita ningún mecanismo de "target
 * referenciado": el `<form>` es el ancestro DOM real del trigger, siempre
 * presente si `appliesTo` (`submitForm.ts`/`resetForm.ts`) ya validó — en
 * tiempo de edición — que el nodo está dentro de un `form` en el documento.
 * Si por alguna razón el form no está en el DOM exportado (estructura
 * corrupta, edición manual del HTML), es un no-op seguro.
 *
 * `requestSubmit()` (en vez de `submit()`) SÍ dispara la validación HTML5 y
 * el evento `submit` nativo — igual comportamiento que un
 * `<button type="submit">` real, a diferencia del legacy `form.submit()` que
 * los saltea.
 *
 * Degradación sin JS (P8/P9): SIN este runtime, el click no hace nada — el
 * contenido sigue visible/usable, misma limitación aceptada para el resto de
 * la Fase 4/2.
 *
 * a11y: si el trigger no es nativamente interactivo, se le agrega
 * `role="button"` (ejecuta una operación en la página actual — enviar/limpiar
 * — no navega, por eso "button" y no "link" como en `open-url`) + `tabindex="0"`
 * + teclado (Enter/Espacio) — mismo criterio que `runtime/actions/dismiss.ts`.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa de `src/builder/`.
 */

export type Cleanup = () => void;

const NATIVE_INTERACTIVE_TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

function isNativelyInteractive(el: HTMLElement): boolean {
  if (NATIVE_INTERACTIVE_TAGS.has(el.tagName)) return true;
  if (el.tagName === "A" && el.hasAttribute("href")) return true;
  return el.hasAttribute("tabindex");
}

function addSyntheticButtonRole(el: HTMLElement): boolean {
  const addedRole = !isNativelyInteractive(el);
  if (addedRole) {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
  }
  return addedRole;
}

function attachFormAction(el: HTMLElement, run: (form: HTMLFormElement) => void): Cleanup | void {
  const addedRole = addSyntheticButtonRole(el);

  const trigger = (event: Event): void => {
    const form = el.closest("form");
    if (!form) return; // sin form ancestro en el DOM: no-op seguro
    event.preventDefault();
    run(form);
  };
  const onClick = (event: Event): void => trigger(event);
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") trigger(event);
  };

  el.addEventListener("click", onClick);
  if (addedRole) el.addEventListener("keydown", onKeydown);

  return () => {
    el.removeEventListener("click", onClick);
    if (addedRole) el.removeEventListener("keydown", onKeydown);
  };
}

/** Envía el `<form>` ancestro más cercano (con validación HTML5, `requestSubmit`). */
export function enhanceSubmitForm(el: HTMLElement): Cleanup | void {
  return attachFormAction(el, (form) => form.requestSubmit());
}

/** Limpia el `<form>` ancestro más cercano (`reset()` nativo). */
export function enhanceResetForm(el: HTMLElement): Cleanup | void {
  return attachFormAction(el, (form) => form.reset());
}

// ---------------------------------------------------------------------------
// Auto-registro para el loader (docs/10 §11, `enhance.ts`) — igual criterio
// genérico que el resto de `runtime/actions/*.ts` (docs/44 §2.4). Un mismo
// módulo (`moduleId: "formActions"`) registra DOS enhancers.
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __pbBehaviors?: Record<string, (el: HTMLElement, options: Record<string, unknown>) => (() => void) | void>;
  }
}

if (typeof window !== "undefined") {
  window.__pbBehaviors = window.__pbBehaviors ?? {};
  window.__pbBehaviors.enhanceSubmitForm = (el) => enhanceSubmitForm(el);
  window.__pbBehaviors.enhanceResetForm = (el) => enhanceResetForm(el);
}
