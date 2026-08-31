/**
 * `submit-form` — envía el `form` ancestro más cercano al hacer click
 * (docs/44 §4 fila P2). Completa la Fase 10 de formularios: hoy solo
 * `button-submit` (`<button type="submit">`) puede enviar un form sin JS;
 * esta acción lleva el mismo efecto a CUALQUIER nodo dentro de un `form`
 * (un `icon`, una `card` usada como CTA de envío…).
 *
 * `targetKind: "none"`: no hay un nodo/modal que elegir — el objetivo es el
 * `<form>` ancestro real en el DOM, resuelto por el runtime vía
 * `el.closest("form")` (`runtime/actions/formActions.ts`), NO por un nodeId
 * referenciado (a diferencia de `scroll-to`/`close-modal`). Por eso no
 * necesita el patrón `getPath` sobre el ÁRBOL — pero `appliesTo` SÍ lo usa
 * (mismo patrón que `closeModal.ts`) para restringir la acción a nodos que
 * estén, en el DOCUMENTO, dentro de un `form`: sin esa restricción la acción
 * aparecería en el catálogo de nodos sueltos que nunca podrían ejecutarla
 * (ningún `<form>` ancestro en el DOM tampoco).
 *
 * Excluye `button-submit` (`disallowsClickAction: true`, `Button.tsx`): su
 * click nativo ya envía el form, una acción adicional sería redundante y
 * correría el riesgo de doble-submit si además tuviera runtime. No hace
 * falta que este `appliesTo` lo excluya explícitamente — el filtro por
 * `disallowsClickAction` vive en una capa MÁS ARRIBA, antes de que
 * `actionsForNode` (y por tanto este `appliesTo`) se consulte siquiera:
 * `InspectorForm.tsx` (`hasClickAction`) ni monta `NodeClickActionSection`
 * para un nodo así, y `setNodeAction` (`store/slices/behaviors.ts`) rechaza
 * escribir una acción en él aunque se intentara por otra vía. Mismo criterio
 * ya aplicado a `text`/`input`/`textarea`/`select`.
 *
 * Verdadero tier 0 solo sería posible envolviendo el trigger en un
 * `<button type="submit">` real — pero esta acción se ofrece en cualquier
 * nodo, no solo en botones, así que se opta por runtime (`form.requestSubmit()`)
 * + degradación documentada, mismo criterio que el resto de la Fase 4.
 *
 * Degradación sin JS (P8/P9): SIN el runtime, el click no envía el form — el
 * contenido sigue visible/usable, misma limitación aceptada para `scroll-to`/
 * `close-modal`. Si se necesita envío sin JS, la vía nativa ya existe:
 * `button-submit` dentro del `form`.
 */

import { getPath } from "../../model/tree";
import type { ActionDefinition } from "../types";

export const submitFormAction: ActionDefinition = {
  type: "submit-form",
  label: "Enviar formulario",
  targetKind: "none",
  appliesTo: (node, doc) => {
    // Aplica solo a nodos DENTRO de un `form` (no al propio `form`, que no
    // tiene sentido "enviarse a sí mismo" por click de todo el contenedor —
    // mismo criterio que `close-modal` con `modal`). `getPath` devuelve
    // `[root, …, node.id]` inclusive; basta con que algún ancestro (excluido
    // el propio nodo) sea de tipo `form`.
    const path = getPath(doc, node.id);
    return path.slice(0, -1).some((id) => doc.nodes[id]?.type === "form");
  },
  dataAttributes: () => ({ "data-pb-submit-form": "" }),
  runtime: {
    moduleId: "formActions",
    enhance: "enhanceSubmitForm",
    loadPreview: async () => {
      const { enhanceSubmitForm } = await import("../../../runtime/actions/formActions");
      return (el) => enhanceSubmitForm(el);
    },
  },
};
