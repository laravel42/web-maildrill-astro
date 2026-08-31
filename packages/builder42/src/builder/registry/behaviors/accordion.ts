/**
 * Accordion — behavior del componente `accordion` (Bloque D, docs/16 §12.4).
 * Interactivo con runtime vanilla propio (sin dependencia npm, como
 * `reveal-on-scroll`/`theme-toggle`): animación de apertura/cierre con WAAPI +
 * "solo una sección abierta". El componente `accordion` lo trae de fábrica vía
 * `ComponentDefinition.defaultBehaviors`, así que aplica solo a ese tipo.
 *
 * Degradación sin JS (P8/P9): el componente emite `<details>/<summary>`
 * nativos; sin este runtime, colapsan igual (solo sin animación). El JS es
 * puro pulido, nunca requisito para leer el contenido.
 */

import type { BehaviorDefinition } from "../types";

export const accordionBehavior: BehaviorDefinition = {
  type: "accordion",
  label: "Acordeón (animado)",
  category: "structure",
  // Solo tiene sentido sobre el propio componente accordion (trae la estructura
  // `<details class="pb-accordion__item">` que el runtime espera).
  appliesTo: (node) => node.type === "accordion",
  defaultOptions: { single: true, duration: 280 },
  optionsSchema: {
    fields: [
      { key: "single", label: "Solo una sección abierta", control: "toggle", group: "Acordeón" },
      { key: "duration", label: "Duración (ms)", control: "number", group: "Acordeón", placeholder: "280" },
    ],
  },
  runtime: {
    moduleId: "accordion",
    enhance: "enhanceAccordion",
    // CSS presentacional migrado a `ComponentDefinition.css` (T10, AGENTS.md,
    // `registry/components/Accordion.tsx`): ya no depende de que este
    // behavior esté adjunto — el `<details>` nativo sigue viéndose bien sin JS.
    // El accordion oculta contenido cuando está hidratado (secciones colapsadas):
    // en Edit el runtime NUNCA corre, así que el canvas debe mostrar todo el
    // contenido (ver `Accordion.tsx`, que fuerza `open` fuera de export). El flag
    // documenta esa naturaleza (AGENTS.md §5).
    clipsContentWhenActive: true,
    loadPreview: async () => (await import("../../../runtime/behaviors/accordion")).enhanceAccordion,
  },
};
