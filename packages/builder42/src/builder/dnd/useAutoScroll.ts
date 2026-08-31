/**
 * Auto-scroll del contenedor scrollable durante el arrastre (docs/02 §11.4).
 * Al acercar el puntero a los bordes del canvas mientras se arrastra, Pragmatic
 * desplaza el scroll automáticamente. Solo se activa durante un drag.
 */

import { useEffect, type RefObject } from "react";
import { autoScrollForElements } from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";

export function useAutoScroll(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return autoScrollForElements({ element: el });
  }, [ref]);
}
