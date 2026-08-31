/**
 * Sticky — runtime del OUTPUT (docs/44 §5 fila P1). El `position: sticky` en
 * sí ya lo aplica el CSS del behavior (`registry/behaviors/sticky.ts`, vía
 * `[data-pb-behavior~="sticky"]`) SIN este runtime — es tier 0 real. Este
 * módulo (tier 1) solo:
 *
 * 1. Aplica `bottom`/`top` según `options.position` (por si el sitio quiere
 *    fijar al fondo en vez de arriba — el CSS por defecto asume "arriba").
 * 2. Agrega `pb-sticky--scrolled` cuando `window.scrollY` supera
 *    `options.scrolledThreshold`, para que el propio CSS del sitio pueda
 *    reaccionar (sombra, compactar…) — el behavior no impone ningún estilo
 *    de "ya scrolleé" por sí mismo, solo el hook de clase.
 *
 * Un único listener de `scroll`, con `requestAnimationFrame` para no leer/
 * escribir el DOM más de una vez por frame (evita forced reflow en scroll
 * de alta frecuencia — no se usa ninguna dependencia npm, solo rAF nativo).
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options`.
 */

export interface StickyOptions {
  /** Borde al que se fija. Default "top" (ya es el default del CSS base). */
  position?: "top" | "bottom";
  /** px de scroll a partir de los cuales se agrega `pb-sticky--scrolled`. Default 8. */
  scrolledThreshold?: number;
}

/** Cleanup opcional que el loader invoca si el nodo se desmonta (SPA-safe). */
export type Cleanup = () => void;

export function enhanceSticky(el: HTMLElement, options: StickyOptions = {}): Cleanup | void {
  const { position = "top", scrolledThreshold = 8 } = options;

  if (position === "bottom") el.classList.add("pb-sticky--bottom-pos");

  let ticking = false;
  let lastScrolled = false;

  function applyScrolledState(): void {
    ticking = false;
    const isScrolled = window.scrollY > scrolledThreshold;
    if (isScrolled === lastScrolled) return;
    lastScrolled = isScrolled;
    el.classList.toggle("pb-sticky--scrolled", isScrolled);
  }

  function onScroll(): void {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(applyScrolledState);
  }

  // Estado inicial (por si la página carga ya scrolleada, ej. tras un reload
  // con scroll restaurado por el navegador).
  applyScrolledState();

  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    window.removeEventListener("scroll", onScroll);
    el.classList.remove("pb-sticky--scrolled", "pb-sticky--bottom-pos");
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
  window.__pbBehaviors.enhanceSticky = (el, options) => enhanceSticky(el, options as StickyOptions);
}
