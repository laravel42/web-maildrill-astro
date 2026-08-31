/**
 * KeyboardReorder — reordenamiento por teclado del nodo seleccionado (a11y,
 * Fase 4 · docs/04 §Fase 4). Chrome del editor: sólo se monta en modo Edit y
 * nunca sale al output (P8).
 *
 * Acorde **Alt + flechas** (evita chocar con el scroll del canvas, el undo/redo
 * y la escritura en inputs/textarea del Inspector o la vista JSON):
 *  - Alt+↑ / Alt+↓  → reordena entre hermanos (arriba/abajo).
 *  - Alt+←          → "desanida" (outdent) al contenedor abuelo.
 *  - Alt+→          → "anida" (indent) en el hermano anterior (si admite hijos).
 *
 * Reusa las acciones del store, que a su vez usan las ops PURAS de `tree.ts`
 * (P7). Anuncia el resultado en una región `aria-live` para lectores de
 * pantalla, distinguiendo movimiento efectivo de no-op (extremos, guardas).
 *
 * La región `aria-live` (`role="status"`) se monta AQUÍ y solo aquí: los
 * botones ▲▼◀▶ de click (`dnd/SelectionHandle.tsx`, docs/24 §2.1) publican
 * al mismo canal compartido (`reorderAnnouncer.ts`) en vez de montar su
 * propia región — un solo `role="status"` en el DOM para ambos caminos.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "../store/documentStore";
import { announceReorder, useReorderAnnouncement } from "./reorderAnnouncer";

/** ¿El foco está en un campo editable? Entonces las flechas son para escribir. */
function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    t.isContentEditable
  );
}

export function KeyboardReorder() {
  const { t } = useTranslation("canvas");
  const message = useReorderAnnouncement();

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (isEditableTarget(e.target)) return;

      const s = useDocumentStore.getState();
      const id = s.selectedId;
      if (!id) return;

      let run: (() => void) | null = null;
      let dirKey = "";
      switch (e.key) {
        case "ArrowUp":
          run = () => s.reorderNode(id, -1);
          dirKey = "dnd.moveUp";
          break;
        case "ArrowDown":
          run = () => s.reorderNode(id, 1);
          dirKey = "dnd.moveDown";
          break;
        case "ArrowLeft":
          run = () => s.outdentNodeAction(id);
          dirKey = "dnd.moveOut";
          break;
        case "ArrowRight":
          run = () => s.indentNode(id);
          dirKey = "dnd.moveIn";
          break;
        default:
          return;
      }

      e.preventDefault();
      const before = JSON.stringify(useDocumentStore.getState().document);
      run();
      const after = JSON.stringify(useDocumentStore.getState().document);
      const direction = t(dirKey);
      announceReorder(
        before === after
          ? t("dnd.cannotMove", { direction })
          : t("dnd.moved", { direction }),
      );
    };

    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [t]);

  return (
    <div className="pbx-sr-only" aria-live="polite" role="status">
      {message}
    </div>
  );
}
