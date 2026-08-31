/**
 * Overlay de feedback de drop (docs/02 §5, docs/09 §2.3) — extraído de
 * `NodeRenderer.tsx` (docs/27, split mecánico).
 *
 * Pinta el indicador de línea (`DropOverlay`, flex/auto) o el fantasma ABSOLUTO
 * de celda (grid explícito) dentro del contenedor que recibe el drop. Ambos son
 * chrome puro (`aria-hidden`, sin `data-node-id`) y nunca salen al export (P8).
 * `NodeRenderer` decide los booleanes `showOverlay`/`showCellGhost` (dependen
 * de `interactive`/`acceptsChildren`/estado del drop target) y este componente
 * solo pinta el markup — mismo comportamiento, verbatim.
 */

import { GhostNode } from "../dnd/ghost";
import { DropOverlay } from "../dnd/dropIndicator";
import type { DragData } from "../dnd/contract";
import type { Indicator } from "../dnd/useDropTarget";

export interface DropIndicatorOverlayProps {
  showOverlay: boolean;
  showCellGhost: boolean;
  indicator: Indicator | null;
  drag: DragData | null;
}

export function DropIndicatorOverlay({
  showOverlay,
  showCellGhost,
  indicator,
  drag,
}: DropIndicatorOverlayProps) {
  return (
    <>
      {showOverlay && indicator ? (
        <DropOverlay
          key="__drop-overlay__"
          rect={indicator.rect}
          variant={indicator.variant}
        />
      ) : null}
      {showCellGhost && indicator && drag ? (
        <div
          key="__drop-ghost-cell__"
          className="pbx-drop-ghost pbx-drop-ghost--cell"
          style={{
            position: "absolute",
            left: indicator.rect.left,
            top: indicator.rect.top,
            width: indicator.rect.width,
            height: indicator.rect.height,
          }}
          aria-hidden="true"
        >
          <GhostNode drag={drag} />
        </div>
      ) : null}
    </>
  );
}
