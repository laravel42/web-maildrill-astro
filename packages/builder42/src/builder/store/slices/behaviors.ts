/**
 * Behaviors (runtime JS opt-in, docs/10 §2-3). Escriben en
 * `document.nodes[id].behaviors` (parte del documento → entra al historial).
 */
import type { NodeAction, NodeId } from "../../model/types";
import { getBehaviorDefinition } from "../../registry/behaviorRegistry";
import { getDefinition } from "../../registry/componentRegistry";
import { activeLinkKeys } from "../../model/nodeAction";
import type { SliceCreator } from "./types";

export interface BehaviorsSlice {
  /** Añade un behavior al nodo con sus `defaultOptions` clonadas. No duplica. */
  addBehavior: (nodeId: NodeId, type: string) => void;
  /** Quita el behavior `type` del nodo. */
  removeBehavior: (nodeId: NodeId, type: string) => void;
  /** Escribe una opción del behavior `type` del nodo (`options[key] = value`). */
  setBehaviorOption: (nodeId: NodeId, type: string, key: string, value: unknown) => void;
  /**
   * Escribe (o borra, con `null`) la acción `onClick` del nodo (docs/20 §3).
   * Parte del documento → entra al historial. La usa el panel de vínculo del
   * modal para ligar/desligar disparadores por id.
   */
  setNodeAction: (nodeId: NodeId, action: NodeAction | null) => void;
}

export const createBehaviorsSlice: SliceCreator<BehaviorsSlice> = (set) => ({
  addBehavior: (nodeId, type) =>
    set((s) => {
      const node = s.document.nodes[nodeId];
      if (!node) return;
      const def = getBehaviorDefinition(type);
      if (!def) return;
      node.behaviors ??= [];
      if (node.behaviors.some((b) => b.type === type)) return; // no duplicar
      const options = def.defaultOptions
        ? structuredClone(def.defaultOptions)
        : undefined;
      node.behaviors.push(options ? { type, options } : { type });
    }),

  removeBehavior: (nodeId, type) =>
    set((s) => {
      const node = s.document.nodes[nodeId];
      if (!node?.behaviors) return;
      node.behaviors = node.behaviors.filter((b) => b.type !== type);
      if (node.behaviors.length === 0) delete node.behaviors; // JSON limpio
    }),

  setBehaviorOption: (nodeId, type, key, value) =>
    set((s) => {
      const node = s.document.nodes[nodeId];
      const behavior = node?.behaviors?.find((b) => b.type === type);
      if (!behavior) return;
      behavior.options ??= {};
      behavior.options[key] = value;
    }),

  setNodeAction: (nodeId, action) =>
    set((s) => {
      const node = s.document.nodes[nodeId];
      if (!node) return;
      if (action === null) {
        delete node.onClick; // JSON limpio (ausente = sin acción)
      } else {
        // Nodos cuyo click nativo ya tiene propósito propio (edición
        // inline, foco de un control de formulario) no pueden ser
        // disparadores: ignorar la escritura, sea cual sea el origen
        // (ModalTriggersSection, futuras UIs de acción de click).
        const def = getDefinition(node.type);
        if (def?.disallowsClickAction) return;
        node.onClick = action;
        // Exclusión mutua: ver comentario en `setProp`. Al activar una
        // acción de click, cualquier `link` (navegación) con valor real
        // se limpia — el nodo pasa a tener una sola interacción de click.
        if (def) {
          for (const key of activeLinkKeys(node, def.propsSchema.fields)) {
            delete node.props[key];
          }
        }
      }
    }),
});
