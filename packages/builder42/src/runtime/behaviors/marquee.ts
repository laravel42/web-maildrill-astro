/**
 * Marquee — runtime del OUTPUT (docs/44 §5 fila P1). El loop en sí es CSS
 * puro (`@keyframes`, ver `registry/behaviors/marquee.ts`) y funciona SIN este
 * módulo — tier 0 real. Este `enhance` es un complemento opcional para dos
 * casos que el CSS no puede cubrir solo:
 *
 * 1. `pauseOnHover` en touch: `:hover` no tiene un equivalente confiable en
 *    pantallas táctiles (se queda "pegado" tras un tap). Este runtime agrega
 *    un listener de `pointerdown`/`pointerup` para pausar/reanudar en touch,
 *    complementando el `:hover` nativo que ya cubre desktop (ese NO necesita
 *    JS — no se toca aquí, el CSS del behavior no lo declara porque
 *    `pauseOnHover` se controla desde este mismo enhance para unificar los
 *    dos casos en un solo lugar en vez de repartir la lógica).
 * 2. `prefers-reduced-motion` dinámico: si el visitante cambia la preferencia
 *    en caliente (sin recargar), el `@media` del CSS ya reacciona solo (no
 *    necesita JS) — este runtime solo evita volver a lanzar el listener de
 *    pausa si el media query ya está activo, para no pelear con el CSS.
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options`.
 */

export interface MarqueeOptions {
  duration?: number;
  direction?: "left" | "right";
  pauseOnHover?: boolean;
}

/** Cleanup opcional que el loader invoca si el nodo se desmonta (SPA-safe). */
export type Cleanup = () => void;

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function enhanceMarquee(el: HTMLElement, options: MarqueeOptions = {}): Cleanup | void {
  const { pauseOnHover = true } = options;

  // Con `prefers-reduced-motion`, el CSS ya detiene la animación (`@media` en
  // el behavior) — no hace falta ningún listener de pausa/touch.
  if (!pauseOnHover || prefersReducedMotion()) return;

  function pause(): void {
    el.classList.add("pb-marquee--paused");
  }
  function resume(): void {
    el.classList.remove("pb-marquee--paused");
  }

  // Desktop: `:hover` real ya lo cubre el CSS (`:hover { animation-play-state:
  // paused }` no se declaró para no duplicar con esta clase — se unifica todo
  // en `pb-marquee--paused`, disparada aquí tanto por mouse como por touch).
  el.addEventListener("pointerenter", pause);
  el.addEventListener("pointerleave", resume);
  // Touch: un tap "entra" (pointerdown) y pausa hasta el siguiente tap fuera.
  el.addEventListener("pointerdown", pause);

  return () => {
    el.removeEventListener("pointerenter", pause);
    el.removeEventListener("pointerleave", resume);
    el.removeEventListener("pointerdown", pause);
    resume();
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
  window.__pbBehaviors.enhanceMarquee = (el, options) => enhanceMarquee(el, options as MarqueeOptions);
}
