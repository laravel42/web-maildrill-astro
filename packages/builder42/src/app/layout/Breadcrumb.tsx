/**
 * Breadcrumb / parent selector de nodos (docs/02 §11.5, rediseño Fase 11).
 *
 * Muestra la ruta de ancestros del nodo seleccionado (root › … › nodo) con
 * segmentos clicables — útil para alcanzar contenedores padre difíciles de
 * clicar en el canvas. Chrome del editor: lee `getPath` (puro) y despacha
 * `select`.
 *
 * Anidamiento profundo: cuando hay **más de dos** nodos entre el primero y el
 * último (ruta > `MAX_VISIBLE`), los intermedios se **colapsan** en un botón
 * "…" que, al pasar el ratón (**hover**, tooltip c42), revela el **path
 * completo** de componentes — cada uno clicable para seleccionarlo. Siempre
 * quedan visibles el primer nodo (raíz) y el nodo actual. Cada segmento lleva
 * su icono de tipo (ComponentTypeIcon) para lectura rápida y compacta.
 */

import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { getPath } from "@/builder/model/tree";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { isHiddenAt } from "@/builder/model/visibility";
import { Tooltip, ComponentTypeIcon, ChevronRight, Ellipsis, EyeOff } from "@/components";
import type { NodeId } from "@/builder/model/types";

/** Nº máximo de segmentos antes de colapsar: con 3+ nodos aparece el "…". */
const MAX_VISIBLE = 2;

export function Breadcrumb() {
  const { t } = useTranslation("common");
  const document = useDocumentStore((s) => s.document);
  const selectedId = useDocumentStore((s) => s.selectedId);
  const select = useDocumentStore((s) => s.select);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const breakpointConfig = useDocumentStore((s) => s.site.meta.breakpoints);

  if (!selectedId || !document.nodes[selectedId]) return null;
  const path = getPath(document, selectedId);
  if (path.length === 0) return null;

  const labelFor = (id: NodeId): string => {
    const node = document.nodes[id]!;
    const def = getDefinition(node.type);
    return t(`components.${node.type}`, { defaultValue: def?.label ?? node.type });
  };

  const Segment = ({ id, withSep }: { id: NodeId; withSep: boolean }) => {
    const node = document.nodes[id]!;
    const label = labelFor(id);
    const isCurrent = id === selectedId;
    // docs/41 §5.2/§10.8 (Paso 7): ojo tachado de SOLO LECTURA en el chip del
    // breadcrumb cuando el nodo actual está oculto en el breakpoint activo —
    // señal visible sin necesidad de abrir la tab Estilo.
    const showHiddenIndicator = isCurrent && isHiddenAt(node.style, activeBreakpoint, breakpointConfig);
    return (
      <span className="pbx-node-path__seg">
        {withSep ? <ChevronRight size={12} className="pbx-node-path__sep" aria-hidden="true" /> : null}
        <button
          type="button"
          className={"pbx-node-path__btn" + (isCurrent ? " pbx-node-path__btn--current" : "")}
          aria-current={isCurrent ? "true" : undefined}
          onClick={() => select(id)}
          title={label}
        >
          <ComponentTypeIcon type={node.type} className="pbx-node-path__icon" />
          <span className="pbx-node-path__text">{label}</span>
          {showHiddenIndicator ? (
            <EyeOff size={12} className="pbx-node-path__hidden-icon" aria-hidden="true" />
          ) : null}
        </button>
      </span>
    );
  };

  const collapse = path.length > MAX_VISIBLE;

  return (
    <nav
      className="pbx-node-path"
      aria-label={t("breadcrumbAriaLabel", { ns: "inspector", defaultValue: "Path of selected node" })}
    >
      {!collapse ? (
        path.map((id, i) => <Segment key={id} id={id} withSep={i > 0} />)
      ) : (
        <>
          <Segment id={path[0]!} withSep={false} />
          <span className="pbx-node-path__seg">
            <ChevronRight size={12} className="pbx-node-path__sep" aria-hidden="true" />
            <Tooltip placement="bottom-start" className="pbx-node-path__collapse" openDelay={60} closeDelay={180}>
              <button
                type="button"
                data-c42-tooltip-trigger
                className="pbx-node-path__btn pbx-node-path__ellipsis"
                aria-label={t("breadcrumbMore", { ns: "inspector", defaultValue: "Show full path" })}
              >
                <Ellipsis size={14} aria-hidden="true" />
              </button>
              {/* Hover: se revela el path completo de componentes (clicable). */}
              <div data-c42-tooltip-content className="pbx-node-path__menu">
                {path.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      "pbx-node-path__menu-item" +
                      (id === selectedId ? " pbx-node-path__menu-item--current" : "")
                    }
                    onClick={() => select(id)}
                    title={labelFor(id)}
                  >
                    <ComponentTypeIcon type={document.nodes[id]!.type} className="pbx-node-path__icon" />
                    <span>{labelFor(id)}</span>
                  </button>
                ))}
              </div>
            </Tooltip>
          </span>
          <Segment id={path[path.length - 1]!} withSep={true} />
        </>
      )}
    </nav>
  );
}
