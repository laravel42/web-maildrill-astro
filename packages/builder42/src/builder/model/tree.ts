/**
 * Operaciones puras sobre el árbol normalizado (P7, docs/02 §1).
 *
 * Sin React, sin DnD, sin store: funciones deterministas `doc -> doc` que
 * NUNCA mutan la entrada. Son el corazón del builder y se testean aisladas.
 *
 * Invariantes garantizadas (docs/02 §1):
 * - Un nodo aparece exactamente una vez en algún `children` (salvo la raíz).
 * - Nunca se mueve un nodo dentro de sí mismo o de un descendiente (cycle guard).
 * - `index` se clampa a `[0, children.length]`.
 *
 * La validación de "solo contenedores con `acceptsChildren` pueden ser padres"
 * vive en la capa DnD (`canDrop`), que conoce el registry; aquí el árbol es
 * agnóstico del tipo (P4).
 */

import { canPlaceChild } from "../registry/placement";
import type { BuilderDocument, BuilderNode, NodeId, NodeTranslations } from "./types";

/** Subárbol portable (plantilla, IA, pegado) listo para insertar en un documento. */
export interface NodeFragment {
  rootId: NodeId;
  nodes: Record<NodeId, BuilderNode>;
  /** Traducciones i18n del fragmento, keyed por id de nodo del fragmento. */
  translations?: Record<NodeId, NodeTranslations>;
}

export interface InsertFragmentResult {
  document: BuilderDocument;
  /** Id remapeado de la raíz del fragmento tras la inserción. */
  insertedRootId: NodeId;
  /** Traducciones keyed por los ids NUEVOS remapeados. */
  translations: Record<NodeId, NodeTranslations>;
}

export interface InsertFragmentOptions {
  idGenerator?: () => string;
  canPlace?: (parentType: string, childType: string) => boolean;
}

/** Destino de una inserción: contenedor + posición en su `children`. */
export interface DropTarget {
  parentId: NodeId;
  index: number;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/** Devuelve el id del padre que contiene a `nodeId`, o `null` si no tiene (raíz/huérfano). */
export function findParentId(doc: BuilderDocument, nodeId: NodeId): NodeId | null {
  for (const id of Object.keys(doc.nodes)) {
    const node = doc.nodes[id];
    if (node?.children?.includes(nodeId)) return id;
  }
  return null;
}

/**
 * Ruta de ancestros desde la raíz hasta `nodeId` (inclusive): `[root, …, nodeId]`.
 * Para el parent selector / breadcrumb (docs/02 §11.5). Devuelve `[]` si el nodo
 * no existe. Guarda contra ciclos por si el árbol estuviera corrupto.
 */
export function getPath(doc: BuilderDocument, nodeId: NodeId): NodeId[] {
  const path: NodeId[] = [];
  const seen = new Set<NodeId>();
  let current: NodeId | null = nodeId;
  while (current !== null && doc.nodes[current] && !seen.has(current)) {
    seen.add(current);
    path.unshift(current);
    current = findParentId(doc, current);
  }
  return path;
}

/**
 * ¿Es `maybeChildId` un descendiente de `ancestorId` (a cualquier profundidad)?
 * Guarda de ciclos: impide anidar un contenedor dentro de su propio subárbol.
 */
export function isDescendant(
  doc: BuilderDocument,
  ancestorId: NodeId,
  maybeChildId: NodeId,
): boolean {
  const ancestor = doc.nodes[ancestorId];
  if (!ancestor?.children) return false;
  const stack = [...ancestor.children];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === maybeChildId) return true;
    const node = doc.nodes[current];
    if (node?.children) stack.push(...node.children);
  }
  return false;
}

/** Todos los ids del subárbol con raíz en `nodeId` (incluye `nodeId`). */
export function collectSubtree(doc: BuilderDocument, nodeId: NodeId): NodeId[] {
  const result: NodeId[] = [];
  const stack: NodeId[] = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.push(current);
    const node = doc.nodes[current];
    if (node?.children) stack.push(...node.children);
  }
  return result;
}

/** Quita `nodeId` del `children` de su padre SIN borrar el nodo de `doc.nodes`. */
function detachFromParent(doc: BuilderDocument, nodeId: NodeId): BuilderDocument {
  const parentId = findParentId(doc, nodeId);
  if (parentId === null) return doc;
  const parent = doc.nodes[parentId]!;
  const nextChildren = (parent.children ?? []).filter((c) => c !== nodeId);
  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [parentId]: { ...parent, children: nextChildren },
    },
  };
}

/**
 * Inserta `nodeId` (ya presente en `doc.nodes`, típicamente recién creado o
 * previamente desanclado) dentro de `target.parentId` en `target.index`.
 * Clampa el índice. No-op si el padre no existe.
 */
export function insertNode(
  doc: BuilderDocument,
  nodeId: NodeId,
  target: DropTarget,
): BuilderDocument {
  const parent = doc.nodes[target.parentId];
  if (!parent) return doc;
  const children = parent.children ?? [];
  const index = clamp(target.index, 0, children.length);
  const nextChildren = [...children];
  nextChildren.splice(index, 0, nodeId);
  return {
    ...doc,
    nodes: {
      ...doc.nodes,
      [target.parentId]: { ...parent, children: nextChildren },
    },
  };
}

/**
 * Mueve un nodo existente a `target` (remove + insert, docs/02 §1).
 * No-op protegido por las guardas: no se mueve la raíz, ni dentro de sí mismo,
 * ni dentro de un descendiente (cycle guard).
 */
export function moveNode(
  doc: BuilderDocument,
  nodeId: NodeId,
  target: DropTarget,
): BuilderDocument {
  if (nodeId === doc.rootId) return doc;
  if (nodeId === target.parentId) return doc;
  if (!doc.nodes[nodeId]) return doc;
  if (isDescendant(doc, nodeId, target.parentId)) return doc;
  const detached = detachFromParent(doc, nodeId);
  return insertNode(detached, nodeId, target);
}

/**
 * Elimina `nodeId` y todo su subárbol de `doc.nodes`, y lo quita del `children`
 * de su padre (limpia huérfanos, docs/02 §1). No-op si es la raíz.
 */
export function removeNode(doc: BuilderDocument, nodeId: NodeId): BuilderDocument {
  if (nodeId === doc.rootId) return doc;
  if (!doc.nodes[nodeId]) return doc;
  const subtree = new Set(collectSubtree(doc, nodeId));
  const parentId = findParentId(doc, nodeId);
  const nextNodes: Record<NodeId, BuilderNode> = {};
  for (const id of Object.keys(doc.nodes)) {
    if (!subtree.has(id)) nextNodes[id] = doc.nodes[id]!;
  }
  if (parentId !== null && nextNodes[parentId]) {
    const parent = nextNodes[parentId]!;
    nextNodes[parentId] = {
      ...parent,
      children: (parent.children ?? []).filter((c) => c !== nodeId),
    };
  }
  return { ...doc, nodes: nextNodes };
}

// ---------------------------------------------------------------------------
// Reordenamiento por teclado (a11y, Fase 4 · docs/04 §Fase 4)
//
// Ops puras `doc -> doc` que mapean los gestos de teclado a movimientos de
// árbol, reusando las primitivas de arriba (P7). Son type-agnósticas (P4): el
// caller (store, que conoce el registry) decide si un destino admite hijos.
// ---------------------------------------------------------------------------

/** Índice de `nodeId` dentro del `children` de su padre, o -1. */
export function indexInParent(doc: BuilderDocument, nodeId: NodeId): number {
  const parentId = findParentId(doc, nodeId);
  if (parentId === null) return -1;
  return doc.nodes[parentId]?.children?.indexOf(nodeId) ?? -1;
}

/**
 * ¿`reorderWithinParent(doc, nodeId, delta)` movería efectivamente el nodo?
 * Selector puro (P7) que replica las guardas de `reorderWithinParent` SIN
 * ejecutar el movimiento — usado para reflejar el estado `disabled` de los
 * botones ▲▼ (docs/24 §2.1) sin mutar ni comparar snapshots.
 */
export function canReorderWithinParent(
  doc: BuilderDocument,
  nodeId: NodeId,
  delta: number,
): boolean {
  if (nodeId === doc.rootId) return false;
  const parentId = findParentId(doc, nodeId);
  if (parentId === null) return false;
  const children = doc.nodes[parentId]?.children ?? [];
  const from = children.indexOf(nodeId);
  if (from === -1) return false;
  const to = from + delta;
  return to >= 0 && to < children.length;
}

/**
 * ¿`outdentNode(doc, nodeId)` movería efectivamente el nodo? Selector puro
 * (P7) que replica las guardas de `outdentNode` sin ejecutar — usado para el
 * estado `disabled` del botón ◀ (docs/24 §2.1).
 */
export function canOutdentNode(doc: BuilderDocument, nodeId: NodeId): boolean {
  const parentId = findParentId(doc, nodeId);
  if (parentId === null || parentId === doc.rootId) return false;
  const grandParentId = findParentId(doc, parentId);
  if (grandParentId === null) return false;
  const parentIndex = doc.nodes[grandParentId]?.children?.indexOf(parentId) ?? -1;
  return parentIndex !== -1;
}

/**
 * ¿Hay un hermano anterior en el que `indentIntoPreviousSibling(doc, nodeId)`
 * podría anidar el nodo? Selector puro (P7) que replica SOLO la guarda
 * estructural (hermano anterior existe) — el guard type-aware (`canPlaceChild`,
 * docs/23 §4) vive en el store, que conoce el registry (P4), así que el
 * caller debe combinar este resultado con esa validación para el estado
 * `disabled` real del botón ▶ (docs/24 §2.1).
 */
export function hasPreviousSiblingForIndent(doc: BuilderDocument, nodeId: NodeId): boolean {
  const parentId = findParentId(doc, nodeId);
  if (parentId === null) return false;
  const children = doc.nodes[parentId]?.children ?? [];
  const idx = children.indexOf(nodeId);
  return idx > 0;
}

/** Id del hermano anterior de `nodeId` (para el guard type-aware de indent), o `null`. */
export function previousSiblingId(doc: BuilderDocument, nodeId: NodeId): NodeId | null {
  const parentId = findParentId(doc, nodeId);
  if (parentId === null) return null;
  const children = doc.nodes[parentId]?.children ?? [];
  const idx = children.indexOf(nodeId);
  if (idx <= 0) return null;
  return children[idx - 1] ?? null;
}

/**
 * Reordena `nodeId` entre sus hermanos moviéndolo `delta` posiciones
 * (`-1` = arriba/antes, `+1` = abajo/después). No-op si es la raíz, no tiene
 * padre, o el destino cae fuera de `[0, len-1]` (extremos). Preserva el resto
 * del orden.
 */
export function reorderWithinParent(
  doc: BuilderDocument,
  nodeId: NodeId,
  delta: number,
): BuilderDocument {
  if (nodeId === doc.rootId) return doc;
  const parentId = findParentId(doc, nodeId);
  if (parentId === null) return doc;
  const parent = doc.nodes[parentId]!;
  const children = parent.children ?? [];
  const from = children.indexOf(nodeId);
  if (from === -1) return doc;
  const to = from + delta;
  if (to < 0 || to >= children.length) return doc; // en un extremo: no-op
  const next = [...children];
  next.splice(from, 1);
  next.splice(to, 0, nodeId);
  return {
    ...doc,
    nodes: { ...doc.nodes, [parentId]: { ...parent, children: next } },
  };
}

/**
 * "Desanida" (outdent): mueve `nodeId` fuera de su padre hacia el abuelo,
 * insertándolo justo DESPUÉS del padre. No-op si el padre es la raíz (no hay
 * nivel superior) o si no hay abuelo.
 */
export function outdentNode(doc: BuilderDocument, nodeId: NodeId): BuilderDocument {
  const parentId = findParentId(doc, nodeId);
  if (parentId === null || parentId === doc.rootId) return doc;
  const grandParentId = findParentId(doc, parentId);
  if (grandParentId === null) return doc;
  const parentIndex = doc.nodes[grandParentId]?.children?.indexOf(parentId) ?? -1;
  if (parentIndex === -1) return doc;
  return moveNode(doc, nodeId, { parentId: grandParentId, index: parentIndex + 1 });
}

/**
 * "Anida" (indent): mueve `nodeId` dentro de su hermano ANTERIOR, como último
 * hijo de éste. No-op si no hay hermano anterior. El caller debe garantizar que
 * el hermano anterior admite hijos (el árbol es type-agnóstico, P4).
 */
export function indentIntoPreviousSibling(
  doc: BuilderDocument,
  nodeId: NodeId,
): BuilderDocument {
  const parentId = findParentId(doc, nodeId);
  if (parentId === null) return doc;
  const children = doc.nodes[parentId]?.children ?? [];
  const idx = children.indexOf(nodeId);
  if (idx <= 0) return doc; // sin hermano anterior
  const prevSiblingId = children[idx - 1]!;
  const prevChildrenLen = doc.nodes[prevSiblingId]?.children?.length ?? 0;
  return moveNode(doc, nodeId, { parentId: prevSiblingId, index: prevChildrenLen });
}

/**
 * Variante de `outdentNode`/`canOutdentNode` para un `DropTarget` VIRTUAL
 * (docs/24 §4, mini-dropdown de confirmación del pick & insert): en vez de
 * desanidar un nodo ya colocado en el árbol, calcula a qué destino
 * equivaldría "salir del contenedor" desde una posición `{parentId, index}`
 * que TODAVÍA no tiene ningún nodo real ahí (el `candidate` es solo un
 * preview, P1 — nunca se muta el documento). Mismo criterio que `outdentNode`:
 * el nuevo destino es el abuelo de `parentId`, justo DESPUÉS de `parentId` en
 * sus hijos. `null` si `parentId` es la raíz o no tiene abuelo (no hay nivel
 * superior al que salir) — mismo caso no-op que `canOutdentNode`.
 */
export function outdentDropTarget(doc: BuilderDocument, target: DropTarget): DropTarget | null {
  const { parentId } = target;
  if (parentId === doc.rootId) return null;
  const grandParentId = findParentId(doc, parentId);
  if (grandParentId === null) return null;
  const parentIndex = doc.nodes[grandParentId]?.children?.indexOf(parentId) ?? -1;
  if (parentIndex === -1) return null;
  return { parentId: grandParentId, index: parentIndex + 1 };
}

/**
 * Variante de `indentIntoPreviousSibling`/`hasPreviousSiblingForIndent` para
 * un `DropTarget` VIRTUAL (docs/24 §4): calcula a qué destino equivaldría
 * "entrar" en el hermano ANTERIOR a la posición `index` dentro de `parentId`
 * — como último hijo de ese hermano. `null` si `index <= 0` (no hay hermano
 * antes de esa posición). El guard type-aware (`canPlaceChild`, docs/23 §4)
 * vive en el caller (el store conoce el registry, P4), igual que
 * `hasPreviousSiblingForIndent`: este helper solo resuelve la estructura.
 */
export function indentDropTarget(doc: BuilderDocument, target: DropTarget): DropTarget | null {
  const { parentId, index } = target;
  if (index <= 0) return null;
  const children = doc.nodes[parentId]?.children ?? [];
  const prevSiblingId = children[index - 1];
  if (!prevSiblingId) return null;
  const prevChildrenLen = doc.nodes[prevSiblingId]?.children?.length ?? 0;
  return { parentId: prevSiblingId, index: prevChildrenLen };
}

/**
 * Id del hermano anterior a la posición `index` dentro de `parentId` (para el
 * guard type-aware de `indentDropTarget` en el caller), o `null` si no hay
 * (`index <= 0`).
 */
export function previousSiblingIdAtIndex(
  doc: BuilderDocument,
  parentId: NodeId,
  index: number,
): NodeId | null {
  if (index <= 0) return null;
  const children = doc.nodes[parentId]?.children ?? [];
  return children[index - 1] ?? null;
}

// ---------------------------------------------------------------------------
// Inserción de fragmentos (B1, docs/32 §2)
// ---------------------------------------------------------------------------

function defaultFragmentIdGenerator(): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `n-${rand}`;
}

/** ¿El fragmento tiene forma mínima insertable (root + refs de hijos)? */
function isFragmentMinimallyValid(fragment: NodeFragment): boolean {
  const { rootId, nodes } = fragment;
  if (!nodes[rootId]) return false;
  for (const node of Object.values(nodes)) {
    if (node.children) {
      for (const childId of node.children) {
        if (!nodes[childId]) return false;
      }
    }
  }
  return true;
}

/** Remapea todos los ids de un fragmento (mismo patrón que `duplicateNode`). */
export function remapFragmentIds(
  fragment: NodeFragment,
  idGenerator: () => string = defaultFragmentIdGenerator,
): { nodes: Record<NodeId, BuilderNode>; rootId: NodeId; idMap: Map<NodeId, NodeId> } {
  const ids = Object.keys(fragment.nodes);
  const idMap = new Map<NodeId, NodeId>();
  for (const id of ids) {
    idMap.set(id, idGenerator());
  }
  const remappedNodes: Record<NodeId, BuilderNode> = {};
  for (const id of ids) {
    const original = fragment.nodes[id]!;
    const newId = idMap.get(id)!;
    const clone = structuredClone(original);
    clone.id = newId;
    if (clone.children) {
      clone.children = clone.children.map((cid) => idMap.get(cid) ?? cid);
    }
    remappedNodes[newId] = clone;
  }
  return { nodes: remappedNodes, rootId: idMap.get(fragment.rootId)!, idMap };
}

function fragmentPlacementAllowed(
  doc: BuilderDocument,
  fragment: NodeFragment,
  target: DropTarget,
  canPlace: (parentType: string, childType: string) => boolean,
): boolean {
  const parent = doc.nodes[target.parentId];
  const root = fragment.nodes[fragment.rootId];
  if (!parent || !root) return false;
  if (!canPlace(parent.type, root.type)) return false;
  for (const node of Object.values(fragment.nodes)) {
    if (!node.children) continue;
    for (const childId of node.children) {
      const child = fragment.nodes[childId];
      if (!child) continue;
      if (!canPlace(node.type, child.type)) return false;
    }
  }
  return true;
}

/**
 * Inserta un subárbol arbitrario en `doc` en `target`, remapeando todos los ids
 * del fragmento para evitar colisiones. Devuelve `null` si el fragmento es
 * inválido o la colocación no pasa `canPlace` (no lanza).
 */
export function insertFragment(
  doc: BuilderDocument,
  fragment: NodeFragment,
  target: DropTarget,
  options?: InsertFragmentOptions,
): InsertFragmentResult | null {
  if (!isFragmentMinimallyValid(fragment)) return null;

  const canPlace = options?.canPlace ?? canPlaceChild;
  if (!fragmentPlacementAllowed(doc, fragment, target, canPlace)) return null;

  const idGenerator = options?.idGenerator ?? defaultFragmentIdGenerator;
  const { nodes: remappedNodes, rootId: remappedRootId, idMap } = remapFragmentIds(
    fragment,
    idGenerator,
  );

  const remappedTranslations: Record<NodeId, NodeTranslations> = {};
  if (fragment.translations) {
    for (const [oldId, trans] of Object.entries(fragment.translations)) {
      const newId = idMap.get(oldId);
      if (newId) remappedTranslations[newId] = structuredClone(trans);
    }
  }

  const withNodes: BuilderDocument = {
    ...doc,
    nodes: { ...doc.nodes, ...remappedNodes },
  };

  return {
    document: insertNode(withNodes, remappedRootId, target),
    insertedRootId: remappedRootId,
    translations: remappedTranslations,
  };
}
