/**
 * ModalEditorOverlay — superficie de edición del modal (docs/20 §4.2). Se monta
 * cuando hay `editingModalId`: pinta un backdrop + un panel flotante con el
 * subárbol del modal renderizado como editable (`NodeRenderer … overlayRoot`),
 * donde se pueden arrastrar componentes desde la paleta y seleccionar hijos (el
 * Inspector derecho edita sus props).
 *
 * IMPORTANTE (docs/20, feedback de usuario): el overlay se limita al ÁREA DEL
 * CANVAS, no a toda la pantalla — así los sidebars (paleta izquierda / Inspector
 * derecho) quedan libres para arrastrar elementos DENTRO del modal. Se mide el
 * rect del `.pbx-canvas` y el overlay se posiciona `fixed` sobre él.
 *
 * Chrome puro (P8): nunca sale al export. Cerrar por X, click en el backdrop o
 * Escape.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { NodeRenderer } from "@/builder/canvas/NodeRenderer";
import { IconButton, CloseIcon } from "@/components";

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function ModalEditorOverlay() {
  const { t } = useTranslation("canvas");
  const editingModalId = useDocumentStore((s) => s.editingModalId);
  const closeModalEditor = useDocumentStore((s) => s.closeModalEditor);
  const exists = useDocumentStore((s) =>
    editingModalId ? s.document.nodes[editingModalId] !== undefined : false,
  );
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  // Mide el rect del canvas para acotar el overlay a su área (no toda la
  // pantalla). Se recalcula en resize (el scroll interno del canvas no cambia
  // su rect en pantalla, así que no hace falta escucharlo).
  useLayoutEffect(() => {
    if (!editingModalId) return;
    const canvas =
      (ref.current?.closest(".pbx-canvas") as HTMLElement | null) ??
      (document.querySelector(".pbx-canvas") as HTMLElement | null);
    if (!canvas) return;
    const measure = () => {
      const r = canvas.getBoundingClientRect();
      setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    let ro: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(canvas);
    }
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [editingModalId]);

  // Escape cierra el overlay (chrome-only).
  useEffect(() => {
    if (!editingModalId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModalEditor();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editingModalId, closeModalEditor]);

  if (!editingModalId || !exists) return null;

  const style: React.CSSProperties = box
    ? { position: "fixed", left: box.left, top: box.top, width: box.width, height: box.height }
    : { position: "fixed", left: 0, top: 0, width: 0, height: 0, overflow: "hidden" };

  return (
    <div
      ref={ref}
      className="pbx-modal-editor"
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={t("modalEditor.title")}
    >
      <div className="pbx-modal-editor__backdrop" onClick={closeModalEditor} aria-hidden="true" />
      {/* Chrome de edición: flotante y SEPARADO del modal para no alterar su
          aspecto (WYSIWYG — feedback de usuario). El modal se ve tal cual será. */}
      <div className="pbx-modal-editor__toolbar">
        <span className="pbx-modal-editor__title">{t("modalEditor.title")}</span>
        <IconButton icon={CloseIcon} size="sm" onClick={closeModalEditor} label={t("modalEditor.close")} />
      </div>
      <div className="pbx-modal-editor__stage" onClick={(e) => e.stopPropagation()}>
        <NodeRenderer key={editingModalId} id={editingModalId} interactive overlayRoot />
      </div>
    </div>
  );
}
