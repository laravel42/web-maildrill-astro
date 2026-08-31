/**
 * Contrato de datos del Drag & Drop (docs/02 §2), agnóstico de la librería.
 *
 * Desacopla la UI de DnD de las operaciones de árbol: el handler `onDrop` solo
 * traduce `(DragData, DropData)` → `insertNode`/`moveNode`. Cambiar de librería
 * solo tocaría los wrappers de `builder/dnd/`, no el modelo (P7, docs/02 §12).
 */

import type { NodeId } from "../model/types";

/** Lo que expone un draggable. */
export type DragData =
  | { kind: "existing-node"; nodeId: NodeId }
  | { kind: "new-component"; componentType: string }
  | { kind: "fragment"; layoutId: string };

/** Lo que expone un drop target: posición de inserción resuelta. */
export interface DropData {
  parentId: NodeId;
  index: number;
  /** Celda destino (1-based) para colocación explícita en grid (docs/02 §10.4). */
  cell?: { column: number; row: number; columns: number };
}

/** Symbol para reconocer nuestros payloads dentro de Pragmatic DnD. */
export const DRAG_DATA_KEY = "page-builder/drag-data";
