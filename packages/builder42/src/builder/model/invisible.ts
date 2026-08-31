/**
 * Elementos no-visibles (docs/20 §1) — nodos que en el render de la página no se
 * ven hasta cierta condición (un `modal` cerrado; un nodo `display:none` en el
 * breakpoint activo; futuros). Se listan y se alcanzan desde la burbuja
 * flotante del canvas.
 *
 * Puro y testeable (P7): sin React ni DOM. El core no hace `switch(type)`
 * disperso — este helper es el único punto que decide qué es "no-visible".
 */

import type { Breakpoint, BreakpointConfig, BuilderDocument, BuilderNode } from "./types";
import { isHiddenAt } from "./visibility";

/** ¿El nodo es "no-visible" en el canvas actual y debe listarse en la burbuja? */
export function isInvisibleNode(node: BuilderNode, bp: Breakpoint, cfg: BreakpointConfig): boolean {
  if (node.type === "modal") return true; // siempre no-visible (elemento con overlay)
  return isHiddenAt(node.style, bp, cfg); // display:none en el breakpoint activo
}

/**
 * Lista los nodos no-visibles de un documento, en orden estable por id (para
 * que la burbuja no reordene la lista de forma arbitraria entre renders).
 */
export function listInvisibleNodes(
  doc: BuilderDocument,
  bp: Breakpoint,
  cfg: BreakpointConfig,
): BuilderNode[] {
  return Object.values(doc.nodes)
    .filter((n) => n.id !== doc.rootId && isInvisibleNode(n, bp, cfg))
    .sort((a, b) => a.id.localeCompare(b.id));
}
