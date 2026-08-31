/**
 * Reveal-on-scroll — segundo behavior de referencia (docs/10 §1, §8.4). Prueba
 * que agregar un behavior NO toca el core (P4): ni `NodeRenderer`, ni
 * `exportSite`, ni `usePreviewBehaviors` conocen "reveal-on-scroll"; todo pasa
 * por el registro (`registry/behaviors/revealOnScroll.ts`) + este runtime.
 *
 * Simple e independiente a propósito: usa `IntersectionObserver` (soportado en
 * todos los navegadores modernos, sin polyfill) para añadir una clase cuando
 * el elemento entra en el viewport. El CSS de la transición lo declara el
 * propio behavior (`runtime.css`, docs/10 §8.3) — nunca toca `styles/chrome.css`
 * ni el core del editor.
 *
 * **Fase 5 (docs/44 §8.2 D2) — `mode: "sequence"`:** en vez de revelar todos
 * los hijos a la vez, asigna la CSS custom property `--i` (índice 0-based) a
 * CADA HIJO DIRECTO de `el` (no a `el` mismo — el elemento observado sigue
 * siendo uno solo, un único `IntersectionObserver`) y agrega la clase
 * `pb-reveal--sequence` en `el` para que el CSS del behavior sepa aplicar el
 * `transition-delay` escalonado. `together` (default) es un no-op sobre los
 * hijos: mismo comportamiento que antes de esta fase (retrocompat).
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options`.
 */

export interface RevealOnScrollOptions {
  /** Distancia (0-1) del viewport a la que se dispara. Default 0.15. */
  threshold?: number;
  /** Solo la primera vez que entra en viewport (default) o cada vez. */
  once?: boolean;
  /** Modo de entrada: todos a la vez (default) o escalonado por hijo. */
  mode?: "together" | "sequence";
}

/** Cleanup opcional que el loader invoca si el nodo se desmonta (SPA-safe). */
export type Cleanup = () => void;

/** Asigna `--i` (índice) a cada hijo directo, para el `transition-delay` del CSS. */
function assignSequenceIndexes(el: HTMLElement): void {
  Array.from(el.children).forEach((child, i) => {
    (child as HTMLElement).style.setProperty("--i", String(i));
  });
}

export function enhanceRevealOnScroll(
  el: HTMLElement,
  options: RevealOnScrollOptions = {},
): Cleanup | void {
  const { threshold = 0.15, once = true, mode = "together" } = options;
  const sequence = mode === "sequence";

  // Progressive enhancement (docs/10 §0): antes de que el observer dispare,
  // el elemento está oculto vía la clase inicial; si IntersectionObserver no
  // existe (navegador muy antiguo), se revela de inmediato para no dejar
  // contenido invisible permanentemente.
  if (typeof IntersectionObserver === "undefined") {
    el.classList.add("pb-reveal--visible");
    return;
  }

  el.classList.add("pb-reveal");
  if (sequence) {
    el.classList.add("pb-reveal--sequence");
    assignSequenceIndexes(el);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          el.classList.add("pb-reveal--visible");
          if (once) observer.unobserve(el);
        } else if (!once) {
          el.classList.remove("pb-reveal--visible");
        }
      }
    },
    { threshold },
  );
  observer.observe(el);

  return () => {
    observer.disconnect();
    el.classList.remove("pb-reveal", "pb-reveal--visible", "pb-reveal--sequence");
    if (sequence) {
      Array.from(el.children).forEach((child) => {
        (child as HTMLElement).style.removeProperty("--i");
      });
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
  window.__pbBehaviors.enhanceRevealOnScroll = (el, options) =>
    enhanceRevealOnScroll(el, options as RevealOnScrollOptions);
}
