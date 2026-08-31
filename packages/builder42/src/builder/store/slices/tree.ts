import { createNodeTreeForType, getDefinition } from "../../registry/componentRegistry";
import {
  collectSubtree,
  findParentId,
  insertFragment as insertFragmentIntoDocument,
  insertNode,
  moveNode,
  removeNode,
  type DropTarget,
  type NodeFragment,
} from "../../model/tree";
import { validateFragment } from "../../model/validate";
import type { BuilderDocument, BuilderNode, NodeId, NodeTranslations } from "../../model/types";
import type { SliceCreator } from "./types";

export interface TreeSlice {
  /**
   * Slot ACTIVA en edición por composite `splitRender` (docs/23 §5, T11): mapa
   * `compositeId -> slotId` de qué pestaña se está editando en el canvas de cada
   * `tabs`. UI-state puro (no entra a zundo, no se serializa): permite "cambiar
   * de pestaña" en Edit sin runtime JS. Se resetea al cambiar de página o cargar
   * un sitio (los ids de nodo cambian); las entradas obsoletas (slot borrada)
   * son inocuas — `NodeRenderer` cae a la primera slot si el id guardado ya no
   * es hijo del composite. Vacío = cada composite muestra su primera slot.
   */
  activeSlotByComposite: Record<NodeId, NodeId>;

  // Árbol (reusa ops puras — P7). Operan sobre la copia de trabajo `document`.
  addComponent: (type: string, target: DropTarget) => void;
  /**
   * Añade una slot a un composite (docs/23 §4): crea el subárbol de
   * `slots.itemType` y lo inserta al final del composite. No-op si el nodo no es
   * composite o si ya alcanzó `slots.max`.
   */
  addSlot: (compositeId: NodeId) => void;
  /**
   * Marca `slotId` como la slot activa en edición de su composite `splitRender`
   * (docs/23 §5, T11) — el usuario hizo click en el botón de esa pestaña en el
   * canvas. No toca el documento (P1): solo actualiza `activeSlotByComposite`.
   */
  setActiveSlot: (compositeId: NodeId, slotId: NodeId) => void;
  moveExistingNode: (nodeId: NodeId, target: DropTarget) => void;
  duplicateNode: (nodeId: NodeId) => void;
  /**
   * Inserta un subárbol arbitrario (plantilla, IA, pegado) en `target` tras
   * validarlo con `validateFragment` (B1/B5, docs/32 §2).
   */
  insertFragment: (
    fragment: NodeFragment,
    target: DropTarget,
    translations?: Record<NodeId, NodeTranslations>,
  ) => void;
  removeSelected: () => void;
}

export const createTreeSlice: SliceCreator<TreeSlice> = (set, get) => ({
  activeSlotByComposite: {},

  // --- Nodo (sobre la copia de trabajo `document`) --------------------
  addComponent: (type, target) => {
    const doc = get().document;
    // Siembra el nodo + su subárbol por defecto (docs/23 §7): composites como
    // `tabs` nacen con sus slots (y su contenido) ya creados. Para tipos sin
    // `defaultChildren` equivale a crear solo la raíz.
    const { rootId: newId, nodes: newNodes } = createNodeTreeForType(type);
    const withNode: BuilderDocument = {
      ...doc,
      nodes: { ...doc.nodes, ...newNodes },
    };
    set({ document: insertNode(withNode, newId, target), selectedId: newId });
    // Elementos no-visibles editables en overlay (docs/20 §4.2): al
    // insertarlos se abre su overlay de edición para llenarlos de inmediato.
    if (getDefinition(type)?.editsInOverlay) {
      set({ editingModalId: newId });
    }
  },

  addSlot: (compositeId) => {
    const doc = get().document;
    const parent = doc.nodes[compositeId];
    const def = parent ? getDefinition(parent.type) : undefined;
    const itemType = def?.slots?.itemType;
    if (!parent || !itemType) return;
    const count = parent.children?.length ?? 0;
    if (def!.slots?.max !== undefined && count >= def!.slots.max) return; // tope
    const { rootId: slotId, nodes: newNodes } = createNodeTreeForType(itemType);
    const withNodes: BuilderDocument = {
      ...doc,
      nodes: { ...doc.nodes, ...newNodes },
    };
    set({
      document: insertNode(withNodes, slotId, { parentId: compositeId, index: count }),
      selectedId: slotId,
    });
  },

  moveExistingNode: (nodeId, target) => {
    set({ document: moveNode(get().document, nodeId, target) });
  },

  setActiveSlot: (compositeId, slotId) => {
    const doc = get().document;
    const composite = doc.nodes[compositeId];
    // Guarda: la slot debe ser hijo directo del composite (ignora ids
    // obsoletos o cruzados). No toca el documento (P1), solo UI-state.
    if (!composite?.children?.includes(slotId)) return;
    set((s) => ({
      activeSlotByComposite: { ...s.activeSlotByComposite, [compositeId]: slotId },
    }));
  },

  duplicateNode: (nodeId) => {
    const s = get();
    const doc = s.document;
    const node = doc.nodes[nodeId];
    if (!node || nodeId === doc.rootId) return;

    const subtreeIds = collectSubtree(doc, nodeId);

    // Generate new unique IDs for every node in the subtree.
    const idMap = new Map<NodeId, NodeId>();
    for (const id of subtreeIds) {
      const rand =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID().slice(0, 8)
          : Math.random().toString(36).slice(2, 10);
      idMap.set(id, `n-${rand}`);
    }

    // Deep-clone each node, remapping its own id and children references.
    const clonedNodes: Record<NodeId, BuilderNode> = {};
    for (const id of subtreeIds) {
      const original = doc.nodes[id]!;
      const newId = idMap.get(id)!;
      const clone = structuredClone(original);
      clone.id = newId;
      if (clone.children) {
        clone.children = clone.children.map((cid) => idMap.get(cid) ?? cid);
      }
      clonedNodes[newId] = clone;
    }

    // Duplicate translations (i18n content) for the cloned nodes.
    const page = s.site.pages[s.activePageId];
    const transByNewId: Record<NodeId, NodeTranslations> = {};
    if (page?.translations) {
      for (const id of subtreeIds) {
        const t = page.translations[id];
        if (t) transByNewId[idMap.get(id)!] = structuredClone(t);
      }
    }

    // Insert the clone as the next sibling of the original node.
    const parentId = findParentId(doc, nodeId);
    const cloneRootId = idMap.get(nodeId)!;

    const withNodes: BuilderDocument = {
      ...doc,
      nodes: { ...doc.nodes, ...clonedNodes },
    };

    if (parentId) {
      const siblings = doc.nodes[parentId]?.children ?? [];
      const idx = siblings.indexOf(nodeId);
      const target: DropTarget = {
        parentId,
        index: idx >= 0 ? idx + 1 : siblings.length,
      };
      set((draft) => {
        draft.document = insertNode(withNodes, cloneRootId, target);
        if (Object.keys(transByNewId).length > 0) {
          const p = draft.site.pages[draft.activePageId];
          if (p) {
            p.translations = { ...p.translations, ...transByNewId };
          }
        }
        draft.selectedId = cloneRootId;
        draft.editingTextNodeId = null;
        draft.activeTiptapEditor = null;
        draft.pickInsert = null;
      });
    } else {
      // Shouldn't happen since root can't be duplicated, but safe fallback.
      set((draft) => {
        draft.document = withNodes;
        if (Object.keys(transByNewId).length > 0) {
          const p = draft.site.pages[draft.activePageId];
          if (p) {
            p.translations = { ...p.translations, ...transByNewId };
          }
        }
        draft.selectedId = cloneRootId;
        draft.editingTextNodeId = null;
        draft.activeTiptapEditor = null;
        draft.pickInsert = null;
      });
    }
  },

  insertFragment: (fragment, target, translations) => {
    const merged: NodeFragment = {
      ...fragment,
      translations: { ...fragment.translations, ...translations },
    };
    const validation = validateFragment(merged);
    if (!validation.ok) {
      if (import.meta.env.DEV) {
        console.warn("[insertFragment] validation failed:", validation.errors);
      }
      return;
    }
    const result = insertFragmentIntoDocument(get().document, merged, target);
    if (!result) return;
    set((draft) => {
      draft.document = result.document;
      if (Object.keys(result.translations).length > 0) {
        const p = draft.site.pages[draft.activePageId];
        if (p) {
          p.translations = { ...p.translations, ...result.translations };
        }
      }
      draft.selectedId = result.insertedRootId;
      draft.editingTextNodeId = null;
      draft.activeTiptapEditor = null;
      draft.pickInsert = null;
    });
  },

  removeSelected: () => {
    const { selectedId, document } = get();
    if (!selectedId) return;
    // Guard de mínimos (docs/23 §4): no borrar una slot si su composite
    // quedaría por debajo de `slots.min` (default 1). El botón/atajo queda
    // como no-op.
    const node = document.nodes[selectedId];
    if (node && getDefinition(node.type)?.isSlot) {
      const parentId = findParentId(document, selectedId);
      const parent = parentId ? document.nodes[parentId] : undefined;
      const min = (parent ? getDefinition(parent.type)?.slots?.min : undefined) ?? 1;
      if (parent && (parent.children?.length ?? 0) <= min) return;
    }
    set({
      document: removeNode(document, selectedId),
      selectedId: null,
      editingTextNodeId: null,
      activeTiptapEditor: null,
      editingModalId: null,
      pickInsert: null,
    });
  },
});
