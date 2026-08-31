/**
 * HoverHandle — pestaña de agarre para nodos con superficie que CAPTURA el
 * puntero (`ComponentDefinition.blocksPointerCapture`, hoy solo `video`).
 *
 * Problema (feedback de usuario): un `video` renderiza un `<iframe>` interno
 * que ocupa el 100% de su superficie visual. El navegador entrega el
 * click/hover al `<iframe>` (o al documento que carga dentro), nunca al
 * `.pbx-node` ancestro — ni `onClick` (selección) ni `:hover` (outline CSS)
 * del nodo disparan. La única vía de selección era el panel de capas, un
 * mecanismo que un usuario no técnico no tiene por qué conocer.
 *
 * Solución: análoga a `SelectionHandle` (misma pestaña flotante, mismo
 * `data-drag-handle`/arrastre vía Pragmatic), pero:
 *  - Aparece SOLO tras un hover SOSTENIDO (`HOVER_DELAY_MS`) sobre el nodo
 *    bloqueante — evita parpadeo al pasar el mouse de paso, y deja claro que
 *    es una affordance secundaria, no la interacción principal.
 *  - Tono visualmente MÁS TENUE que la pestaña de selección (variante
 *    `--hover` en `chrome.css`, mismo lenguaje visual pero sin el degradado
 *    de acento sólido) — se distingue de un vistazo de "ya seleccionado".
 *  - Nunca coexiste con `SelectionHandle` sobre el MISMO nodo: si el nodo
 *    bloqueante ya está seleccionado, esta pestaña no se muestra (la de
 *    selección ya cubre arrastre/identificación).
 *  - PERSISTE mientras el puntero viaja del nodo hacia la propia pestaña o
 *    mientras se arrastra (bug real, feedback de usuario): el trayecto entre
 *    el nodo bloqueante y la pestaña cruza "aire" (el `top` de la pestaña
 *    queda por FUERA del rect del nodo — mismo posicionamiento que
 *    `SelectionHandle`), así que `elementFromPoint` deja de devolver un
 *    descendiente del nodo justo cuando el usuario intenta alcanzarla,
 *    ocultándola antes de poder hacer click o iniciar el drag. Se resuelve
 *    con dos guardas en el listener de `pointermove`: (a) `isOverHandle`
 *    detecta que el puntero está sobre la pestaña misma (o sus hijos) y NO
 *    reevalúa el nodo bajo el puntero; (b) `draggingRef` (sincronizado con el
 *    `dragging` real de `useDraggable`) congela el estado por completo
 *    mientras el drag nativo está en curso, sin importar dónde termine el
 *    puntero (Pragmatic lo mueve fuera del frame con frecuencia).
 *  - Detección por un único listener de `pointermove` sobre el frame (mismo
 *    patrón "un solo listener, N nodos" que ya usa el resto del chrome, no
 *    hace falta instrumentar cada `NodeRenderer`): `elementFromPoint` halla
 *    el elemento bajo el puntero (el `<iframe>` mismo, o el documento que
 *    carga dentro si el puntero ya entró a su contexto) y se sube por
 *    `closest("[data-node-id]")` hasta el nodo ancestro más cercano — el
 *    propio `video`, no uno de sus hijos internos (no tiene `data-node-id`
 *    propio, así que el primer ancestro marcado ES el nodo bloqueante).
 *
 * Declarativo (P4): el core no conoce "video", solo consulta
 * `def.blocksPointerCapture` vía el registry para decidir si el nodo bajo el
 * puntero califica.
 */

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { GripVertical } from "@/components";
import { useDocumentStore } from "../store/documentStore";
import { getDefinition } from "../registry/componentRegistry";
import { useDraggable } from "./useDraggable";
import type { DragData } from "./contract";
import type { NodeId } from "../model/types";

interface HoverHandleProps {
  /** Frame del canvas: mismo sistema de coordenadas que `SelectionHandle`. */
  frameRef: RefObject<HTMLElement | null>;
}

interface Box {
  top: number;
  left: number;
}

// ms — cuánto debe sostenerse el hover antes de mostrar la pestaña (evita
// parpadeo al pasar el mouse de paso hacia otro destino).
const HOVER_DELAY_MS = 500;

/** Busca hacia arriba (incluido el propio elemento) el `data-node-id` más
 * cercano — puede no ser el elemento devuelto por `elementFromPoint` si el
 * puntero cayó sobre un hijo interno sin marcar (p. ej. el `<iframe>`). */
function closestNodeId(el: Element | null): NodeId | null {
  const found = el?.closest<HTMLElement>("[data-node-id]");
  return found?.getAttribute("data-node-id") ?? null;
}

/** El puntero está sobre la propia pestaña (o alguno de sus hijos, p. ej. el
 * grip/label) — no sobre el nodo bloqueante. Se usa para NO ocultarla cuando
 * el usuario se mueve del nodo hacia la pestaña para agarrarla: el trayecto
 * cruza aire entre ambos, y por un instante `elementFromPoint` deja de
 * devolver un descendiente del nodo bloqueante bajo el puntero. */
function isOverHandle(el: Element | null): boolean {
  return !!el?.closest("[data-drag-handle]");
}

export function HoverHandle({ frameRef }: HoverHandleProps) {
  const { t } = useTranslation("canvas");
  const documentState = useDocumentStore((s) => s.document);
  const selectedId = useDocumentStore((s) => s.selectedId);
  const select = useDocumentStore((s) => s.select);
  const pickInsert = useDocumentStore((s) => s.pickInsert);
  const editingTextNodeId = useDocumentStore((s) => s.editingTextNodeId);

  const [hoveredId, setHoveredId] = useState<NodeId | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  // Mientras se arrastra la pestaña, el nodo NUNCA debe ocultarse (el drag de
  // Pragmatic mueve el puntero fuera del frame/nodo constantemente) — ref
  // (no state) porque el listener de `pointermove` lo lee en cada evento sin
  // necesidad de reatachearse.
  const draggingRef = useRef(false);

  // Nodo bloqueante candidato: bajo el puntero, con el flag declarativo, y
  // NO el ya seleccionado (ahí `SelectionHandle` cubre el mismo rol) ni
  // mientras hay un pick&insert en curso o edición de texto activa (mismo
  // criterio de "una sola interacción a la vez" que el resto del chrome).
  const clearHoverTimeout = useCallback(() => {
    if (hoverTimeoutRef.current !== null) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const onPointerMove = (e: PointerEvent) => {
      // Mientras se arrastra la pestaña (drag nativo en curso), o mientras el
      // puntero sigue sobre la pestaña misma (trayecto nodo → pestaña antes de
      // agarrarla), se preserva el estado actual sin evaluar el nodo bajo el
      // puntero — de lo contrario la pestaña se oculta apenas el puntero deja
      // de estar sobre un descendiente del nodo bloqueante, haciendo
      // imposible alcanzarla o arrastrarla.
      if (draggingRef.current) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (isOverHandle(target)) return;

      if (pickInsert !== null || editingTextNodeId !== null) {
        clearHoverTimeout();
        setHoveredId(null);
        return;
      }
      const nodeId = closestNodeId(target);
      const node = nodeId ? documentState.nodes[nodeId] : undefined;
      const def = node ? getDefinition(node.type) : undefined;
      const qualifies = !!nodeId && !!def?.blocksPointerCapture && nodeId !== selectedId;

      if (!qualifies) {
        clearHoverTimeout();
        setHoveredId((current) => (current !== null ? null : current));
        return;
      }
      if (nodeId === hoveredId) return; // ya mostrada/pendiente para este nodo
      clearHoverTimeout();
      hoverTimeoutRef.current = window.setTimeout(() => {
        setHoveredId(nodeId);
      }, HOVER_DELAY_MS);
    };

    const onPointerLeave = () => {
      if (draggingRef.current) return;
      clearHoverTimeout();
      setHoveredId(null);
    };

    frame.addEventListener("pointermove", onPointerMove);
    frame.addEventListener("pointerleave", onPointerLeave);
    return () => {
      frame.removeEventListener("pointermove", onPointerMove);
      frame.removeEventListener("pointerleave", onPointerLeave);
      clearHoverTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `documentState`
    // se lee deliberadamente vía closure fresco en cada evento (no hace falta
    // reatachear el listener por cada cambio del documento).
  }, [frameRef, selectedId, pickInsert, editingTextNodeId, hoveredId, clearHoverTimeout]);

  // Deselección/desmontaje del nodo, cambio de selección, etc.: si el
  // hovered ya no existe o pasó a ser el seleccionado, se oculta.
  useEffect(() => {
    if (!hoveredId) return;
    const node = documentState.nodes[hoveredId];
    if (!node || hoveredId === selectedId) setHoveredId(null);
  }, [hoveredId, selectedId, documentState]);

  const node = hoveredId ? documentState.nodes[hoveredId] : undefined;
  const def = node ? getDefinition(node.type) : undefined;
  const enabled = !!hoveredId && !!node && !!def;
  const label = node && def ? def.label : "";

  const getData = useCallback<() => DragData>(
    () => ({ kind: "existing-node", nodeId: hoveredId as string }),
    [hoveredId],
  );
  const getPreviewLabel = useCallback(() => label, [label]);
  const { dragging } = useDraggable(handleRef, getData, enabled, getPreviewLabel);

  // Mantiene `draggingRef` sincronizado con el `dragging` real de Pragmatic:
  // el listener de `pointermove` (definido arriba, fuera de este render) lo
  // lee vía closure estable, así que un ref (no depender de `dragging` en el
  // efecto de arriba) evita reatachear el listener en cada cambio.
  useEffect(() => {
    draggingRef.current = dragging;
  }, [dragging]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!enabled || !hoveredId || !frame) {
      setBox(null);
      return;
    }
    const measure = () => {
      const el = frame.querySelector<HTMLElement>(`[data-node-id="${hoveredId}"]`);
      if (!el) {
        setBox(null);
        return;
      }
      const nr = el.getBoundingClientRect();
      const fr = frame.getBoundingClientRect();
      const handleEl = handleRef.current;
      const handleWidth = handleEl?.offsetWidth ?? 0;
      const handleHeight = handleEl?.offsetHeight ?? 26;
      setBox({
        top: nr.top - fr.top - handleHeight,
        left: nr.left - fr.left + nr.width / 2 - handleWidth / 2,
      });
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(frame);
    const el = frame.querySelector<HTMLElement>(`[data-node-id="${hoveredId}"]`);
    if (el) ro?.observe(el);
    if (handleRef.current) ro?.observe(handleRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, hoveredId, frameRef]);

  if (!enabled || !box) return null;

  return (
    <div
      ref={handleRef}
      data-drag-handle
      role="button"
      aria-label={t("dnd.dragHandle", { label })}
      title={t("dnd.dragHandleTitle", { label })}
      className={["pbx-hover-handle", dragging ? "pbx-hover-handle--dragging" : ""]
        .filter(Boolean)
        .join(" ")}
      style={{ top: box.top, left: box.left }}
      onClick={(e) => {
        e.stopPropagation();
        if (hoveredId) select(hoveredId);
        setHoveredId(null);
      }}
    >
      <span className="pbx-hover-handle__grip" aria-hidden="true">
        <GripVertical size={14} />
      </span>
      <span className="pbx-hover-handle__label">{label}</span>
    </div>
  );
}
