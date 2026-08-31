/**
 * Open URL — runtime de la acción `open-url` (docs/44 §4 fila P2). Navega a
 * `options.url` al hacer click sobre el elemento marcado con
 * `data-pb-open-url`.
 *
 * Desviación documentada del "tier 0" anunciado en el plan (docs/44 §4,
 * columna Tier): igual que `scroll-to` (ver `runtime/actions/scrollTo.ts`),
 * un `<a href="…">` bastaría SI el trigger fuera siempre un link nativo, pero
 * esta acción se ofrece en cualquier nodo (`card`, `container`, `image`…), no
 * solo en los que pueden renderizar como `<a>`. Un nodo así no tiene ningún
 * atributo nativo que el navegador siga sin JS: `data-pb-*` no es
 * interpretado por el navegador. Por eso necesita este runtime — tier 1, no
 * tier 0 puro.
 *
 * Degradación sin JS (P8/P9): SIN este runtime, el trigger no navega (ningún
 * salto ni error, simplemente no pasa nada) — el contenido sigue siendo
 * visible/usable, es la misma limitación ya aceptada para `scroll-to`/
 * `close-modal` en la Fase 2.
 *
 * a11y: rol `"link"` (no `"button"` — la acción navega, cambia de contexto,
 * que es la semántica correcta de `role="link"" en WAI-ARIA) + `tabindex="0"`
 * + Enter (un `<a>` real solo reacciona a Enter, no a Espacio — se replica
 * ese comportamiento en vez del de un botón) para nodos que no son ya
 * nativamente interactivos.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa de `src/builder/`.
 */

export interface OpenUrlOptions {
  /** URL de destino. Sin valor (o vacía), el runtime no hace nada — no-op seguro. */
  url?: string;
  /** Abre en pestaña nueva (`target="_blank"` + `rel="noopener noreferrer"`). Default false. */
  newTab?: boolean;
}

export type Cleanup = () => void;

const NATIVE_INTERACTIVE_TAGS = new Set(["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"]);

function isNativelyInteractive(el: HTMLElement): boolean {
  if (NATIVE_INTERACTIVE_TAGS.has(el.tagName)) return true;
  if (el.tagName === "A" && el.hasAttribute("href")) return true;
  return el.hasAttribute("tabindex");
}

function navigate(url: string, newTab: boolean): void {
  if (newTab) {
    // `noopener` evita acceso de la nueva pestaña a `window.opener`;
    // `noreferrer` evita fuga del `Referer` — mismo criterio de seguridad que
    // `registry/components/Button.tsx` (`newTab` con `link`).
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  window.location.href = url;
}

export function enhanceOpenUrl(el: HTMLElement, options: OpenUrlOptions = {}): Cleanup | void {
  const url = typeof options.url === "string" ? options.url.trim() : "";
  if (!url) return; // sin URL configurada: no-op seguro, nunca navega a ""/undefined

  const newTab = options.newTab === true;

  const addedRole = !isNativelyInteractive(el);
  if (addedRole) {
    el.setAttribute("role", "link");
    el.setAttribute("tabindex", "0");
  }

  const onClick = (event: Event): void => {
    event.preventDefault();
    navigate(url, newTab);
  };
  const onKeydown = (event: KeyboardEvent): void => {
    // Solo Enter (no Espacio): replica el comportamiento nativo de un <a>,
    // no el de un <button> (mismo espíritu que el rol "link" elegido arriba).
    if (event.key === "Enter") {
      event.preventDefault();
      navigate(url, newTab);
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
// Auto-registro para el loader (docs/10 §11, `enhance.ts`) — igual criterio
// genérico que `runtime/actions/dismiss.ts`/`scrollTo.ts` (docs/44 §2.4).
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __pbBehaviors?: Record<string, (el: HTMLElement, options: Record<string, unknown>) => (() => void) | void>;
  }
}

if (typeof window !== "undefined") {
  window.__pbBehaviors = window.__pbBehaviors ?? {};
  window.__pbBehaviors.enhanceOpenUrl = (el, options) => enhanceOpenUrl(el, options as OpenUrlOptions);
}
