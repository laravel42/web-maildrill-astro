/**
 * PickInsertBar — banner de modo colocación del "pick & insert" (Vía B,
 * docs/24 §3.2 paso 1): se monta cuando `pickInsert` está activo, indica qué
 * se está colocando y ofrece "Cancelar". Overlay del canvas, chrome puro
 * (P8): nunca sale al HTML exportado.
 *
 * Mini-dropdown de confirmación (Fase 4, docs/24 §3.2 paso 3): cuando hay un
 * `candidate` (preview activo, Fase 3), el banner se extiende con
 * "✓ Confirmar aquí" / ▲▼ (mueve el índice un paso sin re-tocar el canvas) /
 * ◄► "salir/entrar del contenedor" (Fase 4b, docs/24 §4 — feedback de
 * usuario: faltaba forma de cambiar de NIVEL sin re-tocar el canvas, solo
 * había reordenamiento dentro del mismo padre) / "Cancelar". Outdent/indent
 * reusan las MISMAS ops puras de árbol que `SelectionHandle` pero en su
 * variante para un `DropTarget` VIRTUAL (`outdentDropTarget`/
 * `indentDropTarget`, `tree.ts`): el `candidate` es solo un preview, nunca
 * hay un nodo real que mover todavía (P1). Los iconos son `OutdentIcon`/
 * `IndentIcon` (`ListIndentDecrease`/`ListIndentIncrease` de Lucide, mismos
 * que `SelectionHandle`) — no flechas ←/→, que no comunican la acción sin
 * tooltip visible (touch). Vive en la MISMA barra en vez de un popup anclado
 * al nodo — se mantiene siempre visible (no se pierde con scroll del canvas)
 * y reusa el mismo banner en vez de duplicar lógica de posicionamiento.
 * Combina con la "doble modalidad" (§3.2): el segundo tap en el mismo
 * destino TAMBIÉN confirma (`NodeRenderer.tsx`) — ambos caminos llaman a
 * `confirmPickInsertTarget` con el `candidate` exacto.
 *
 * Cierra por click en "Cancelar" o `Escape` (mismo patrón que
 * `ModalEditorOverlay.tsx`: `useEffect` con `document.addEventListener`
 * `keydown`). Cancelar NO muta el documento (P1) — solo limpia `pickInsert`.
 */

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "../store/documentStore";
import { getDefinition } from "../registry/componentRegistry";
import { CloseIcon, Check, ArrowUp, ArrowDown, OutdentIcon, IndentIcon } from "@/components";

export function PickInsertBar() {
  const { t } = useTranslation("canvas");
  const { t: tc } = useTranslation("common");
  const pickInsert = useDocumentStore((s) => s.pickInsert);
  const cancelPickInsert = useDocumentStore((s) => s.cancelPickInsert);
  const confirmPickInsertTarget = useDocumentStore((s) => s.confirmPickInsertTarget);
  const setPickInsertCandidate = useDocumentStore((s) => s.setPickInsertCandidate);
  const outdentPickInsertCandidate = useDocumentStore((s) => s.outdentPickInsertCandidate);
  const indentPickInsertCandidate = useDocumentStore((s) => s.indentPickInsertCandidate);
  const canOutdentPickInsertCandidate = useDocumentStore((s) => s.canOutdentPickInsertCandidate);
  const canIndentPickInsertCandidate = useDocumentStore((s) => s.canIndentPickInsertCandidate);
  const candidateChildCount = useDocumentStore((s) => {
    const candidate = pickInsert?.candidate;
    if (!candidate) return 0;
    return s.document.nodes[candidate.parentId]?.children?.length ?? 0;
  });
  const nodeType = useDocumentStore((s) =>
    pickInsert?.source.kind === "existing"
      ? s.document.nodes[pickInsert.source.nodeId]?.type
      : undefined,
  );

  useEffect(() => {
    if (!pickInsert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelPickInsert();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pickInsert, cancelPickInsert]);

  if (!pickInsert) return null;

  const type = pickInsert.source.kind === "new" ? pickInsert.source.type : nodeType;
  const label = type
    ? tc(`components.${type}`, { defaultValue: getDefinition(type)?.label ?? type })
    : "";
  const candidate = pickInsert.candidate;

  return (
    <div className="pbx-pick-insert-bar" role="status">
      <span className="pbx-pick-insert-bar__label">
        {candidate ? t("pickInsert.previewLabel", { label }) : t("pickInsert.prompt", { label })}
      </span>
      {candidate ? (
        <div className="pbx-pick-insert-bar__confirm-group">
          <button
            type="button"
            className="pbx-pick-insert-bar__step"
            disabled={candidate.index <= 0}
            aria-label={t("pickInsert.moveUp")}
            title={t("pickInsert.moveUp")}
            onClick={() =>
              setPickInsertCandidate({ parentId: candidate.parentId, index: candidate.index - 1 })
            }
          >
            <ArrowUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pbx-pick-insert-bar__step"
            disabled={candidate.index >= candidateChildCount}
            aria-label={t("pickInsert.moveDown")}
            title={t("pickInsert.moveDown")}
            onClick={() =>
              setPickInsertCandidate({ parentId: candidate.parentId, index: candidate.index + 1 })
            }
          >
            <ArrowDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pbx-pick-insert-bar__step"
            disabled={!canOutdentPickInsertCandidate()}
            aria-label={t("dnd.outdent")}
            title={t("dnd.outdent")}
            onClick={outdentPickInsertCandidate}
          >
            <OutdentIcon size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pbx-pick-insert-bar__step"
            disabled={!canIndentPickInsertCandidate()}
            aria-label={t("dnd.indent")}
            title={t("dnd.indent")}
            onClick={indentPickInsertCandidate}
          >
            <IndentIcon size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pbx-pick-insert-bar__confirm"
            onClick={() => confirmPickInsertTarget(candidate.parentId)}
          >
            <Check size={14} aria-hidden="true" />
            {t("pickInsert.confirm")}
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="pbx-pick-insert-bar__cancel"
        onClick={cancelPickInsert}
      >
        <CloseIcon size={14} aria-hidden="true" />
        {t("pickInsert.cancel")}
      </button>
    </div>
  );
}
