/**
 * Indicador de drop como OVERLAY absoluto (docs/02 §5, §10.4).
 *
 * Se posiciona `absolute` dentro del contenedor (que en edición es
 * `position:relative`), con `pointer-events:none`, así NO participa en el flujo
 * flex/grid ni ocupa una celda. La geometría (`rect`) se deriva del mismo
 * cálculo que el drop, de modo que nunca se desincroniza.
 *
 * Variantes:
 *  - `line` → línea fina en la frontera (flex/auto): reordenar entre hermanos.
 *  - `cell` → recuadro que resalta la celda destino (grid explícito).
 */

import type { CSSProperties } from "react";
import type { Rect } from "./geometry";

export type OverlayVariant = "line" | "cell";

export function DropOverlay({ rect, variant }: { rect: Rect; variant: OverlayVariant }) {
  const style: CSSProperties = {
    position: "absolute",
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
  return (
    <div
      className={`pbx-drop-overlay pbx-drop-overlay--${variant}`}
      style={style}
      aria-hidden="true"
      data-drop-indicator
    />
  );
}
