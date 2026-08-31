/**
 * Parallax — el fondo/contenido se desplaza a distinta velocidad que el resto
 * de la página al hacer scroll (docs/44 §5 fila P2, §9 D5). Estrategia de DOS
 * CAPAS (§9), en este orden:
 *
 * 1. **CSS scroll-driven como camino principal** (cero JS donde hay soporte,
 *    ~85% global a julio 2026): `animation-timeline: view()` — a diferencia
 *    de `scroll-progress` (ligado al scroll de TODA la página,
 *    `scroll(root block)`), `parallax` liga la animación a la posición del
 *    PROPIO elemento dentro del viewport mientras cruza la pantalla (`view()`
 *    es la función pensada exactamente para esto — parallax y reveal — según
 *    la propia guía de MDN de scroll-driven animations). El `@keyframes`
 *    traslada el elemento en el eje Y a medida que atraviesa el viewport.
 * 2. **Fallback JS opcional** (`fallback`, default true) dentro de
 *    `@supports not (animation-timeline: scroll())` — el plan usa ese mismo
 *    feature-query "sonda" para ambos behaviors (`scroll()` y `view()` son
 *    del mismo módulo CSS y llegan juntos a cada motor, así que probar por
 *    `scroll()` basta para detectar soporte de scroll-driven animations en
 *    general, sin duplicar la condición por función). El runtime usa
 *    `IntersectionObserver` para activar un listener de `scroll` SOLO
 *    mientras el elemento está en pantalla, escribiendo la MISMA CSS custom
 *    property (`--pb-parallax-offset`) que el CSS principal deja sin usar en
 *    ese camino — ver el `@supports` de abajo, el `transform` fuera de él usa
 *    la variable en AMBOS caminos, es el puente entre las dos implementaciones.
 * 3. **Aviso en el Inspector** (`optionsSchema.fields[].help`, clave i18n
 *    `behaviors.fields.parallax.fallbackHelp`) explicando la capacidad
 *    reciente + el fallback, en es/en/it.
 *
 * `prefers-reduced-motion`: el efecto se DESACTIVA por completo (no atenuado)
 * en AMBOS caminos — `@media` anula la animación CSS, y el runtime del
 * fallback comprueba la preferencia antes de instalar cualquier listener.
 *
 * Universal (sin restricción de tipo): el plan lista `hero`/`section` como
 * casos típicos, pero no hay razón funcional para prohibirlo en otro
 * container — mismo criterio que `sticky`/`reveal-on-scroll`.
 */

import type { BehaviorDefinition } from "../types";

export const parallaxBehavior: BehaviorDefinition = {
  type: "parallax",
  label: "Parallax",
  category: "motion",
  // Sin `appliesTo`: aplica a todos los tipos de nodo (ver nota arriba).
  defaultOptions: { speed: 0.3, fallback: true },
  optionsSchema: {
    fields: [
      {
        key: "speed",
        label: "Velocidad",
        control: "number",
        group: "Parallax",
        placeholder: "0.3",
      },
      {
        key: "fallback",
        label: "Alternativa con JS en navegadores antiguos",
        control: "toggle",
        group: "Parallax",
        help: "behaviors.fields.parallax.fallbackHelp",
      },
    ],
  },
  runtime: {
    moduleId: "parallax",
    enhance: "enhanceParallax",
    css: [
      // Camino principal: `view()` liga la animación a la posición del
      // elemento en el viewport, no al scroll global (a diferencia de
      // `scroll-progress`). El rango completo del cruce (`entry` a `exit`,
      // el default de `view()`) traslada el contenido según `--pb-parallax-speed`.
      "@supports (animation-timeline: scroll()) {",
      '  [data-pb-behavior~="parallax"] { animation-name: pb-parallax; animation-timeline: view(); animation-fill-mode: both; }',
      "  @keyframes pb-parallax {",
      "    from { transform: translate3d(0, calc(var(--pb-parallax-speed, 0.3) * -60px), 0); }",
      "    to { transform: translate3d(0, calc(var(--pb-parallax-speed, 0.3) * 60px), 0); }",
      "  }",
      "}",
      // Fallback JS (opt-out vía `fallback: false`): el MISMO `transform`,
      // pero consumiendo la custom property que escribe `enhanceParallax` en
      // cada frame — el puente entre las dos implementaciones es esta única
      // variable, `--pb-parallax-offset` (no hay un segundo cálculo visual).
      "@supports not (animation-timeline: scroll()) {",
      '  [data-pb-behavior~="parallax"].pb-parallax--js { transform: translate3d(0, var(--pb-parallax-offset, 0), 0); }',
      "}",
      // `prefers-reduced-motion`: apagado completo en ambos caminos (no
      // atenuado). El camino CSS se anula quitando la animación; el fallback
      // JS ni siquiera instala el listener (ver `enhanceParallax`).
      "@media (prefers-reduced-motion: reduce) {",
      '  [data-pb-behavior~="parallax"] { animation: none; transform: none; }',
      "}",
    ].join("\n"),
    loadPreview: async () => (await import("../../../runtime/behaviors/parallax")).enhanceParallax,
  },
};
