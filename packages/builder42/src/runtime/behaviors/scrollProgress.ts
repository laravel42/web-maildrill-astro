/**
 * Scroll progress — runtime del OUTPUT (docs/44 §5 fila P2, §9 D5). Solo tiene
 * responsabilidad de FALLBACK (a diferencia de `parallax`, no hay ningún
 * ajuste que aplicar siempre): si el navegador soporta scroll-driven
 * animations, el CSS principal (`registry/behaviors/scrollProgress.ts`) ya
 * cubre el efecto completo sin ayuda de este módulo.
 *
 * **Escribe en `:root`, no en `el`** (crítico, ver docstring del registry):
 * la barra necesita el progreso de TODA la página, no de su propia posición
 * — por eso el listener es de `window`/`document`, no `IntersectionObserver`
 * sobre `el` (a diferencia de `parallax`, que sí necesita saber si el propio
 * elemento está en pantalla).
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options`.
 */

export interface ScrollProgressOptions {
  /** Fallback JS en navegadores sin scroll-driven animations. Default true. */
  fallback?: boolean;
}

/** Cleanup opcional que el loader invoca si el nodo se desmonta (SPA-safe). */
export type Cleanup = () => void;

/** Mismo criterio "sonda" que usa el CSS (y que `parallax.ts` usa para su propio fallback). */
function supportsScrollDrivenAnimations(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("animation-timeline: scroll()")
  );
}

export function enhanceScrollProgress(
  _el: HTMLElement,
  options: ScrollProgressOptions = {},
): Cleanup | void {
  const { fallback = true } = options;

  if (!fallback) return;
  if (supportsScrollDrivenAnimations()) return; // el CSS principal ya cubre el efecto.

  const root = document.documentElement;
  let ticking = false;

  function computeProgress(): number {
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollHeight <= 0) return 0;
    return Math.min(1, Math.max(0, window.scrollY / scrollHeight));
  }

  function applyProgress(): void {
    ticking = false;
    root.style.setProperty("--pb-scroll-progress", String(computeProgress()));
  }

  function onScroll(): void {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(applyProgress);
  }

  // Estado inicial (la página puede cargar ya scrolleada, ej. tras un reload
  // con scroll restaurado por el navegador — mismo caso que `sticky.ts`).
  // `prefers-reduced-motion` no impide fijar el valor REAL de progreso (la
  // barra sigue siendo informativa/funcional, ver docstring del registry):
  // este runtime nunca anima una transición (solo escritura directa de la
  // variable), así que no hay nada adicional que desactivar aquí más allá
  // de lo que ya hace el `@media` del CSS principal.
  applyProgress();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });

  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("resize", onScroll);
    root.style.removeProperty("--pb-scroll-progress");
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
  window.__pbBehaviors.enhanceScrollProgress = (el, options) =>
    enhanceScrollProgress(el, options as ScrollProgressOptions);
}
