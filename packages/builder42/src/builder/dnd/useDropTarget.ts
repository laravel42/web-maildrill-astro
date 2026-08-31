/**
 * Wrapper React sobre `dropTargetForElements` de Pragmatic (docs/02 §3, §4).
 *
 * Calcula el índice de inserción PRECISO con la geometría pura (`geometry.ts`):
 * el CONTENEDOR compara la posición del puntero con los centros de sus hijos
 * (`container-computes-index`, docs/02 §4.1). Los rects de los hijos se miden
 * UNA vez al entrar (anti-oscilación, docs/02 §13.2) y la histéresis mantiene
 * el índice estable.
 *
 * - `canDrop` valida `acceptsChildren` + cycle guard (lo decide el llamador).
 * - Guard innermost-wins: solo el target más interno actúa (docs/02 §10).
 * - Expone `dropIndex` para pintar el indicador visual (docs/02 §5), derivado
 *   del MISMO cálculo que se aplicará al soltar (nunca se desincroniza).
 */

import { useEffect, useRef, useState, type RefObject } from "react";
import { dropTargetForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { DRAG_DATA_KEY, type DragData, type DropData } from "./contract";
import {
  detectDropIndex,
  computeIndicatorRect,
  gridCellRect,
  measureChildRects,
  parseTrackSizes,
  trackIndexAtOffset,
  type LayoutDirection,
  type Rect,
} from "./geometry";
import type { NodeId } from "../model/types";
import type { OverlayVariant } from "./dropIndicator";

export interface UseDropTargetOptions {
  parentId: NodeId;
  /** Ids de los hijos directos en orden (para medir sus rects). */
  getChildIds: () => NodeId[];
  /** Dirección de layout resuelta del contenedor (alimenta el eje del hit-test). */
  getDirection: () => LayoutDirection;
  /** ¿El contenedor está en colocación explícita de grid? (indicador = celda). */
  getExplicit?: () => boolean;
  canDrop?: (drag: DragData) => boolean;
  onDrop: (drag: DragData, drop: DropData) => void;
  /** Si es false, no se registra el drop target (nodos hoja). Default: true. */
  enabled?: boolean;
}

interface DragInput {
  clientX: number;
  clientY: number;
}

export interface Indicator {
  rect: Rect;
  variant: OverlayVariant;
}

function readDrag(data: Record<string | symbol, unknown>): DragData | undefined {
  return data[DRAG_DATA_KEY] as DragData | undefined;
}

export function useDropTarget(
  ref: RefObject<HTMLElement | null>,
  options: UseDropTargetOptions,
): { isOver: boolean; indicator: Indicator | null; dropIndex: number | null; drag: DragData | null } {
  const [isOver, setIsOver] = useState(false);
  const [indicator, setIndicator] = useState<Indicator | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragData | null>(null);

  // Estado del gesto (no dispara render): snapshot de rects + índice comprometido.
  const childRectsRef = useRef<Rect[]>([]);
  const currentIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || options.enabled === false) return;

    const compute = (input: DragInput): number => {
      const index = detectDropIndex({
        childRects: childRectsRef.current,
        direction: options.getDirection(),
        pointer: { x: input.clientX, y: input.clientY },
        currentIndex: currentIndexRef.current,
        deadband: 8,
      });
      currentIndexRef.current = index;
      return index;
    };

    // Celda destino (1-based) para grid: mapea el puntero a (col,row) usando las
    // pistas resueltas del grid (docs/02 §10.4).
    const cellAt = (
      input: DragInput,
    ): { column: number; row: number; columns: number } | undefined => {
      const cs = getComputedStyle(el);
      if (!cs.display.includes("grid")) return undefined;
      const colTracks = parseTrackSizes(cs.gridTemplateColumns);
      const rowTracks = parseTrackSizes(cs.gridTemplateRows);
      const colGap = parseFloat(cs.columnGap) || 0;
      const rowGap = parseFloat(cs.rowGap) || 0;
      const cRect = el.getBoundingClientRect();
      const padL = parseFloat(cs.paddingLeft) || 0;
      const padT = parseFloat(cs.paddingTop) || 0;
      const localX = input.clientX - cRect.left - el.clientLeft - padL + el.scrollLeft;
      const localY = input.clientY - cRect.top - el.clientTop - padT + el.scrollTop;
      return {
        column: trackIndexAtOffset(colTracks, colGap, localX),
        row: trackIndexAtOffset(rowTracks, rowGap, localY),
        columns: colTracks.length || 1,
      };
    };

    // Rect de la celda destino (grid explícito): el indicador resalta la MISMA
    // celda donde caerá el drop, no una línea de orden de lectura desalineada.
    const cellRectLocal = (column: number, row: number): Rect => {
      const cs = getComputedStyle(el);
      return gridCellRect({
        colTracks: parseTrackSizes(cs.gridTemplateColumns),
        rowTracks: parseTrackSizes(cs.gridTemplateRows),
        colGap: parseFloat(cs.columnGap) || 0,
        rowGap: parseFloat(cs.rowGap) || 0,
        padLeft: parseFloat(cs.paddingLeft) || 0,
        padTop: parseFloat(cs.paddingTop) || 0,
        contentHeight: el.clientHeight,
        column,
        row,
      });
    };

    // Línea de orden de lectura (flex/auto): convierte el snapshot de rects
    // (client) + index a coords LOCALES del overlay.
    const lineRectFor = (index: number): Rect | null => {
      const cRect = el.getBoundingClientRect();
      const originX = cRect.left + el.clientLeft - el.scrollLeft;
      const originY = cRect.top + el.clientTop - el.scrollTop;
      const localRects: Rect[] = childRectsRef.current.map((r) => ({
        left: r.left - originX,
        top: r.top - originY,
        width: r.width,
        height: r.height,
      }));
      return computeIndicatorRect(localRects, index, options.getDirection(), {
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };

    const refresh = (input: DragInput) => {
      const index = compute(input);
      setDropIndex(index);
      // Grid explícito → resalta la celda destino; resto → línea de frontera.
      if (options.getDirection() === "grid" && options.getExplicit?.()) {
        const cell = cellAt(input);
        setIndicator(
          cell ? { rect: cellRectLocal(cell.column, cell.row), variant: "cell" } : null,
        );
        return;
      }
      const rect = lineRectFor(index);
      setIndicator(rect ? { rect, variant: "line" } : null);
    };

    const clear = () => {
      setIsOver(false);
      setIndicator(null);
      setDropIndex(null);
      setDrag(null);
      currentIndexRef.current = null;
      childRectsRef.current = [];
    };

    // ¿Somos el drop target MÁS INTERNO bajo el puntero? `dropTargets` viene
    // ordenado de dentro hacia fuera, así que el innermost es el [0].
    const isInnermost = (dropTargets: readonly { element: Element }[]): boolean =>
      dropTargets[0]?.element === el;

    // Feedback visual SOLO en el innermost (innermost-wins también en lo visual,
    // docs/02 §10). Un ancestro que contiene al target activo NO debe pintar su
    // propio fantasma/indicador. Se conserva el snapshot de rects por si el
    // puntero vuelve a hacer a este contenedor el más interno.
    const applyVisual = (input: DragInput, innermost: boolean) => {
      if (innermost) {
        setIsOver(true);
        refresh(input);
      } else {
        setIsOver(false);
        setIndicator(null);
        setDropIndex(null);
      }
    };

    // Activa el snapshot de rects + el feedback. Se usa al ENTRAR (onDragEnter) y
    // cuando el drag ARRANCA con este contenedor ya bajo el puntero (onDragStart).
    // El snapshot se mide siempre (barato y necesario si luego pasa a innermost);
    // el feedback se pinta solo si somos el más interno.
    const enter = (input: DragInput, dragData: DragData | null, innermost: boolean) => {
      childRectsRef.current = measureChildRects(el, options.getChildIds());
      currentIndexRef.current = null;
      setDrag(dragData);
      applyVisual(input, innermost);
    };

    return dropTargetForElements({
      element: el,
      canDrop: ({ source }) => {
        const drag = readDrag(source.data);
        if (!drag) return false;
        return options.canDrop ? options.canDrop(drag) : true;
      },
      onDragStart: ({ source, location }) =>
        enter(
          location.current.input,
          readDrag(source.data) ?? null,
          isInnermost(location.current.dropTargets),
        ),
      onDragEnter: ({ source, location }) =>
        enter(
          location.current.input,
          readDrag(source.data) ?? null,
          isInnermost(location.current.dropTargets),
        ),
      onDrag: ({ location }) =>
        applyVisual(location.current.input, isInnermost(location.current.dropTargets)),
      onDragLeave: clear,
      onDrop: ({ source, location }) => {
        // innermost-wins: ignorar si no somos el target más interno.
        const isInner = location.current.dropTargets[0]?.element === el;
        const drag = readDrag(source.data);
        const input = location.current.input;
        const index = compute(input);
        const cell = options.getDirection() === "grid" ? cellAt(input) : undefined;
        clear();
        if (!isInner || !drag) return;
        options.onDrop(drag, { parentId: options.parentId, index, cell });
      },
    });
  }, [ref, options]);

  return { isOver, indicator, dropIndex, drag };
}
