/**
 * Expandable ("Ver más") — colapsa un bloque a una altura configurable y
 * agrega su propio botón de expandir/colapsar (docs/44 §5 fila P2). Sustituye
 * a la descartada `toggle-target` (§4.1): NO pide objetivo, se aplica
 * directamente al bloque que se quiere colapsar y él mismo inyecta el botón
 * al hidratar (patrón de inyección DOM de `runtime/behaviors/carousel.ts`).
 *
 * **`appliesTo`: solo `acceptsChildren: true` (containers y composites con
 * contenido).** Colapsar tiene sentido sobre un bloque con CONTENIDO propio
 * (texto largo, tarjetas de FAQ, un `container`/`card`/`section`) — un nodo
 * hoja sin hijos (`image`, `icon`, `divider`, `button`) no tiene "más" que
 * mostrar/ocultar, así que restringir por este flag evita ofrecer el
 * behavior donde no cierra ningún hueco real (criterio de selección §3.1).
 * A diferencia de `reveal-on-scroll`/`sticky` (efectos genéricos que aplican
 * a CUALQUIER nodo), `expandable` sí tiene una condición funcional clara —
 * se restringe con `appliesTo`, no queda universal.
 *
 * **CRÍTICO — degradación sin JS (P8/P9, no-negociable del plan):** el plan
 * dice explícitamente "sin JS se ve completo (nunca oculta contenido)". Esto
 * es EL MISMO caso que `reveal-on-scroll` (el JS oculta algo visible por
 * defecto) y NO el de `sticky`/`marquee` (ahí el recorte es tier 0 real,
 * anclado al atributo `data-pb-behavior` que el export SIEMPRE emite,
 * funciona sin runtime). Aquí el orden es al revés: sin runtime NO existe
 * ningún botón para volver a expandir, así que si el recorte (`max-height` +
 * `overflow: hidden`) estuviera anclado al atributo (como `sticky`), el
 * contenido quedaría PERMANENTEMENTE cortado sin JS — exactamente lo que el
 * plan prohíbe. Por eso el CSS de colapso se ancla a la clase
 * `.pb-expandable--collapsed`, que el export NUNCA agrega (ni al nodo ni en
 * ningún HTML estático) — solo `enhance` la agrega en runtime, junto con el
 * botón que permite quitarla. Sin JS: sin la clase, sin recorte, contenido
 * 100% visible (igual razonamiento que `.pb-reveal` en
 * `registry/behaviors/revealOnScroll.ts`).
 */

import type { BehaviorDefinition } from "../types";
import { getDefinition } from "../componentRegistry";

export const expandableBehavior: BehaviorDefinition = {
  type: "expandable",
  label: "Ver más (expandible)",
  category: "interactive",
  // Solo nodos con contenido propio (ver nota arriba) — colapsar un nodo
  // sin hijos no cierra ningún hueco real. Mismo patrón que `carousel.ts`
  // para consultar `acceptsChildren` (vive en el `ComponentDefinition`, no
  // en el `BuilderNode`).
  appliesTo: (node) => getDefinition(node.type)?.acceptsChildren ?? false,
  defaultOptions: {
    collapsedHeight: 200,
    expandLabel: "Show more",
    collapseLabel: "Show less",
    fade: true,
  },
  optionsSchema: {
    fields: [
      {
        key: "collapsedHeight",
        label: "Altura colapsada (px)",
        control: "number",
        group: "Expandible",
        placeholder: "200",
      },
      {
        key: "expandLabel",
        label: "Texto del botón \"Ver más\"",
        control: "text",
        group: "Expandible",
        placeholder: "Ver más",
      },
      {
        key: "collapseLabel",
        label: "Texto del botón \"Ver menos\"",
        control: "text",
        group: "Expandible",
        placeholder: "Ver menos",
      },
      { key: "fade", label: "Degradado al final", control: "toggle", group: "Expandible" },
    ],
  },
  runtime: {
    moduleId: "expandable",
    enhance: "enhanceExpandable",
    // Ver nota arriba (P8/P9): el recorte SOLO existe si `.pb-expandable--collapsed`
    // está presente, y NADIE la agrega salvo el runtime (nunca el export). El
    // botón inyectado (`.pb-expandable__toggle`) tampoco existe en el HTML
    // estático — es 100% DOM creado por `enhance` (patrón de `carousel.ts`).
    css: [
      ".pb-expandable--collapsed { max-height: var(--pb-expandable-height, 200px); overflow: hidden; position: relative; transition: max-height 0.3s ease; }",
      // Gradiente de fade opcional (`fade: true`, default) al final del
      // bloque colapsado, para indicar visualmente que hay más contenido.
      ".pb-expandable--collapsed.pb-expandable--fade::after { content: \"\"; position: absolute; left: 0; right: 0; bottom: 0; height: 48px; background: linear-gradient(to bottom, transparent, var(--pb-expandable-fade-color, #fff)); pointer-events: none; }",
      ".pb-expandable__toggle { display: inline-flex; align-items: center; gap: 4px; margin-top: 8px; background: none; border: none; padding: 0; font: inherit; color: inherit; text-decoration: underline; cursor: pointer; }",
      "@media (prefers-reduced-motion: reduce) { .pb-expandable--collapsed { transition: none; } }",
    ].join("\n"),
    loadPreview: async () => (await import("../../../runtime/behaviors/expandable")).enhanceExpandable,
  },
};
