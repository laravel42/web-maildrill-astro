/**
 * Sticky — fija un nodo al hacer scroll (docs/44 §5 fila P1). Tier 0+1: el
 * efecto base (`position: sticky`) es CSS puro y funciona SIN runtime; el JS
 * SOLO agrega una clase `pb-sticky--scrolled` cuando el visitante ya scrolleó
 * más allá del umbral configurado, para que el propio CSS del sitio pueda
 * reaccionar (sombra, compactar el padding…) — el behavior no impone ningún
 * estilo de "ya scrolleé", solo expone el hook de clase.
 *
 * **Cómo se logra tier 0 real (a diferencia de `reveal-on-scroll`):**
 * `reveal-on-scroll` empieza OCULTO y el JS revela — si el JS no corre, debe
 * quedar VISIBLE, así que su CSS (`.pb-reveal`) la agrega solo el `enhance` en
 * runtime (nunca el export). `sticky` es al revés: el efecto de posición debe
 * funcionar YA, sin JS. El export SIEMPRE emite `data-pb-behavior="sticky …"`
 * en el nodo (independiente de si el bundle JS carga, ver
 * `exportToHtml.ts#behaviorRootProps`), así que el CSS de este behavior se
 * ancla al selector de ATRIBUTO `[data-pb-behavior~="sticky"]` en vez de a una
 * clase que solo el `enhance` pondría — `assets/css/behaviors.css` se enlaza
 * siempre que el nodo tenga el behavior adjunto, con o sin runtime JS
 * (`renderPage.ts`), así el `position: sticky` aplica incluso si el visitante
 * tiene JS desactivado.
 *
 * Universal (sin `appliesTo`, como `reveal-on-scroll`/`toggle`/`theme-toggle`):
 * el plan (docs/44 §5) lista `navbar`/`header`/`section` como casos de uso
 * típicos, pero el repo no tiene un tipo `header` propio (`navbar` y `section`
 * son tipos separados, ver `registry/components/{Navbar,Section}.tsx`) y no
 * hay motivo funcional para prohibirlo en un `container` genérico — un CTA
 * flotante o una barra de progreso también son casos legítimos. Restringir
 * por `appliesTo` sería una limitación artificial sin beneficio real, así que
 * queda universal, igual que los demás "efecto genérico" del catálogo.
 */

import type { BehaviorDefinition } from "../types";

export const stickyBehavior: BehaviorDefinition = {
  type: "sticky",
  label: "Fijo al hacer scroll (sticky)",
  category: "navigation",
  // Sin `appliesTo`: aplica a todos los tipos de nodo (ver nota arriba).
  defaultOptions: { position: "top", scrolledThreshold: 8 },
  optionsSchema: {
    fields: [
      {
        key: "position",
        label: "Posición",
        control: "select",
        group: "Sticky",
        options: [
          { label: "Arriba", value: "top" },
          { label: "Abajo", value: "bottom" },
        ],
      },
      {
        key: "scrolledThreshold",
        label: "Umbral para marcar \"ya scrolleó\" (px)",
        control: "number",
        group: "Sticky",
        placeholder: "8",
        help: "behaviors.fields.sticky.scrolledThresholdHelp",
      },
    ],
  },
  runtime: {
    moduleId: "sticky",
    enhance: "enhanceSticky",
    // Selector de ATRIBUTO (no de clase): `data-pb-behavior` lo emite el
    // export/canvas SIEMPRE que el behavior esté adjunto (ver comentario de
    // arriba) — el `position: sticky` funciona sin ningún JS. `--scrolled`
    // SÍ requiere runtime (JS es la única forma de saber "cuánto scrolleó el
    // visitante"), así que esa clase la agrega únicamente `enhanceSticky`.
    css: [
      '[data-pb-behavior~="sticky"] { position: sticky; top: 0; z-index: 10; }',
      '[data-pb-behavior~="sticky"].pb-sticky--bottom-pos { top: auto; bottom: 0; }',
    ].join("\n"),
    loadPreview: async () => (await import("../../../runtime/behaviors/sticky")).enhanceSticky,
  },
};
