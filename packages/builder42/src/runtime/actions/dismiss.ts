/**
 * Dismiss — runtime de la acción `dismiss` (docs/44 §4 fila P1). Oculta el
 * propio elemento o su padre directo al hacer click; opcionalmente recuerda
 * el descarte en `localStorage` para no volver a mostrarlo.
 *
 * Degradación sin JS (P8/P9, criterio §7.4): SIN este runtime, el elemento
 * marcado con `data-pb-dismiss` sigue siendo visible — el export NUNCA emite
 * `display:none` ni una clase que oculte por defecto (a diferencia de
 * `reveal-on-scroll`, que si ocultara sin JS sería un bug, aquí "oculto sin
 * JS" literalmente rompería el propósito: un banner de cookies invisible sin
 * poder cerrarlo sería peor que uno que no se puede cerrar). El "cerrado" es
 * 100% acción del usuario vía este script.
 *
 * a11y: si el elemento no es nativamente interactivo (no es `<button>`,
 * `<a href>` ni ya tiene `tabindex`), se le agrega `role="button"` +
 * `tabindex="0"` + manejo de teclado (Enter/Espacio) al hidratar — igual
 * criterio que `runtime/uiEnhancers.ts` (`summary.setAttribute("role",
 * "button")`). La `ActionDefinition` no puede hacerlo desde `dataAttributes`
 * (P7: pura, solo strings), así que el runtime lo resuelve en el DOM real.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa de `src/builder/`.
 */

export interface DismissOptions {
  /** Qué se oculta: el propio nodo o su padre directo. Default "self". */
  scope?: "self" | "parent";
  /** Persistir el descarte en localStorage (no volver a mostrar). Default false. */
  remember?: boolean;
}

export type Cleanup = () => void;

const NATIVE_INTERACTIVE_TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

/** ¿El elemento ya es nativamente interactivo (no necesita role/tabindex sintéticos)? */
function isNativelyInteractive(el: HTMLElement): boolean {
  if (NATIVE_INTERACTIVE_TAGS.has(el.tagName)) return true;
  if (el.tagName === "A" && el.hasAttribute("href")) return true;
  return el.hasAttribute("tabindex");
}

/**
 * Clave de `localStorage` para recordar el descarte de un nodo concreto.
 * Deriva del nodeId codificado en la clase `n-<nodeId>` que `cssSerializer
 * .classNameForNode` YA emite en el `className` de todo nodo (export/canvas,
 * P1/P3 — no es un atributo nuevo, es el mismo que ancla el CSS del nodo).
 * Sin esa clase (nodo sin id reconocible) no hay nada estable que usar: el
 * `remember` queda sin efecto para ese caso (degrada a "solo esta sesión").
 */
function storageKeyFor(el: HTMLElement): string | null {
  const match = /\bn-([^\s]+)\b/.exec(el.className);
  return match ? `pb-dismiss:${match[1]}` : null;
}

function wasRemembered(key: string | null): boolean {
  if (!key) return false;
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function remember(key: string | null): void {
  if (!key) return;
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* localStorage puede fallar (modo privado); el dismiss sigue funcionando en la sesión actual */
  }
}

export function enhanceDismiss(el: HTMLElement, options: DismissOptions = {}): Cleanup | void {
  const scope = options.scope === "parent" ? "parent" : "self";
  const remembered = options.remember === true;
  const target = (scope === "parent" ? el.parentElement : el) ?? el;

  const key = remembered ? storageKeyFor(target) : null;
  if (remembered && wasRemembered(key)) {
    target.style.display = "none";
    return;
  }

  const addedRole = !isNativelyInteractive(el);
  if (addedRole) {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
  }

  const dismissNow = (): void => {
    target.style.display = "none";
    if (remembered) remember(key);
  };

  const onClick = (event: Event): void => {
    event.preventDefault();
    dismissNow();
  };
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dismissNow();
    }
  };

  el.addEventListener("click", onClick);
  if (addedRole) el.addEventListener("keydown", onKeydown);

  return () => {
    el.removeEventListener("click", onClick);
    if (addedRole) el.removeEventListener("keydown", onKeydown);
  };
}

// ---------------------------------------------------------------------------
// Auto-registro para el loader (docs/10 §11, `enhance.ts`) — el loader es
// genérico por convención `data-pb-behavior` + `enhance<Type>` (P4): no
// distingue si el tipo viene de un behavior o de una acción con runtime
// propio (docs/44 §2.4, `exportToHtml.ts` → `behaviorRootProps`).
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __pbBehaviors?: Record<string, (el: HTMLElement, options: Record<string, unknown>) => (() => void) | void>;
  }
}

if (typeof window !== "undefined") {
  window.__pbBehaviors = window.__pbBehaviors ?? {};
  window.__pbBehaviors.enhanceDismiss = (el, options) => enhanceDismiss(el, options as DismissOptions);
}
