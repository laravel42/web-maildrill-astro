/**
 * NodeActionsRail — barra lateral vertical de acciones sobre el nodo
 * SELECCIONADO (duplicar / eliminar), homologando el patrón `TuneMenu` de
 * email-builder (`documents/blocks/helpers/block-wrappers/TuneMenu.tsx`):
 * ahí las acciones de bloque viven en una franja lateral junto al elemento,
 * no en la pestaña superior de arrastre ni enterradas al fondo de un panel.
 *
 * Antes de este componente, builder42 repartía estas dos acciones en dos
 * sitios distintos:
 *  - Duplicar: un botón dentro de `SelectionHandle` (la pestaña superior de
 *    grip+label), mezclado con las flechas de reorder ▲▼◀▶ (docs/24 §2).
 *  - Eliminar: un icono de papelera al fondo de la tab bar del Inspector
 *    (`InspectorForm.tsx`), con su propia confirmación (`DeleteNodeConfirmModal`,
 *    solo si el nodo tiene hijos) y un toast con "Deshacer".
 *
 * Este componente consolida ambas en una única franja lateral pegada al
 * borde derecho del nodo — misma idea que `TuneMenu` (`right: -Xrem`,
 * columna vertical) — para que "duplicar"/"eliminar" tengan una sola fuente
 * de verdad visual, sin repetir el control en dos lugares (pedido explícito
 * de homologación UI/UX, fase C). La lógica de confirmación/toast se movió
 * aquí tal cual estaba en `InspectorForm.tsx` — no se simplifica ni se
 * quita, solo cambia de ubicación visual.
 *
 * Mismo sistema de coordenadas que `SelectionHandle` (mide contra el mismo
 * `frameRef`), pero se posiciona a la DERECHA del nodo (verticalmente
 * centrado en la porción VISIBLE de su alto dentro de `.pbx-canvas`, no en
 * su alto completo — fix, feedback de usuario: un nodo más alto que el
 * viewport del canvas, como el wrapper que agrupa todas las bandas de una
 * plantilla (D-F29.9), dejaba el centro geométrico fuera de pantalla tras
 * hacer scroll), no arriba — no compite por el mismo espacio que la
 * pestaña de arrastre ni con las flechas de reorder (que siguen ahí, sin
 * cambios, docs/24 §2/§3).
 *
 * Oculto en touch (`reorderControlsVisible`): igual que el botón de
 * duplicar que reemplaza, en ese modo las acciones directas se dejan a los
 * controles ▲▼◀▶/mover ya pensados para touch — evitar amontonar una
 * segunda pieza flotante sobre el mismo nodo en pantallas pequeñas.
 */

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Trash2, IconButton, SimpleModal, CloseIcon, ToastHost, useToast } from "@/components";
import { useDocumentStore } from "../store/documentStore";
import { undo } from "../store/useTemporalStore";
import { useReorderControlsVisible } from "@/hooks/usePointerCoarse";
import { dataTourAttr, BUILDER42_TOUR_ANCHORS } from "@/app/tour/tourAnchors";

interface NodeActionsRailProps {
  /** Frame del canvas: mismo sistema de coordenadas que `SelectionHandle`. */
  frameRef: RefObject<HTMLElement | null>;
}

interface Box {
  top: number;
  left: number;
}

/**
 * Confirmación de borrado cuando el nodo tiene hijos — copiada tal cual de
 * `InspectorForm.tsx` (`DeleteNodeConfirmModal`), mismo `SimpleModal`
 * StrictMode-safe (el `Modal` de c42-react pierde el estado que lo activó
 * bajo `React.StrictMode` cuando se monta como resultado de un update de
 * estado posterior al montaje inicial — exactamente este caso, click en la
 * papelera → aparece el modal).
 */
function DeleteNodeConfirmModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  const { t } = useTranslation("inspector");

  function handleConfirm() {
    onConfirm();
    onClose();
  }

  return (
    <SimpleModal className="pbx-modal" onClose={onClose}>
      <div data-c42-modal-overlay className="pbx-modal__overlay" />
      <div data-c42-modal-content className="pbx-modal__content pbx-template-confirm">
        <div className="pbx-modal__header">
          <div>
            <h3 className="pbx-modal__title">{t("panel.deleteConfirm.title")}</h3>
            <p className="pbx-modal__subtitle">{t("panel.deleteConfirm.body")}</p>
          </div>
          <IconButton
            icon={CloseIcon}
            intent="ghost"
            size="md"
            label={t("panel.deleteConfirm.cancel")}
            data-c42-modal-close
          />
        </div>
        <div className="pbx-modal__body pbx-template-confirm__actions">
          <button type="button" className="pbx-template-confirm__btn" onClick={onClose}>
            {t("panel.deleteConfirm.cancel")}
          </button>
          <button
            type="button"
            className="pbx-template-confirm__btn pbx-template-confirm__btn--primary"
            onClick={handleConfirm}
          >
            {t("panel.deleteConfirm.confirm")}
          </button>
        </div>
      </div>
    </SimpleModal>
  );
}

export function NodeActionsRail({ frameRef }: NodeActionsRailProps) {
  const { t } = useTranslation("canvas");
  const { t: tInspector } = useTranslation("inspector");
  const selectedId = useDocumentStore((s) => s.selectedId);
  const rootId = useDocumentStore((s) => s.document.rootId);
  const documentState = useDocumentStore((s) => s.document);
  const duplicateNode = useDocumentStore((s) => s.duplicateNode);
  const removeSelected = useDocumentStore((s) => s.removeSelected);
  const pickInsert = useDocumentStore((s) => s.pickInsert);
  const reorderControlsVisible = useReorderControlsVisible();
  const { toast, show: showToast, hide: hideToast } = useToast();
  const [pendingDelete, setPendingDelete] = useState(false);

  const node = selectedId ? documentState.nodes[selectedId] : undefined;
  // El root no se puede duplicar ni eliminar (no hay dónde insertarlo/nada
  // que quede en su lugar) — mismo criterio que `SelectionHandle` para no
  // mostrar su propia pestaña en el root.
  const enabled =
    !!selectedId && selectedId !== rootId && !!node && !reorderControlsVisible;
  const locked = pickInsert !== null;

  const handleDuplicate = useCallback(() => {
    if (selectedId) duplicateNode(selectedId);
  }, [selectedId, duplicateNode]);

  const performDelete = useCallback(() => {
    if (!selectedId) return;
    removeSelected();
    // Guarda de mínimos de slots (docs/23 §4, `slices/tree.ts`
    // `removeSelected`): si el nodo es una slot y su composite ya está en
    // `slots.min`, `removeSelected` es un no-op silencioso. Verificar que
    // el nodo realmente se borró antes de anunciar el toast — evita un
    // "eliminado" falso (docs/46 Fase 1).
    const stillExists = !!useDocumentStore.getState().document.nodes[selectedId];
    if (stillExists) return;
    showToast({
      message: tInspector("panel.deleteToast.message"),
      actionLabel: tInspector("panel.deleteToast.undo"),
      onAction: undo,
    });
  }, [selectedId, removeSelected, showToast, tInspector]);

  const handleDeleteClick = useCallback(() => {
    if (!node) return;
    const hasChildren = (node.children?.length ?? 0) > 0;
    if (hasChildren) {
      setPendingDelete(true);
      return;
    }
    performDelete();
  }, [node, performDelete]);

  const railRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!enabled || !selectedId || !frame) {
      setBox(null);
      return;
    }
    // Contenedor con scroll real (`.pbx-canvas`, `overflow: auto` en
    // `canvas.css`) — `frame` (`.pbx-canvas__frame`) es su contenido, así
    // que sube por el DOM real en vez de depender de una prop nueva desde
    // `Canvas.tsx` (mismo patrón que el resto de este archivo: medir contra
    // el DOM, no contra estado adicional).
    const scrollContainer = frame.closest<HTMLElement>(".pbx-canvas");

    const measure = () => {
      const el = frame.querySelector<HTMLElement>(`[data-node-id="${selectedId}"]`);
      if (!el) {
        setBox(null);
        return;
      }
      const nr = el.getBoundingClientRect();
      const fr = frame.getBoundingClientRect();
      const railEl = railRef.current;
      const railHeight = railEl?.offsetHeight ?? 0;
      // Nodo alto que no cabe en el viewport (fix, feedback de usuario): un
      // nodo más alto que la porción visible de `.pbx-canvas` — el wrapper
      // que agrupa todas las bandas de una plantilla es el caso típico
      // (D-F29.9) — deja el centro de SU RECT COMPLETO fuera de pantalla
      // tras hacer scroll, así que el rail quedaba flotando en una
      // coordenada que el usuario nunca veía sin scrollear a un punto
      // exacto. Se centra en cambio en la INTERSECCIÓN entre el rect del
      // nodo y el rect visible del scroll container — la porción del nodo
      // que efectivamente se ve — y se recorta además contra el propio
      // alto del rail para que nunca sobresalga por arriba/abajo de esa
      // porción visible. Sin `scrollContainer` (no debería pasar: el rail
      // solo se monta dentro de `.pbx-canvas`), cae al centro del rect
      // completo, el comportamiento de siempre.
      let centerY = nr.top + nr.height / 2;
      if (scrollContainer) {
        const cr = scrollContainer.getBoundingClientRect();
        const visibleTop = Math.max(nr.top, cr.top);
        const visibleBottom = Math.min(nr.bottom, cr.bottom);
        if (visibleBottom > visibleTop) {
          centerY = (visibleTop + visibleBottom) / 2;
          const minCenter = visibleTop + railHeight / 2;
          const maxCenter = visibleBottom - railHeight / 2;
          if (minCenter <= maxCenter) {
            centerY = Math.min(Math.max(centerY, minCenter), maxCenter);
          }
        }
      }
      setBox({
        top: centerY - fr.top - railHeight / 2,
        // Pegada AL BORDE del nodo, sin espacio (petición del usuario, este
        // commit — antes +8px de separación): se ve como una pestaña que
        // sale del propio elemento, no como un menú flotante aparte. El
        // radio de esquina también se ajustó a "solo lado derecho"
        // (`canvas-nodes.css`) para reforzar esa lectura.
        left: nr.left - fr.left + nr.width,
      });
    };
    measure();

    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(frame);
    const el = frame.querySelector<HTMLElement>(`[data-node-id="${selectedId}"]`);
    if (el) ro?.observe(el);
    if (railRef.current) ro?.observe(railRef.current);
    window.addEventListener("resize", measure);
    // Recalcular EN VIVO durante el scroll (fix): sin esto, `measure()` solo
    // corría una vez por selección/resize y el rail no seguía al nodo
    // mientras el usuario scrolleaba `.pbx-canvas`. `passive: true` (solo
    // lectura, nunca `preventDefault`) para no penalizar el scroll nativo.
    scrollContainer?.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      scrollContainer?.removeEventListener("scroll", measure);
    };
  }, [enabled, selectedId, frameRef]);

  if (!enabled || !box) return null;

  return (
    <>
      <div
        ref={railRef}
        className="pbx-node-actions-rail"
        style={{ top: box.top, left: box.left }}
        onClick={(ev) => ev.stopPropagation()}
        {...dataTourAttr(BUILDER42_TOUR_ANCHORS.canvasNodeActions)}
      >
        <IconButton
          icon={Copy}
          size="md"
          intent="ghost"
          disabled={locked}
          onClick={handleDuplicate}
          label={t("dnd.duplicate")}
        />
        <IconButton
          icon={Trash2}
          size="md"
          intent="danger"
          disabled={locked}
          onClick={handleDeleteClick}
          label={tInspector("panel.deleteNode")}
        />
      </div>
      {pendingDelete ? (
        <DeleteNodeConfirmModal onConfirm={performDelete} onClose={() => setPendingDelete(false)} />
      ) : null}
      <ToastHost toast={toast} onClose={hideToast} />
    </>
  );
}
