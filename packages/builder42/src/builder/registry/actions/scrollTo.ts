/**
 * `scroll-to` — scroll suave a otro nodo del documento (docs/44 §4 fila P1).
 * Lleva a CUALQUIER nodo (una `card` entera, un `container`, una `image`) el
 * comportamiento que hoy solo existe para nodos-enlace vía
 * `LinkTarget.kind:"anchor"` (`href="#<id>"` + `scroll-behavior:smooth`).
 *
 * D4 resuelta, opción (a) (docs/44 §8.4): esta acción NO se ofrece en nodos
 * que ya tengan un campo `link` con valor real — esos nodos ya tienen su
 * propio mecanismo de ancla nativo (`LinkTarget.kind:"anchor"`), y ofrecer
 * `scroll-to` además sería un segundo camino para lo mismo. Implementado en
 * `appliesTo`, no en la UI (la UI solo consulta `actionsForNode`).
 *
 * `targetKind: "node"`: el picker de objetivo lo aporta
 * `NodeClickActionSection.tsx` (selector de nodos con buscador, Fase 2).
 *
 * El nodo TARGET necesita ser localizable en el DOM exportado: lo resuelve el
 * mecanismo genérico `nodesReferencedAsTarget` (`exportToHtml.ts`) — un nodo
 * referenciado por `targetKind: "node"` de cualquier acción gana `id="<id>"`
 * en su elemento raíz. El core no sabe que es "scroll-to" (P4): solo sabe que
 * alguna acción lo señaló como target.
 *
 * Sin `runtime` propio: el disparador es un ancla real (`href="#<id>"`, ver
 * `dataAttributes`) siempre que el nodo lo permita (P8/P9 — funciona SIN JS,
 * con scroll instantáneo si el navegador no anima `scroll-behavior:smooth`
 * por CSS). El único caso que necesita JS es un nodo que no puede tener
 * `href` nativo (no es un `<a>`) — ver nota en `dataAttributes` y la
 * limitación documentada abajo.
 *
 * `scroll-to-top` (docs/44 §4 fila P2) — PRESET de esta misma acción, no una
 * `ActionDefinition` aparte. El plan lo sugiere explícitamente ("caso
 * particular de scroll-to; se implementa como preset, no como acción
 * aparte, si el picker lo permite") y el picker sí lo permite: basta con una
 * opción especial en `NodeTargetPicker.tsx` que escriba
 * `params: { preset: "top" }` en vez de un `target: NodeId` real. Se prefirió
 * el preset sobre una acción `scroll-to-top` separada por dos razones: (1)
 * evita una segunda entrada en el catálogo del Inspector para un
 * comportamiento que ya es 95% igual (mismo runtime, misma a11y, mismo
 * `appliesTo`/D4); (2) reutiliza `enhanceScrollTo` sin bifurcar el módulo —
 * solo cambia CÓMO se resuelve el destino (constante `window.scrollTo(0,0)`
 * en vez de `getElementById`), no el resto del ciclo (a11y sintética,
 * teclado, cleanup). El sentinel `params.preset === "top"` NUNCA se escribe
 * en `target` (que sigue siendo `NodeId | undefined`, un id de nodo real o
 * nada): así `nodesReferencedAsTarget` (`exportToHtml.ts`) no lo confunde con
 * una referencia a un nodo que no existe — un preset sin `target` no entra a
 * ese set y ningún nodo gana un `id` espurio por su causa.
 */

import { getDefinition } from "../componentRegistry";
import { activeLinkKeys } from "../../model/nodeAction";
import type { ActionDefinition } from "../types";

export const scrollToAction: ActionDefinition = {
  type: "scroll-to",
  label: "Desplazar a",
  targetKind: "node",
  appliesTo: (node) => {
    const def = getDefinition(node.type);
    if (!def) return true;
    // D4 (a): si el nodo ya tiene un `link` con valor real, no se le ofrece
    // `scroll-to` (evita dos caminos para lo mismo — docs/44 §8.4).
    return activeLinkKeys(node, def.propsSchema.fields).length === 0;
  },
  dataAttributes: (action) => {
    // Preset "inicio de página" (docs/44 §4 fila P2): sin nodeId real, marca
    // el atributo con el sentinel "__top__" que `enhanceScrollTo` reconoce
    // como caso especial (no un id a buscar con `getElementById`).
    if (action.params?.preset === "top") return { "data-pb-scroll-to": "__top__" };
    return action.target ? { "data-pb-scroll-to": action.target } : ({} as Record<string, string>);
  },
  // Runtime propio (docs/44 §4 fila P1, ver `runtime/actions/scrollTo.ts` para
  // la justificación completa de por qué NO es tier 0 puro): cualquier nodo
  // puede llevar esta acción, incluyendo componentes que no renderizan un
  // `<a>` — sin JS no hay ningún `href` nativo que el navegador pueda seguir.
  runtime: {
    moduleId: "scrollTo",
    enhance: "enhanceScrollTo",
    loadPreview: async () => {
      const { enhanceScrollTo } = await import("../../../runtime/actions/scrollTo");
      return (el) => enhanceScrollTo(el);
    },
  },
};
