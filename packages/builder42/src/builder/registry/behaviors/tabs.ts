/**
 * Tabs — behavior del componente `tabs` (Bloque D, docs/16 §12.4 #22). Runtime
 * vanilla propio (sin dependencia npm): muestra el panel activo, transición
 * fade+slide, navegación por teclado (flechas/Home/End) según WAI-ARIA. El
 * componente `tabs` lo trae de fábrica.
 *
 * Degradación sin JS (P8/P9): el componente emite todos los paneles VISIBLES
 * (apilados); sin este runtime el contenido es accesible, solo sin el
 * comportamiento de pestañas.
 */

import type { BehaviorDefinition } from "../types";

export const tabsBehavior: BehaviorDefinition = {
  type: "tabs",
  label: "Pestañas (animadas)",
  category: "structure",
  appliesTo: (node) => node.type === "tabs",
  defaultOptions: { duration: 220 },
  optionsSchema: {
    fields: [{ key: "duration", label: "Duración (ms)", control: "number", group: "Pestañas", placeholder: "220" }],
  },
  runtime: {
    moduleId: "tabs",
    enhance: "enhanceTabs",
    // CSS presentacional migrado a `ComponentDefinition.css` (T10, AGENTS.md,
    // `registry/components/Tabs.tsx`): ya no depende de que este behavior
    // esté adjunto — el componente `tabs` sigue viéndose bien sin JS.
    // Los tabs ocultan los paneles inactivos cuando están hidratados: en Edit el
    // runtime nunca corre, así que el canvas muestra todos los paneles (ver
    // `Tabs.tsx`). Flag documental (AGENTS.md §5).
    clipsContentWhenActive: true,
    loadPreview: async () => (await import("../../../runtime/behaviors/tabs")).enhanceTabs,
  },
};
