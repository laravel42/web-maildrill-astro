/**
 * Scroll-to — runtime de la acción `scroll-to` (docs/44 §4 fila P1). Hace
 * scroll suave hasta el nodo marcado con `data-pb-scroll-to="<targetId>"`, o
 * hasta el inicio de la página si el valor es el sentinel `"__top__"` (preset
 * `scroll-to-top`, docs/44 §4 fila P2 — ver `registry/actions/scrollTo.ts`
 * para el razonamiento completo de por qué es un preset y no una acción
 * aparte).
 *
 * Desviación documentada del "tier 0" anunciado en el plan (docs/44 §4,
 * columna Tier): el plan proponía `scroll-behavior:smooth` + `#id` sin JS,
 * pero eso solo es posible si el TRIGGER es un `<a href="#id">` real — y esta
 * acción se ofrece en CUALQUIER nodo (`appliesTo` no restringe por tipo,
 * fuera de la exclusión de D4), incluyendo componentes que no renderizan un
 * `<a>` en absoluto (`card`, `container`, `image`…). Un nodo así no tiene
 * ningún atributo nativo (`href`) que produzca scroll sin JS: `data-pb-*` no
 * es un atributo que el navegador interprete. Por eso `scroll-to` SÍ necesita
 * este runtime — no es tier 0 puro, es tier 1 (mismo criterio que
 * `close-modal`, que también depende de JS para el ciclo completo). El
 * preset `scroll-to-top` es, de las tres acciones P2, el más cercano a tier 0
 * real (`window.scrollTo(0,0)` es trivial) pero comparte la misma limitación:
 * un nodo no-link sigue necesitando JS para reaccionar al click.
 *
 * Degradación sin JS (P8/P9): SIN este runtime, el trigger no hace nada al
 * click (ningún salto brusco tampoco — no hay `href` que el navegador siga).
 * Es una limitación real, documentada aquí y en docs/44: para el caso que SÍ
 * degrada sin JS (nodos que pueden ser un enlace nativo), el catálogo ya
 * ofrece `LinkTarget.kind:"anchor"` en vez de esta acción (D4, `scrollTo.ts`
 * → `appliesTo` excluye nodos con link activo).
 *
 * a11y: si el trigger no es nativamente interactivo, se le agrega
 * `role="button"` + `tabindex="0"` + teclado (Enter/Espacio) — mismo criterio
 * que `runtime/actions/dismiss.ts`.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa de `src/builder/`.
 */

export type Cleanup = () => void;

/** Sentinel de `data-pb-scroll-to` para el preset `scroll-to-top` (no es un nodeId real). */
const TOP_PRESET = "__top__";

const NATIVE_INTERACTIVE_TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

function isNativelyInteractive(el: HTMLElement): boolean {
  if (NATIVE_INTERACTIVE_TAGS.has(el.tagName)) return true;
  if (el.tagName === "A" && el.hasAttribute("href")) return true;
  return el.hasAttribute("tabindex");
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function enhanceScrollTo(el: HTMLElement): Cleanup | void {
  const targetId = el.dataset.pbScrollTo;
  if (!targetId) return;

  const addedRole = !isNativelyInteractive(el);
  if (addedRole) {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
  }

  const scrollToTarget = (event: Event): void => {
    const behavior = prefersReducedMotion() ? "auto" : "smooth";
    if (targetId === TOP_PRESET) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior });
      return;
    }
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior, block: "start" });
  };

  const onClick = (event: Event): void => scrollToTarget(event);
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter" || event.key === " ") scrollToTarget(event);
  };

  el.addEventListener("click", onClick);
  if (addedRole) el.addEventListener("keydown", onKeydown);

  return () => {
    el.removeEventListener("click", onClick);
    if (addedRole) el.removeEventListener("keydown", onKeydown);
  };
}

// ---------------------------------------------------------------------------
// Auto-registro para el loader (docs/10 §11, `enhance.ts`) — igual criterio
// genérico que `runtime/actions/dismiss.ts` (docs/44 §2.4).
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __pbBehaviors?: Record<string, (el: HTMLElement, options: Record<string, unknown>) => (() => void) | void>;
  }
}

if (typeof window !== "undefined") {
  window.__pbBehaviors = window.__pbBehaviors ?? {};
  window.__pbBehaviors.enhanceScrollTo = (el) => enhanceScrollTo(el);
}
