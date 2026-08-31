/**
 * Parallax — runtime del OUTPUT (docs/44 §5 fila P2, §9 D5). Dos responsabilidades,
 * independientes de qué camino CSS esté activo en el navegador:
 *
 * 1. **Siempre**: escribe `--pb-parallax-speed` desde `options.speed` — la
 *    consume el `@keyframes` del camino CSS principal
 *    (`registry/behaviors/parallax.ts`). Sin este paso el `@keyframes` cae al
 *    valor por defecto (`0.3`) del propio CSS (`var(--pb-parallax-speed, 0.3)`),
 *    así que incluso SIN este runtime (JS desactivado) el efecto principal
 *    sigue funcionando con la velocidad default — el runtime solo personaliza.
 * 2. **Solo si `@supports not (animation-timeline: scroll())`** (detectado con
 *    `CSS.supports`, el mismo criterio "sonda" que el CSS) y `options.fallback
 *    !== false`: activa un fallback con `IntersectionObserver` +
 *    `requestAnimationFrame` que escribe `--pb-parallax-offset` — la MISMA
 *    variable que el CSS fallback (`@supports not (...) { transform:
 *    translate3d(0, var(--pb-parallax-offset, 0), 0) }`) consume. No hay dos
 *    implementaciones visuales: el puente es esta única custom property.
 *
 * `prefers-reduced-motion`: si está activa, este módulo NO instala ningún
 * listener del fallback (el efecto queda completamente apagado, no atenuado,
 * en línea con el `@media` del CSS principal).
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa nada de
 * `src/builder/`. Solo conoce el DOM y sus `options`.
 */

export interface ParallaxOptions {
  /** Intensidad del desplazamiento (0-1 típico). Default 0.3. */
  speed?: number;
  /** Fallback JS en navegadores sin scroll-driven animations. Default true. */
  fallback?: boolean;
}

/** Cleanup opcional que el loader invoca si el nodo se desmonta (SPA-safe). */
export type Cleanup = () => void;

function prefersReducedMotion(): boolean {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Mismo criterio "sonda" que usa el CSS: `scroll()` y `view()` son del mismo módulo. */
function supportsScrollDrivenAnimations(): boolean {
  return typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("animation-timeline: scroll()");
}

const MAX_OFFSET_PX = 60;

export function enhanceParallax(el: HTMLElement, options: ParallaxOptions = {}): Cleanup | void {
  const { speed = 0.3, fallback = true } = options;

  // Paso 1 (siempre, ver docstring): personaliza la velocidad del camino CSS
  // principal, funcione o no el fallback.
  el.style.setProperty("--pb-parallax-speed", String(speed));

  if (prefersReducedMotion()) return;
  if (!fallback) return;
  if (supportsScrollDrivenAnimations()) return; // el CSS principal ya cubre el efecto.
  if (typeof IntersectionObserver === "undefined") return;

  el.classList.add("pb-parallax--js");

  let inView = false;
  let ticking = false;

  function applyOffset(): void {
    ticking = false;
    if (!inView) return;
    const rect = el.getBoundingClientRect();
    const viewportH = window.innerHeight || document.documentElement.clientHeight;
    // Progreso 0..1 de cuánto atravesó el elemento el viewport (0 = borde
    // inferior del viewport tocando la parte superior del elemento, 1 = borde
    // superior del viewport tocando la parte inferior) — mismo rango
    // conceptual que cubre `view()` en el camino CSS.
    const progress = Math.min(1, Math.max(0, (viewportH - rect.top) / (viewportH + rect.height)));
    const offset = (progress - 0.5) * 2 * MAX_OFFSET_PX * speed;
    el.style.setProperty("--pb-parallax-offset", `${offset}px`);
  }

  function onScroll(): void {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(applyOffset);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        inView = entry.isIntersecting;
        if (inView) applyOffset();
      }
    },
    { threshold: 0 },
  );
  observer.observe(el);
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    observer.disconnect();
    window.removeEventListener("scroll", onScroll);
    el.classList.remove("pb-parallax--js");
    el.style.removeProperty("--pb-parallax-offset");
    el.style.removeProperty("--pb-parallax-speed");
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
  window.__pbBehaviors.enhanceParallax = (el, options) => enhanceParallax(el, options as ParallaxOptions);
}
