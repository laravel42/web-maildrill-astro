/**
 * Detección de overflow horizontal (editor-only, docs/02/P1).
 *
 * Observa el elemento con `ResizeObserver` (y sus hijos) y marca en el
 * `overflowStore` si `scrollWidth > clientWidth`. NO escribe en el documento:
 * solo estado de UI que alimenta la affordance "Convertir en slider". La
 * medición nunca muta el JSON (P1), así que no puede entrar en bucle con el
 * historial.
 */

import { useEffect, type RefObject } from "react";
import { useOverflowStore } from "../store/overflowStore";
import type { NodeId } from "../model/types";

export function useOverflowObserver(
  ref: RefObject<HTMLElement | null>,
  nodeId: NodeId,
  enabled: boolean,
  childCount: number,
): void {
  useEffect(() => {
    const el = ref.current;
    const { setOverflow, clear } = useOverflowStore.getState();
    if (!el || !enabled || typeof ResizeObserver === "undefined") {
      clear(nodeId);
      return;
    }
    const measure = () => setOverflow(nodeId, el.scrollWidth - el.clientWidth > 1);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    return () => {
      ro.disconnect();
      useOverflowStore.getState().clear(nodeId);
    };
    // childCount fuerza re-medición cuando cambian los hijos (contenido nuevo).
  }, [ref, nodeId, enabled, childCount]);
}
