/**
 * `close-modal` — cierra el `modal` contenedor más cercano (docs/44 §4 fila
 * P1). Hueco evidente: hoy se puede abrir un modal (`open-modal`) pero un
 * botón "Cancelar" DENTRO del modal no tiene forma de cerrarlo. Sin objetivo
 * (`targetKind: "none"`): actúa sobre el ancestro `modal` del propio nodo, no
 * sobre uno elegido por el usuario.
 *
 * Reutiliza el runtime YA EXISTENTE del componente `modal`
 * (`registry/behaviors/modal.ts` → `runtime/behaviors/modal.ts`): ese runtime
 * ya escucha clicks en cualquier `[data-pb-modal-close]` dentro del propio
 * `<dialog>` para cerrarlo (ver `enhanceModal`, `closeButtons`). Esta acción
 * solo necesita EMITIR ese atributo — sin `runtime` propio, igual criterio que
 * documenta `openModal.ts` para el `data-pb-modal-target`.
 *
 * Degradación sin JS (P8/P9): el `<dialog>` sin JS se muestra vía `:target`
 * (docs/20 §3.3); un botón "Cerrar" sin JS no tiene equivalente nativo para
 * quitar el `:target" de la URL salvo un enlace a `#` — fuera del alcance de
 * esta acción (el modal seguirá abierto sin JS hasta que el visitante navegue).
 * Documentado como limitación conocida, igual que el resto del comportamiento
 * de `modal` (que ya depende de JS para el ciclo completo abrir/cerrar por
 * botón; solo la apertura inicial por ancla es 100% CSS).
 */

import { getPath } from "../../model/tree";
import type { ActionDefinition } from "../types";

export const closeModalAction: ActionDefinition = {
  type: "close-modal",
  label: "Cerrar modal",
  targetKind: "none",
  appliesTo: (node, doc) => {
    // Aplica solo a nodos DENTRO de un `modal` (no al propio `modal`, que no
    // tiene sentido "cerrarse a sí mismo" vía esta acción — su propio botón
    // de cierre ya lo trae el componente). `getPath` devuelve
    // `[root, …, node.id]` inclusive; basta con que algún ancestro (excluido
    // el propio nodo) sea de tipo `modal`.
    const path = getPath(doc, node.id);
    return path.slice(0, -1).some((id) => doc.nodes[id]?.type === "modal");
  },
  dataAttributes: () => ({ "data-pb-modal-close": "" }),
};
