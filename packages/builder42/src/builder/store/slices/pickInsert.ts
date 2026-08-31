import {
  indentDropTarget,
  isDescendant,
  outdentDropTarget,
  previousSiblingIdAtIndex,
  type DropTarget,
} from "../../model/tree";
import type { NodeId } from "../../model/types";
import { canPlaceChild } from "../../registry/placement";
import { getSectionLayout, layoutFragmentRootType } from "../../registry/layoutRegistry";
import type { SliceCreator } from "./types";

/**
 * Fuente de un "pick & insert" en curso (docs/24 §3.1): qué se va a colocar.
 *  - `new`: un tipo de componente tomado desde la paleta del Sidebar — aún no
 *    existe en el árbol, se crea al confirmar (`addComponent`).
 *  - `existing`: un nodo ya presente en el árbol que se está MOVIENDO (tomado
 *    con el botón "mover" del `SelectionHandle`) — se reubica al confirmar
 *    (`moveExistingNode`).
 */
export type PickInsertSource =
  | { kind: "new"; type: string }
  | { kind: "existing"; nodeId: NodeId }
  | { kind: "fragment"; layoutId: string };

/**
 * Estado UI de un "pick & insert" en curso, o `null` si inactivo (docs/24
 * §3.1). `candidate` es el PREVIEW del destino (Fase 3, §3.2 paso 2): se
 * calcula al tocar un contenedor válido con el MISMO cómputo de proximidad
 * que el DnD (`computeDropTargetAtPoint`, `geometry.ts`), y NO muta el
 * documento (P1, igual que el placeholder del DnD, docs/02 §13) — solo
 * `confirmPickInsertTarget` (paso 3) aplica el cambio real. `null` = aún sin
 * tocar ningún destino, o se tocó uno inválido.
 */
export interface PickInsertState {
  source: PickInsertSource;
  candidate: DropTarget | null;
}

export interface PickInsertSlice {
  pickInsert: PickInsertState | null;

  // Pick & insert (Vía B, docs/24 §3). Mover/insertar sin arrastrar: tocar un
  // origen ("tomar") y luego un destino ("colocar"). Fase 2 (MVP): sin preview,
  // coloca siempre al final del contenedor tocado.
  /** Inicia pick & insert de un tipo NUEVO tomado de la paleta. No-op si ya hay uno activo. */
  startPickInsertNew: (type: string) => void;
  /** Inicia pick & insert de una plantilla de SECCIÓN (Fase 13). No-op si ya hay uno activo. */
  startPickInsertFragment: (layoutId: string) => void;
  /** Inicia pick & insert de un nodo YA EXISTENTE (botón "mover"). No-op si ya hay uno activo o si `nodeId` es la raíz. */
  startPickInsertExisting: (nodeId: NodeId) => void;
  /** Cancela el pick & insert en curso sin tocar el documento. No-op si no hay ninguno activo. */
  cancelPickInsert: () => void;
  /**
   * ¿`parentId` es un destino válido para el `pickInsert.source` activo?
   * Reusa `canPlaceChild` (type-aware, docs/23 §4) + guarda de ciclos para
   * nodos existentes. `false` si no hay pick & insert activo.
   */
  canPickInsertInto: (parentId: NodeId) => boolean;
  /**
   * Fija (o limpia, con `null`) el `candidate` de PREVIEW del pick & insert
   * activo (Fase 3, docs/24 §3.2 paso 2) — solo actualiza el estado UI, NUNCA
   * el documento (P1). No-op si no hay pick & insert activo o si `parentId`
   * no es un destino válido para el `source` actual (mismas guardas que
   * `canPickInsertInto`).
   */
  setPickInsertCandidate: (candidate: DropTarget | null) => void;
  /**
   * Confirma la colocación DENTRO de `parentId`, al final de sus hijos
   * (índice = último — el índice fino por proximidad llega en Fase 3). Llama
   * a `addComponent`/`moveExistingNode` (las MISMAS acciones que el DnD) y
   * limpia `pickInsert`. No-op si el destino no es válido o no hay pick &
   * insert activo.
   */
  confirmPickInsertTarget: (parentId: NodeId) => void;
  /**
   * Mueve el `candidate` del pick & insert activo un nivel HACIA AFUERA
   * ("salir del contenedor", docs/24 §4 — mini-dropdown de confirmación):
   * calcula el destino equivalente con `outdentDropTarget` (tree.ts, sobre el
   * `DropTarget` virtual, sin mutar el documento — P1) y lo fija como nuevo
   * `candidate` vía `setPickInsertCandidate`. No-op si no hay `candidate`
   * activo o si no hay nivel superior al que salir.
   */
  outdentPickInsertCandidate: () => void;
  /**
   * Mueve el `candidate` del pick & insert activo un nivel HACIA ADENTRO
   * ("entrar al contenedor anterior", docs/24 §4): calcula el destino
   * equivalente con `indentDropTarget` (tree.ts) y lo fija como nuevo
   * `candidate`. No-op si no hay `candidate` activo, no hay hermano anterior,
   * o ese hermano no admite el tipo del `source` (guard type-aware, mismo
   * criterio que `canIndentNode`).
   */
  indentPickInsertCandidate: () => void;
  /** ¿`outdentPickInsertCandidate` movería efectivamente el `candidate`? Selector puro para el `disabled` del botón ◀. */
  canOutdentPickInsertCandidate: () => boolean;
  /** ¿`indentPickInsertCandidate` movería efectivamente el `candidate`? Selector puro para el `disabled` del botón ▶. */
  canIndentPickInsertCandidate: () => boolean;
}

export const createPickInsertSlice: SliceCreator<PickInsertSlice> = (set, get) => ({
  pickInsert: null,

  // --- Pick & insert (Vía B, docs/24 §3) -------------------------------
  startPickInsertNew: (type) => {
    if (get().pickInsert) return; // no-op: ya hay uno activo
    set({ pickInsert: { source: { kind: "new", type }, candidate: null } });
  },

  startPickInsertFragment: (layoutId) => {
    if (get().pickInsert) return;
    // Solo secciones: una plantilla de página no se inserta dentro del árbol
    // (reemplaza el documento) y su fragmento es perezoso (docs/48 §4).
    if (!getSectionLayout(layoutId)) return;
    set({ pickInsert: { source: { kind: "fragment", layoutId }, candidate: null } });
  },

  startPickInsertExisting: (nodeId) => {
    const { pickInsert, document } = get();
    if (pickInsert) return; // no-op: ya hay uno activo
    if (nodeId === document.rootId) return; // la raíz no se puede mover
    set({ pickInsert: { source: { kind: "existing", nodeId }, candidate: null } });
  },

  cancelPickInsert: () => set({ pickInsert: null }),

  canPickInsertInto: (parentId) => {
    const { pickInsert, document } = get();
    if (!pickInsert) return false;
    const parent = document.nodes[parentId];
    if (!parent) return false;
    const { source } = pickInsert;
    if (source.kind === "new") {
      return canPlaceChild(parent.type, source.type);
    }
    if (source.kind === "fragment") {
      const childType = layoutFragmentRootType(source.layoutId);
      if (!childType) return false;
      return canPlaceChild(parent.type, childType);
    }
    // Nodo existente: mismas guardas que `moveNode` (docs/02 §1) — nunca
    // dentro de sí mismo ni de su propio subárbol (cycle guard).
    if (source.nodeId === parentId) return false;
    if (isDescendant(document, source.nodeId, parentId)) return false;
    const childType = document.nodes[source.nodeId]?.type;
    if (!childType) return false;
    return canPlaceChild(parent.type, childType);
  },

  setPickInsertCandidate: (candidate) => {
    const { pickInsert } = get();
    if (!pickInsert) return;
    if (candidate && !get().canPickInsertInto(candidate.parentId)) return;
    set({ pickInsert: { ...pickInsert, candidate } });
  },

  confirmPickInsertTarget: (parentId) => {
    const { pickInsert } = get();
    if (!pickInsert) return;
    if (!get().canPickInsertInto(parentId)) return;
    const doc = get().document;
    // Usa el índice fino del `candidate` (Fase 3, preview por proximidad)
    // si coincide con el `parentId` confirmado; si no hay candidate para
    // este destino (p. ej. confirmación directa sin preview previo), cae
    // al FINAL del contenedor — mismo comportamiento que la Fase 2 MVP.
    const index =
      pickInsert.candidate && pickInsert.candidate.parentId === parentId
        ? pickInsert.candidate.index
        : doc.nodes[parentId]?.children?.length ?? 0;
    const target: DropTarget = { parentId, index };
    const { source } = pickInsert;
    set({ pickInsert: null });
    if (source.kind === "new") {
      get().addComponent(source.type, target);
    } else if (source.kind === "fragment") {
      const layout = getSectionLayout(source.layoutId);
      if (!layout) return;
      get().insertFragment(layout.build(), target);
    } else {
      get().moveExistingNode(source.nodeId, target);
      set({ selectedId: source.nodeId });
    }
  },

  outdentPickInsertCandidate: () => {
    const { pickInsert, document } = get();
    const candidate = pickInsert?.candidate;
    if (!candidate) return;
    const next = outdentDropTarget(document, candidate);
    if (!next) return;
    get().setPickInsertCandidate(next);
  },

  indentPickInsertCandidate: () => {
    const { pickInsert, document } = get();
    const candidate = pickInsert?.candidate;
    if (!candidate) return;
    const next = indentDropTarget(document, candidate);
    if (!next) return;
    // Guard type-aware (P4 + docs/23 §4): el hermano anterior debe poder
    // alojar el tipo del `source` — mismo criterio que `canIndentNode`.
    const prevId = previousSiblingIdAtIndex(document, candidate.parentId, candidate.index);
    const prevType = prevId ? document.nodes[prevId]?.type : undefined;
    const sourceType = pickInsertSourceType(pickInsert!.source, document);
    if (!prevType || !sourceType || !canPlaceChild(prevType, sourceType)) return;
    get().setPickInsertCandidate(next);
  },

  canOutdentPickInsertCandidate: () => {
    const { pickInsert, document } = get();
    const candidate = pickInsert?.candidate;
    if (!candidate) return false;
    return outdentDropTarget(document, candidate) !== null;
  },

  canIndentPickInsertCandidate: () => {
    const { pickInsert, document } = get();
    const candidate = pickInsert?.candidate;
    if (!candidate) return false;
    const prevId = previousSiblingIdAtIndex(document, candidate.parentId, candidate.index);
    if (!prevId) return false;
    const prevType = document.nodes[prevId]?.type;
    const sourceType = pickInsertSourceType(pickInsert!.source, document);
    if (!prevType || !sourceType) return false;
    return canPlaceChild(prevType, sourceType);
  },
});

function pickInsertSourceType(
  source: PickInsertSource,
  document: import("../../model/types").BuilderDocument,
): string | undefined {
  if (source.kind === "new") return source.type;
  if (source.kind === "fragment") return layoutFragmentRootType(source.layoutId);
  return document.nodes[source.nodeId]?.type;
}
