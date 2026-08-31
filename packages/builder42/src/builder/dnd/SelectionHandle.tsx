/**
 * SelectionHandle — "pestaña" de arrastre del nodo SELECCIONADO (docs/02 §11.1).
 *
 * Resuelve el hueco de "todo el nodo es agarrable": con innermost-wins (§10.1),
 * un nodo sin superficie libre (un `Container` sin padding lleno de hijos, o una
 * hoja diminuta) queda difícil o imposible de agarrar. La pestaña ofrece un punto
 * de agarre estable, centrado sobre el borde superior del nodo, mientras está
 * seleccionado. También aplica al `text`, que pasará a edición en línea (Fase 3)
 * y perdería su zona de agarre directa.
 *
 * ¿Por qué a nivel de frame y no dentro del nodo? Un `<img>` es un elemento VOID
 * (no admite hijos) y las hojas no son `position:relative`, así que inyectar la
 * pestaña como hijo del nodo no cubre todos los tipos. Como sólo hay UN nodo
 * seleccionado a la vez, basta con UNA pestaña que se posiciona por el rect del
 * nodo (medido contra el frame). Es chrome de edición: sólo se monta en modo
 * `edit` (el Canvas la omite en preview/export/code), nunca sale al HTML (P8).
 *
 * No lleva `data-node-id`, así que no entra en la medición de hijos del drop
 * target (`useDropTarget.measureChildRects`) ni afecta al cálculo de índice.
 *
 * También aloja el grupo de flechas ▲▼◀▶ de reordenamiento por click
 * (docs/24 §2) MÁS el botón "mover" (icono `Move`, pick & insert, Vía B,
 * docs/24 §3) que inicia `startPickInsertExisting(selectedId)`: reutilizan
 * las MISMAS acciones de store que `Alt+flechas` (`KeyboardReorder.tsx`) —
 * `reorderNode`/`outdentNodeAction`/`indentNode` — sin duplicar lógica de
 * árbol (P7). TODO el grupo (flechas + botón "mover") comparte la misma
 * visibilidad, regida por la preferencia `reorderControls`
 * (`useReorderControlsVisible`, auto detecta puntero "coarse"/touch +
 * ancho ≤tablet): son controles pensados para dispositivos donde el DnD
 * nativo no funciona (touch), no para desktop con puntero fino, donde el
 * DnD normal ya cubre mover/reordenar — si el usuario encuentra problemas de
 * DnD en su dispositivo, puede forzar "on" desde el `ProfileMenu`
 * (`ReorderControlsToggle`). El estado `disabled` de cada botón se calcula
 * con selectores puros del store (`canReorderNode`/`canOutdentSelected`/
 * `canIndentNode`) que reflejan si la acción sería no-op SIN ejecutarla.
 * Mientras `pickInsert` está activo (lock, docs/24 §9 decisión #4), TODO el
 * grupo (flechas + arrastre + el propio botón "mover") queda deshabilitado —
 * evita acciones concurrentes sobre el árbol mientras se coloca algo.
 *
 * Fusión visual con el grupo de flechas cuando `reorderControlsVisible`
 * (feedback de usuario, iterado tres veces: 1. no debían coexistir como dos
 * piezas separadas; 2. el resultado debe ser UNA SOLA fila horizontal sobre
 * el nodo, en el mismo lugar donde hoy vive el grip+nombre, no dos filas
 * apiladas; 3. el grip de arrastre (`GripVertical`) debe OCULTARSE en ese
 * modo — mostrarlo sugiere "arrastrable" cuando el drag nativo ya está
 * desactivado, así que el ícono quedaba comunicando una acción que no
 * responde al gesto). En ese modo, el `.pbx-drag-handle` deja de ser una
 * pestaña "mínima" (solo grip+label) y se convierte en la ÚNICA pieza
 * montada: nombre del componente + los botones ▲▼◀▶/mover, sin el grip
 * (reemplazado por los botones reales, que sí responden a tap) — el drag
 * handle normal directamente NO se renderiza (no hay dos elementos
 * posicionados, uno sobre otro). (a) el drag nativo se DESACTIVA
 * (`useDraggable` con `enabled=false` — Pragmatic no funciona en touch, es
 * la razón de ser de estos controles, así que dejarlo activo sería un
 * control fantasma que no responde al gesto); (b) el bloque pierde
 * `role="button"`/`aria-label`/`title` de arrastre (ya no es interactivo
 * como pestaña, solo contenedor de los botones reales, que tienen sus
 * propios `aria-label`); (c) la clase modificadora `pbx-drag-handle--merged`
 * (`chrome.css`) ensancha el padding/gap para alojar label+botones en una
 * fila, con el mismo gradiente accent y el mismo `border-radius` solo
 * arriba (pegado al nodo, look "soldado" ya existente). En desktop
 * (`!reorderControlsVisible`) el aspecto es idéntico al de siempre: pestaña
 * mínima flotante y arrastrable, sin ningún botón de flechas.
 */

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";
import { ArrowUp, ArrowDown, OutdentIcon, IndentIcon, Move, Copy, GripVertical } from "@/components";
import { useDocumentStore } from "../store/documentStore";
import { getDefinition } from "../registry/componentRegistry";
import { useDraggable } from "./useDraggable";
import { useReorderControlsVisible } from "@/hooks/usePointerCoarse";
import { announceReorder } from "../canvas/reorderAnnouncer";
import type { DragData } from "./contract";

interface SelectionHandleProps {
  /** Frame del canvas: sistema de coordenadas y `offsetParent` de la pestaña. */
  frameRef: RefObject<HTMLElement | null>;
}

interface Box {
  top: number;
  left: number;
}

// px — alto estimado de la pestaña antes de su primera medición real
// (`handleRef.current.offsetHeight`), para no calcular una posición
// desplazada de más en el primer frame tras montarse.
const HANDLE_HEIGHT_FALLBACK = 26;

// ms — debe coincidir con la duración de `pbx-drag-handle-exit` en
// `chrome.css`: el tiempo que se mantiene montado el nodo tras deseleccionar,
// para que la animación de salida termine antes de desmontar de verdad.
const EXIT_DURATION_MS = 140;

export function SelectionHandle({ frameRef }: SelectionHandleProps) {
  const { t } = useTranslation("canvas");
  const { t: tc } = useTranslation("common");
  const selectedId = useDocumentStore((s) => s.selectedId);
  const rootId = useDocumentStore((s) => s.document.rootId);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const documentState = useDocumentStore((s) => s.document);
  const reorderNode = useDocumentStore((s) => s.reorderNode);
  const outdentNodeAction = useDocumentStore((s) => s.outdentNodeAction);
  const indentNode = useDocumentStore((s) => s.indentNode);
  const canReorderNode = useDocumentStore((s) => s.canReorderNode);
  const canOutdentSelected = useDocumentStore((s) => s.canOutdentSelected);
  const canIndentNode = useDocumentStore((s) => s.canIndentNode);
  const duplicateNode = useDocumentStore((s) => s.duplicateNode);
  const pickInsert = useDocumentStore((s) => s.pickInsert);
  const startPickInsertExisting = useDocumentStore((s) => s.startPickInsertExisting);
  const reorderControlsVisible = useReorderControlsVisible();

  const node = selectedId ? documentState.nodes[selectedId] : undefined;
  // El root no es arrastrable (no hay dónde moverlo): sin pestaña, como el nodo mismo.
  const enabled = !!selectedId && selectedId !== rootId && !!node;
  const label = node ? tc(`components.${node.type}`, { defaultValue: getDefinition(node.type)?.label ?? node.type }) : "";

  // Disponibilidad de cada flecha (docs/24 §2.1), recalculada en cada render
  // desde selectores puros — no ejecutan la acción, solo reflejan si sería no-op.
  // Deshabilitadas por completo mientras hay un pick & insert en curso (lock,
  // docs/24 §9 decisión #4): evita acciones concurrentes sobre el árbol.
  const locked = pickInsert !== null;
  const canUp = enabled && !locked && canReorderNode(selectedId as string, -1);
  const canDown = enabled && !locked && canReorderNode(selectedId as string, 1);
  const canOutdent = enabled && !locked && canOutdentSelected(selectedId as string);
  const canIndent = enabled && !locked && canIndentNode(selectedId as string);
  const canMove = enabled && !locked;

  const runReorder = useCallback(
    (action: () => void, dirKey: string) => {
      if (!selectedId) return;
      const before = JSON.stringify(useDocumentStore.getState().document);
      action();
      const after = JSON.stringify(useDocumentStore.getState().document);
      const direction = t(dirKey);
      announceReorder(
        before === after
          ? t("dnd.cannotMove", { direction })
          : t("dnd.moved", { direction }),
      );
    },
    [selectedId, t],
  );

  const handleUp = useCallback(() => {
    if (selectedId) runReorder(() => reorderNode(selectedId, -1), "dnd.moveUp");
  }, [selectedId, reorderNode, runReorder]);
  const handleDown = useCallback(() => {
    if (selectedId) runReorder(() => reorderNode(selectedId, 1), "dnd.moveDown");
  }, [selectedId, reorderNode, runReorder]);
  const handleOutdent = useCallback(() => {
    if (selectedId) runReorder(() => outdentNodeAction(selectedId), "dnd.moveOut");
  }, [selectedId, outdentNodeAction, runReorder]);
  const handleIndent = useCallback(() => {
    if (selectedId) runReorder(() => indentNode(selectedId), "dnd.moveIn");
  }, [selectedId, indentNode, runReorder]);
  const handleMove = useCallback(() => {
    if (selectedId) startPickInsertExisting(selectedId);
  }, [selectedId, startPickInsertExisting]);
  const handleDuplicate = useCallback(() => {
    if (selectedId) duplicateNode(selectedId);
  }, [selectedId, duplicateNode]);

  const handleRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  // Sigue MONTADO un instante tras deseleccionar (`enabled` → false), para
  // que corra la animación de salida en vez de desaparecer de golpe (bug
  // real, feedback de usuario: sin `motion.div`/`AnimatePresence`, el
  // `unmount` inmediato en `!enabled → return null` no dejaba lugar para
  // ninguna transición). Mismo `label`/`box` que tenía al momento de
  // deseleccionar (se congelan, no siguen la selección nueva mientras salen).
  const [exiting, setExiting] = useState<{ label: string; box: Box | null } | null>(null);
  const wasEnabledRef = useRef(false);

  const getData = useCallback<() => DragData>(
    () => ({ kind: "existing-node", nodeId: selectedId as string }),
    [selectedId],
  );
  const getPreviewLabel = useCallback(() => label, [label]);
  // En touch (`reorderControlsVisible`), el DnD nativo (Pragmatic) no
  // funciona — es la razón de ser de los controles ▲▼◀▶/mover (docs/24 §2).
  // Registrar el handle como `draggable` ahí sería un control fantasma que
  // no responde al gesto: se desactiva y el handle se fusiona VISUALMENTE
  // con el grupo de flechas (mismo bloque, sin la pestaña "flotante"
  // independiente — feedback de usuario, evita la sensación de "dos
  // controles" para la misma acción).
  const { dragging } = useDraggable(
    handleRef,
    getData,
    enabled && pickInsert === null && !reorderControlsVisible,
    getPreviewLabel,
  );

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!enabled || !selectedId || !frame) {
      setBox(null);
      return;
    }
    const measure = () => {
      const el = frame.querySelector<HTMLElement>(`[data-node-id="${selectedId}"]`);
      if (!el) {
        setBox(null);
        return;
      }
      const nr = el.getBoundingClientRect();
      const fr = frame.getBoundingClientRect();
      // Ancho/alto REALES de la propia pestaña: el centrado horizontal y la
      // elevación por FUERA del borde superior del nodo se calculan en
      // `top`/`left` puros (no en `transform` CSS — bug real, feedback de
      // usuario: este componente usaba `motion.div` de framer-motion para
      // animar la entrada, que gestiona `transform` vía `style` inline y
      // pisaba cualquier `transform` de posicionamiento declarado en
      // `chrome.css`. Se quitó `motion.div` en favor de un `div` + animación
      // CSS de entrada, precisamente para no competir por esa propiedad).
      // `handleRef` puede no estar medido aún en el primer layout (recién
      // montado): se usa un fallback conservador hasta que sí lo esté.
      const handleEl = handleRef.current;
      const handleWidth = handleEl?.offsetWidth ?? 0;
      const handleHeight = handleEl?.offsetHeight ?? HANDLE_HEIGHT_FALLBACK;
      setBox({
        top: nr.top - fr.top - handleHeight,
        left: nr.left - fr.left + nr.width / 2 - handleWidth / 2,
      });
    };
    measure();

    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(frame);
    const el = frame.querySelector<HTMLElement>(`[data-node-id="${selectedId}"]`);
    if (el) ro?.observe(el);
    // También observa la propia pestaña: su ancho/alto varían con el largo
    // del label (nombre del componente) y hacen falta para centrar/elevar.
    if (handleRef.current) ro?.observe(handleRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, selectedId, activeBreakpoint, documentState, frameRef]);

  // Detecta la transición `enabled: true → false` (deseleccionar, borrar el
  // nodo, cambiar de página…) para animar la SALIDA en vez de desmontar de
  // golpe. Congela el `label`/`box` que tenía justo antes de deshabilitarse
  // (no debe reflejar ninguna selección nueva mientras se anima afuera) y
  // se limpia sola tras `EXIT_DURATION_MS` — sincronizado con la duración de
  // `pbx-drag-handle-exit` en `chrome.css`.
  useLayoutEffect(() => {
    if (enabled) {
      wasEnabledRef.current = true;
      setExiting(null);
      return;
    }
    if (!wasEnabledRef.current) return; // nunca estuvo habilitada: nada que animar afuera.
    wasEnabledRef.current = false;
    setExiting({ label, box });
    const timeout = window.setTimeout(() => setExiting(null), EXIT_DURATION_MS);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `label`/`box` se leen
    // deliberadamente solo en el instante del cambio de `enabled`, no se
    // quiere re-disparar la salida si cambian por otra razón.
  }, [enabled]);

  if (!enabled) {
    if (!exiting || !exiting.box) return null;
    return (
      <div
        data-drag-handle
        aria-hidden="true"
        className="pbx-drag-handle pbx-drag-handle--exiting"
        style={{ top: exiting.box.top, left: exiting.box.left }}
      >
        <span className="pbx-drag-handle__grip" aria-hidden="true">
          <GripVertical size={14} />
        </span>
        <span className="pbx-drag-handle__label">{exiting.label}</span>
      </div>
    );
  }

  return (
    <div
      ref={handleRef}
      data-drag-handle
      role={reorderControlsVisible ? undefined : "button"}
      aria-label={reorderControlsVisible ? undefined : t("dnd.dragHandle", { label })}
      title={reorderControlsVisible ? undefined : t("dnd.dragHandleTitle", { label })}
      className={[
        "pbx-drag-handle",
        dragging ? "pbx-drag-handle--dragging" : "",
        reorderControlsVisible ? "pbx-drag-handle--merged" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        top: box?.top ?? 0,
        left: box?.left ?? 0,
        visibility: box ? undefined : "hidden",
      }}
    >
      {reorderControlsVisible ? null : (
        <span className="pbx-drag-handle__grip" aria-hidden="true">
          <GripVertical size={14} />
        </span>
      )}
      <span className="pbx-drag-handle__label">{label}</span>
      {reorderControlsVisible ? (
        <span className="pbx-reorder-arrows">
          <button
            type="button"
            className="pbx-reorder-arrows__btn"
            disabled={!canUp}
            aria-label={t("dnd.reorderUp")}
            title={t("dnd.reorderUp")}
            onClick={handleUp}
          >
            <ArrowUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pbx-reorder-arrows__btn"
            disabled={!canDown}
            aria-label={t("dnd.reorderDown")}
            title={t("dnd.reorderDown")}
            onClick={handleDown}
          >
            <ArrowDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pbx-reorder-arrows__btn"
            disabled={!canOutdent}
            aria-label={t("dnd.outdent")}
            title={t("dnd.outdent")}
            onClick={handleOutdent}
          >
            <OutdentIcon size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pbx-reorder-arrows__btn"
            disabled={!canIndent}
            aria-label={t("dnd.indent")}
            title={t("dnd.indent")}
            onClick={handleIndent}
          >
            <IndentIcon size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pbx-reorder-arrows__btn"
            disabled={!canMove}
            aria-label={t("dnd.pickInsertMove")}
            title={t("dnd.pickInsertMove")}
            onClick={handleMove}
          >
            <Move size={14} aria-hidden="true" />
          </button>
        </span>
      ) : null}
      {!locked ? (
        <button
          type="button"
          className="pbx-reorder-arrows__btn"
          disabled={!enabled}
          aria-label={t("dnd.duplicate")}
          title={t("dnd.duplicate")}
          onClick={handleDuplicate}
        >
          <Copy size={14} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
