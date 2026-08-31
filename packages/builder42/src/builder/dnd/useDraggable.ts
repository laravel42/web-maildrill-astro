/**
 * Wrapper React sobre `draggable` de Pragmatic (docs/02 §3, §11.2).
 *
 * Adjunta nuestro `DragData` bajo `DRAG_DATA_KEY` y, opcionalmente, pinta un
 * drag preview propio (una etiqueta ligera) con `setCustomNativeDragPreview`
 * en vez del ghost nativo del DOM. Expone `dragging` para feedback visual.
 */

import { useEffect, useState, type RefObject } from "react";
import { draggable } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { setCustomNativeDragPreview } from "@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview";
import { pointerOutsideOfPreview } from "@atlaskit/pragmatic-drag-and-drop/element/pointer-outside-of-preview";
import { DRAG_DATA_KEY, type DragData } from "./contract";
import { dragGhostMarkup } from "./ghost";

export function useDraggable(
  ref: RefObject<HTMLElement | null>,
  getData: () => DragData,
  enabled = true,
  getPreviewLabel?: () => string,
): { dragging: boolean } {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    return draggable({
      element: el,
      getInitialData: () => ({ [DRAG_DATA_KEY]: getData() }),
      onGenerateDragPreview: ({ nativeSetDragImage }) => {
        setCustomNativeDragPreview({
          nativeSetDragImage,
          getOffset: pointerOutsideOfPreview({ x: "12px", y: "8px" }),
          render({ container }) {
            // Preview WYSIWYG (docs/09 §2.2). Estrategia por tipo de arrastre:
            const data = getData();
            const ghost = document.createElement("div");
            ghost.className = "pbx-drag-ghost";

            // 1) Nodo existente: clonar el elemento REAL ya renderizado en el
            //    canvas (buscado por data-node-id). Sus imágenes ya están
            //    cargadas, así que el preview es fiel aunque la fuente sea una
            //    URL remota (el re-render las tomaría sin cargar → en blanco).
            if (data.kind === "existing-node") {
              const live = document.querySelector<HTMLElement>(
                `[data-node-id="${data.nodeId}"]`,
              );
              if (live) {
                const clone = live.cloneNode(true) as HTMLElement;
                clone.removeAttribute("data-node-id");
                clone.classList.remove(
                  "pbx-node--selected",
                  "pbx-node--dragging",
                  "pbx-node--drop-over",
                );
                clone
                  .querySelectorAll("[data-drop-indicator], [data-empty-hint]")
                  .forEach((n) => n.remove());
                ghost.appendChild(clone);
                container.appendChild(ghost);
                return;
              }
            }

            // 2) Componente nuevo (sidebar) o sin elemento vivo: markup
            //    sintetizado del render real (P3).
            const markup = dragGhostMarkup(data);
            if (markup) {
              ghost.innerHTML = markup;
              container.appendChild(ghost);
              return;
            }

            // 3) Último recurso: chip con el nombre.
            const preview = document.createElement("div");
            preview.className = "pbx-drag-preview";
            preview.textContent = getPreviewLabel?.() ?? "";
            container.appendChild(preview);
          },
        });
      },
      onDragStart: () => setDragging(true),
      onDrop: () => setDragging(false),
    });
  }, [ref, getData, enabled, getPreviewLabel]);

  return { dragging };
}
