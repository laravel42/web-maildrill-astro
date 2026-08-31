/**
 * Scroll progress — barra que avanza según el progreso de lectura de TODA la
 * página (docs/44 §5 fila P2, §9 D5), no solo la posición del propio elemento
 * (a diferencia de `parallax`, que usa `view()`). Misma estrategia de dos
 * capas que `parallax` (§9), en el mismo orden:
 *
 * 1. **CSS scroll-driven como camino principal**: `animation-timeline:
 *    scroll(root block)` — liga la animación al scroll VERTICAL del
 *    documento completo (`root`), de 0% a 100% conforme se scrollea de
 *    arriba a abajo (patrón documentado por webmaker.app/MDN: "the entire
 *    bar, ten lines, all CSS"). El `@keyframes` anima `transform: scaleX()`
 *    desde `transform-origin: left`, para que la barra crezca de izquierda a
 *    derecha con el compositor (más barato que animar `width`).
 * 2. **Fallback JS opcional** (`fallback`, default true) dentro de
 *    `@supports not (animation-timeline: scroll())`: un listener de `scroll`
 *    (a nivel de VENTANA, no `IntersectionObserver` — a diferencia de
 *    `parallax`, la barra necesita el progreso de TODA la página sin
 *    importar si ella misma está en pantalla) que escribe
 *    `--pb-scroll-progress` (0..1) en `:root` — NO en el propio elemento,
 *    porque el valor es un dato de la página, no de dónde vive la barra en
 *    el árbol. El MISMO CSS (el `@supports not` de abajo) consume esa
 *    variable con `transform: scaleX(var(--pb-scroll-progress, 0))`.
 * 3. **Aviso en el Inspector**, igual mecanismo que `parallax`
 *    (`optionsSchema.fields[].help`), es/en/it.
 *
 * `prefers-reduced-motion`: el plan es explícito en aplicar el MISMO criterio
 * a los 4 behaviors de esta fase ("efecto desactivado, no atenuado") aunque
 * una barra de progreso de lectura sea informativa, no decorativa —
 * "desactivar la animación" aquí significa que la barra deja de tener una
 * transición suave entre valores (salta directo al progreso actual sin
 * `transition`/animación), pero SIGUE reflejando el progreso real: no se
 * oculta ni deja de funcionar, solo pierde el efecto de movimiento continuo
 * (igual principio que `count-up`: el valor final/real nunca depende del
 * motion). Aplica en ambos caminos: `@media` anula la interpolación CSS del
 * camino principal, y el runtime del fallback aplica el cambio sin
 * transición.
 */

import type { BehaviorDefinition } from "../types";

export const scrollProgressBehavior: BehaviorDefinition = {
  type: "scroll-progress",
  label: "Barra de progreso de lectura",
  category: "motion",
  // Sin `appliesTo`: aplica a todos los tipos de nodo — no hay un componente
  // "barra" dedicado en el catálogo (ver `Divider.tsx`), así que el behavior
  // se apoya en el `size`/`appearance` que el usuario ya configura en
  // CUALQUIER nodo (un `divider` fino es el caso de uso típico, pero no es
  // una restricción funcional real).
  defaultOptions: { fallback: true },
  optionsSchema: {
    fields: [
      {
        key: "fallback",
        label: "Alternativa con JS en navegadores antiguos",
        control: "toggle",
        group: "Progreso de lectura",
        help: "behaviors.fields.scroll-progress.fallbackHelp",
      },
    ],
  },
  runtime: {
    moduleId: "scrollProgress",
    enhance: "enhanceScrollProgress",
    css: [
      "@supports (animation-timeline: scroll()) {",
      '  [data-pb-behavior~="scroll-progress"] { transform-origin: left; animation-name: pb-scroll-progress; animation-timeline: scroll(root block); animation-fill-mode: both; animation-timing-function: linear; }',
      "  @keyframes pb-scroll-progress {",
      "    from { transform: scaleX(0); }",
      "    to { transform: scaleX(1); }",
      "  }",
      "}",
      // Fallback JS: la MISMA transformación (`scaleX`), pero leyendo la
      // custom property que escribe `enhanceScrollProgress` en `:root` — el
      // puente entre las dos implementaciones es esta única variable.
      "@supports not (animation-timeline: scroll()) {",
      '  [data-pb-behavior~="scroll-progress"] { transform-origin: left; transform: scaleX(var(--pb-scroll-progress, 0)); }',
      "}",
      // `prefers-reduced-motion`: quita la interpolación suave (el valor
      // sigue siendo el progreso real, solo sin easing/transición continua).
      "@media (prefers-reduced-motion: reduce) {",
      '  [data-pb-behavior~="scroll-progress"] { animation-timing-function: step-end; transition: none; }',
      "}",
    ].join("\n"),
    loadPreview: async () =>
      (await import("../../../runtime/behaviors/scrollProgress")).enhanceScrollProgress,
  },
};
