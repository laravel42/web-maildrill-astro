/**
 * `reset-form` — limpia el `form` ancestro más cercano al hacer click
 * (docs/44 §4 fila P2). Análoga a `submit-form` (mismo archivo de referencia
 * para el razonamiento completo de `appliesTo`/tier/degradación); esta acción
 * cubre el caso "reset" en vez de "submit". No existe un `button-reset` en el
 * catálogo (confirmado: `registry/components/Button.tsx` solo declara
 * `button`/`button-submit`), así que hoy NO hay ningún componente cuyo click
 * nativo ya limpie el form — a diferencia de `submit-form`, esta acción no
 * tiene un equivalente `disallowsClickAction` que la haga redundante en algún
 * componente existente.
 *
 * `targetKind: "none"`, mismo `appliesTo` por `getPath` que `submit-form`
 * (dentro de un `form`, excluyendo al propio `form`). Runtime compartido con
 * `submit-form` en un solo módulo (`runtime/actions/formActions.ts`,
 * `moduleId: "formActions"`) — la lógica de localizar el `<form>` ancestro
 * real vía `el.closest("form")` y la gestión de a11y es idéntica entre
 * enviar/limpiar, solo cambia el método invocado (`requestSubmit()` vs
 * `reset()`); dos módulos separados solo duplicarían ese código común.
 *
 * Degradación sin JS (P8/P9): SIN el runtime, el click no limpia el form —
 * mismo criterio que `submit-form`/`scroll-to`/`close-modal`.
 */

import { getPath } from "../../model/tree";
import type { ActionDefinition } from "../types";

export const resetFormAction: ActionDefinition = {
  type: "reset-form",
  label: "Limpiar formulario",
  targetKind: "none",
  appliesTo: (node, doc) => {
    const path = getPath(doc, node.id);
    return path.slice(0, -1).some((id) => doc.nodes[id]?.type === "form");
  },
  dataAttributes: () => ({ "data-pb-reset-form": "" }),
  runtime: {
    moduleId: "formActions",
    enhance: "enhanceResetForm",
    loadPreview: async () => {
      const { enhanceResetForm } = await import("../../../runtime/actions/formActions");
      return (el) => enhanceResetForm(el);
    },
  },
};
