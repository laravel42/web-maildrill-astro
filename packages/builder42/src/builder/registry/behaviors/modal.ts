/**
 * Modal — behavior del componente `modal` (Bloque D, docs/16 §12.4 #23).
 * Runtime vanilla propio (sin dependencia npm): eleva un `<dialog>` nativo a
 * modal con `showModal()` (focus-trap e `inert` nativos), cierre por backdrop/
 * Escape/botón, y transición WAAPI. El componente `modal` lo trae de fábrica.
 *
 * Degradación sin JS (P8/P9): el disparador es un ancla `href="#<id>"` y el
 * `<dialog>` se muestra vía CSS `:target`; el contenido es accesible sin JS.
 */

import type { BehaviorDefinition } from "../types";

export const modalBehavior: BehaviorDefinition = {
  type: "modal",
  label: "Modal (ventana emergente)",
  category: "structure",
  appliesTo: (node) => node.type === "modal",
  defaultOptions: { closeOnBackdrop: true, duration: 200 },
  optionsSchema: {
    fields: [
      { key: "closeOnBackdrop", label: "Cerrar al hacer click fuera", control: "toggle", group: "Modal" },
      { key: "duration", label: "Duración (ms)", control: "number", group: "Modal", placeholder: "200" },
    ],
  },
  runtime: {
    moduleId: "modal",
    enhance: "enhanceModal",
    // CSS presentacional migrado a `ComponentDefinition.css` (T10, AGENTS.md,
    // `registry/components/Modal.tsx`): ya no depende de que este behavior
    // esté adjunto — el fallback sin JS (`:target`) sigue mostrando el modal.
    // El modal oculta su contenido cuando está hidratado (diálogo cerrado): en
    // Edit el runtime nunca corre, así que el canvas fuerza el diálogo visible
    // (ver `Modal.tsx`). Flag documental (AGENTS.md §5).
    clipsContentWhenActive: true,
    loadPreview: async () => (await import("../../../runtime/behaviors/modal")).enhanceModal,
  },
};
