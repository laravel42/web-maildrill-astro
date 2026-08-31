/**
 * Store de UI para banderas de "desborda horizontalmente" por nodo.
 *
 * Es estado del EDITOR, no del documento (P1): la detección de overflow mide el
 * DOM en runtime y NO puede vivir en el JSON ni reproducirse en el export. Se
 * mantiene aparte del `documentStore` (y de su historial zundo) para que la
 * medición nunca mute la fuente de verdad ni ensucie el undo.
 */

import { create } from "zustand";
import type { NodeId } from "../model/types";

interface OverflowState {
  overflowing: Record<NodeId, boolean>;
  setOverflow: (id: NodeId, value: boolean) => void;
  clear: (id: NodeId) => void;
}

export const useOverflowStore = create<OverflowState>((set, get) => ({
  overflowing: {},
  setOverflow: (id, value) => {
    if (!!get().overflowing[id] === value) return; // evita renders/loops
    set((s) => ({ overflowing: { ...s.overflowing, [id]: value } }));
  },
  clear: (id) =>
    set((s) => {
      if (!(id in s.overflowing)) return s;
      const next = { ...s.overflowing };
      delete next[id];
      return { overflowing: next };
    }),
}));
