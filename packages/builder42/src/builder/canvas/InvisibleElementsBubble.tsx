/**
 * InvisibleElementsBubble — burbuja flotante de elementos no-visibles (docs/20
 * §5). Chrome del canvas (P8/P10): un círculo arrastrable con icono de "ojo
 * tapado" que abre un `Dropdown` (c42) con los modales y nodos ocultos de la
 * página. Click en un modal → abre su overlay de edición; en un nodo oculto →
 * lo selecciona.
 *
 * - Arrastrable por la pantalla; posición persistida en `useLocalConfig`.
 * - Punto rojo de notificación cuando aparece un nuevo elemento no-visible;
 *   se limpia al abrir el dropdown.
 * - Solo se muestra si hay ≥1 elemento no-visible (sin ruido cuando no hay).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { listInvisibleNodes } from "@/builder/model/invisible";
import { useLocalConfig } from "@/hooks/useLocalConfig";
import { Dropdown, ComponentTypeIcon, EyeOff } from "@/components";

const DRAG_THRESHOLD = 4;
const BUBBLE_SIZE = 52;

export function InvisibleElementsBubble() {
  const { t } = useTranslation("canvas");
  const { t: tc } = useTranslation("common");
  const nodes = useDocumentStore((s) => s.document.nodes);
  const rootId = useDocumentStore((s) => s.document.rootId);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const breakpoints = useDocumentStore((s) => s.site.meta.breakpoints);
  const openModalEditor = useDocumentStore((s) => s.openModalEditor);
  const select = useDocumentStore((s) => s.select);

  const [pos, setPos] = useLocalConfig("invisibleBubblePos");
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Ids "vistos" la última vez que se abrió el dropdown (para el dot de aviso).
  const [seen, setSeen] = useState<Set<string>>(new Set());

  const invisibles = useMemo(() => {
    const doc = { rootId, nodes, meta: { version: 1 } };
    return listInvisibleNodes(doc, activeBreakpoint, breakpoints).map((n) => {
      const def = getDefinition(n.type);
      const typeLabel = tc(`components.${n.type}`, { defaultValue: def?.label ?? n.type });
      const title = typeof n.props.title === "string" ? n.props.title.trim() : "";
      const propLabel = typeof n.props.label === "string" ? n.props.label.trim() : "";
      const content = typeof n.props.content === "string" ? n.props.content.replace(/<[^>]+>/g, "").trim() : "";
      const label = title || propLabel || content.slice(0, 40) || typeLabel;
      return { node: n, typeLabel, label };
    });
  }, [nodes, rootId, activeBreakpoint, breakpoints, tc]);

  const currentIds = useMemo(() => invisibles.map((i) => i.node.id), [invisibles]);
  const hasNew = currentIds.some((id) => !seen.has(id));

  // Si desaparecen todos, resetea la memoria de "vistos" (para volver a avisar).
  useEffect(() => {
    if (currentIds.length === 0 && seen.size > 0) setSeen(new Set());
  }, [currentIds, seen]);

  const markSeen = () => setSeen(new Set(currentIds));

  const onPointerDown = (e: React.PointerEvent) => {
    movedRef.current = false;
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    dragStart.current = { px: e.clientX, py: e.clientY, ox: rect.left, oy: rect.top };
    if (typeof el.setPointerCapture === "function") el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = dragStart.current;
    if (!start) return;
    const dx = e.clientX - start.px;
    const dy = e.clientY - start.py;
    if (!movedRef.current && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    movedRef.current = true;
    const maxX = window.innerWidth - BUBBLE_SIZE;
    const maxY = window.innerHeight - BUBBLE_SIZE;
    setDragPos({
      x: Math.max(0, Math.min(start.ox + dx, maxX)),
      y: Math.max(0, Math.min(start.oy + dy, maxY)),
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    if (typeof el.releasePointerCapture === "function") el.releasePointerCapture(e.pointerId);
    dragStart.current = null;
    if (movedRef.current && dragPos) setPos(dragPos);
  };

  // Suprime la apertura del dropdown si el "click" viene de un arrastre; si es
  // un click real, marca los no-visibles como vistos (limpia el dot).
  const onClickCapture = (e: React.MouseEvent) => {
    if (movedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    markSeen();
  };

  if (invisibles.length === 0) return null;

  const effectivePos = dragPos ?? (pos.x >= 0 ? pos : null);
  const style: React.CSSProperties = effectivePos
    ? { left: `${effectivePos.x}px`, top: `${effectivePos.y}px`, right: "auto", bottom: "auto" }
    : {};

  const onSelect = (id: string, type: string) => {
    if (type === "modal") openModalEditor(id);
    else select(id);
  };

  return (
    <div
      className="pbx-invisibles"
      style={style}
      data-positioned={effectivePos ? "" : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <Dropdown closeOnSelect placement="top-start" className="pbx-invisibles__dd">
        <button
          type="button"
          data-c42-dropdown-trigger
          className={"pbx-invisibles__fab" + (hasNew ? " pbx-invisibles__fab--alert" : "")}
          title={t("invisibles.open")}
          aria-label={t("invisibles.open")}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClickCapture={onClickCapture}
        >
          <EyeOff size={20} aria-hidden="true" />
          {hasNew ? <span className="pbx-invisibles__dot" aria-hidden="true" /> : null}
        </button>
        <div data-c42-dropdown-menu className="pbx-invisibles__menu">
          <div className="pbx-invisibles__title">{t("invisibles.title")}</div>
          <ul className="pbx-invisibles__list">
            {invisibles.map((i) => (
              <li key={i.node.id}>
                <button
                  type="button"
                  data-c42-dropdown-item
                  className="pbx-invisibles__item"
                  onClick={() => onSelect(i.node.id, i.node.type)}
                >
                  <ComponentTypeIcon type={i.node.type} className="pbx-invisibles__item-icon" />
                  <span className="pbx-invisibles__item-label" title={i.label}>
                    {i.label}
                    <span className="pbx-invisibles__item-type">{i.typeLabel}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Dropdown>
    </div>
  );
}
