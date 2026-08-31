/**
 * Reordenamiento por teclado (a11y, Fase 4). Operan sobre `document` con las
 * ops puras de tree.ts; `indentNode` respeta `acceptsChildren` del registry.
 */
import {
  canOutdentNode,
  canReorderWithinParent,
  findParentId,
  indentIntoPreviousSibling,
  outdentNode,
  previousSiblingId,
  reorderWithinParent,
} from "../../model/tree";
import { canPlaceChild } from "../../registry/placement";
import type { NodeId } from "../../model/types";
import type { SliceCreator } from "./types";

export interface ReorderSlice {
  reorderNode: (nodeId: NodeId, delta: number) => void;
  outdentNodeAction: (nodeId: NodeId) => void;
  indentNode: (nodeId: NodeId) => void;
  // Selectores puros de disponibilidad (docs/24 §2.1): reflejan si la acción
  // correspondiente movería efectivamente el nodo, SIN ejecutarla — usados
  // por los botones ▲▼◀▶ de `SelectionHandle` para su estado `disabled`.
  canReorderNode: (nodeId: NodeId, delta: number) => boolean;
  canOutdentSelected: (nodeId: NodeId) => boolean;
  canIndentNode: (nodeId: NodeId) => boolean;
}

export const createReorderSlice: SliceCreator<ReorderSlice> = (set, get) => ({
  reorderNode: (nodeId, delta) => {
    set({ document: reorderWithinParent(get().document, nodeId, delta) });
  },

  outdentNodeAction: (nodeId) => {
    set({ document: outdentNode(get().document, nodeId) });
  },

  indentNode: (nodeId) => {
    const doc = get().document;
    const parentId = findParentId(doc, nodeId);
    if (parentId === null) return;
    const children = doc.nodes[parentId]?.children ?? [];
    const idx = children.indexOf(nodeId);
    if (idx <= 0) return; // sin hermano anterior
    // Guard type-aware (P4 + docs/23 §4): el hermano anterior debe poder
    // alojar este nodo (respeta composites/slots, no solo `acceptsChildren`).
    const prevId = children[idx - 1]!;
    const prevType = doc.nodes[prevId]?.type;
    const nodeType = doc.nodes[nodeId]?.type;
    if (!prevType || !nodeType || !canPlaceChild(prevType, nodeType)) return;
    set({ document: indentIntoPreviousSibling(doc, nodeId) });
  },

  // --- Selectores de disponibilidad (docs/24 §2.1) --------------------
  canReorderNode: (nodeId, delta) => canReorderWithinParent(get().document, nodeId, delta),
  canOutdentSelected: (nodeId) => canOutdentNode(get().document, nodeId),
  canIndentNode: (nodeId) => {
    const doc = get().document;
    const prevId = previousSiblingId(doc, nodeId);
    if (!prevId) return false;
    const prevType = doc.nodes[prevId]?.type;
    const nodeType = doc.nodes[nodeId]?.type;
    if (!prevType || !nodeType) return false;
    return canPlaceChild(prevType, nodeType);
  },
});
