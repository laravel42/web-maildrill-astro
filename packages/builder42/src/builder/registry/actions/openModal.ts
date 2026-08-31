/**
 * `open-modal` — abre el modal cuyo id es `target` (docs/20 §3, docs/44 §2.3).
 * Primera `ActionDefinition` registrada; migra el comportamiento que antes
 * estaba hardcodeado en `exportToHtml.ts`/`NodeRenderer.tsx`
 * (`node.onClick?.type === "open-modal"`). Emite el mismo
 * `data-pb-modal-target` de siempre — el output no cambia ni un byte. El
 * runtime que lo engancha es el del propio componente `modal`
 * (`registry/behaviors/modal.ts`), no uno propio de esta acción.
 */

import type { ActionDefinition } from "../types";

export const openModalAction: ActionDefinition = {
  type: "open-modal",
  label: "Abrir modal",
  targetKind: "modal",
  dataAttributes: (action) => {
    if (!action.target) return {};
    const attrs: Record<string, string> = { "data-pb-modal-target": action.target };
    return attrs;
  },
};