/**
 * Toggle — behavior de referencia genérico (docs/10 §1, §8.4). Aplica a
 * CUALQUIER nodo (sin `appliesTo`, como `reveal-on-scroll`/`theme-toggle`):
 * alterna `aria-pressed` en el propio elemento al hacer click. El usuario
 * estila el resultado visual desde el estado "Activo" del Inspector (T9,
 * `styleSchema` no declara `states` — el estado se agrega dinámicamente en
 * `InspectorForm.tsx` cuando el nodo tiene este behavior adjunto, ya que
 * aplica a cualquier tipo de componente, no a uno declarado en su schema).
 *
 * Sin persistencia (a diferencia de `theme-toggle`): es estado de sesión,
 * pensado como bloque genérico (like/favorito visual, icono que cambia de
 * apariencia al presionar, disclosure custom…) — no un concepto de dominio.
 */

import type { BehaviorDefinition } from "../types";

export const toggleBehavior: BehaviorDefinition = {
  type: "toggle",
  label: "Alternar estado al click",
  category: "interactive",
  // Sin `appliesTo`: aplica a todos los tipos de nodo.
  defaultOptions: { pressed: false },
  optionsSchema: {
    fields: [{ key: "pressed", label: "Iniciar activo", control: "toggle", group: "Toggle" }],
  },
  runtime: {
    moduleId: "toggle",
    enhance: "enhanceToggle",
    loadPreview: async () => (await import("../../../runtime/behaviors/toggle")).enhanceToggle,
  },
};
