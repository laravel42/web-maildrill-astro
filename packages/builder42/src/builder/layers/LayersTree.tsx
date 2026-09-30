/**
 * LayersTree — árbol de capas de la página activa (docs/01 §8.3). Chrome del
 * editor (P8): deriva del store (P1), no toca el documento salvo por las
 * acciones `select` / `toggleNodeVisibility`.
 *
 * Permite alcanzar nodos que están OCULTOS en el breakpoint activo (y por tanto
 * no se pueden clicar en el canvas). Usa el `Tree` headless de c42 (P10) para
 * expandir/colapsar, navegación por teclado y ARIA; el contenido de cada fila
 * (label + marca de oculto + botón mostrar/ocultar) es nuestro.
 *
 * La marca de "oculto" se evalúa contra el `activeBreakpoint` (P5), igual que el
 * canvas y el Inspector — cambiar de viewport recalcula qué filas están ocultas.
 */

import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { IconButton, Tree, ComponentTypeIcon, ChevronRight, Eye, EyeOff } from "@/components";
import { useDocumentStore } from "@/builder/store/documentStore";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { isHiddenAt } from "@/builder/model/visibility";
import type { Breakpoint, BreakpointConfig, BuilderDocument, NodeId } from "@/builder/model/types";

function LayersNode({
  id,
  depth,
  doc,
  breakpoint,
  cfg,
  rootId,
}: {
  id: NodeId;
  depth: number;
  doc: BuilderDocument;
  breakpoint: Breakpoint;
  cfg: BreakpointConfig;
  /** Raíz REAL del documento (`doc.rootId`): intocable por diseño (D-F29.9) —
   * `removeNode`/`SelectionHandle`/`NodeActionsRail` la excluyen en todo el
   * resto del editor. Esta fila la marca como tal (fila atenuada, sin botón
   * de selección ni de ojo) para que no parezca un nodo normal: antes nada
   * distinguía "seleccionar la raíz" de seleccionar cualquier otro nodo, así
   * que un click aquí dejaba `selectedId` apuntando a un nodo que el
   * Inspector sí refleja pero que el canvas nunca resalta y no se puede
   * borrar — el síntoma reportado por el usuario. */
  rootId: NodeId;
}) {
  const { t } = useTranslation("header");
  const { t: tc } = useTranslation("common");
  const selectedId = useDocumentStore((s) => s.selectedId);
  const select = useDocumentStore((s) => s.select);
  const toggleNodeVisibility = useDocumentStore((s) => s.toggleNodeVisibility);

  const node = doc.nodes[id];
  if (!node) return null;

  const isRoot = id === rootId;
  const def = getDefinition(node.type);
  const label = isRoot
    ? t("layers.rootLabel")
    : tc(`components.${node.type}`, { defaultValue: def?.label ?? node.type });
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const hidden = !isRoot && isHiddenAt(node.style, breakpoint, cfg);
  const selected = selectedId === id;

  return (
    <li data-c42-tree-item data-value={id}>
      <div
        data-c42-tree-row
        className={
          "pbx-layers__row" +
          (selected ? " pbx-layers__row--selected" : "") +
          (hidden ? " pbx-layers__row--hidden" : "") +
          (isRoot ? " pbx-layers__row--root" : "")
        }
        style={{ paddingInlineStart: `${depth * 14 + 6}px` }}
      >
        {hasChildren ? (
          <button type="button" data-c42-tree-toggle className="pbx-layers__toggle" aria-label={t("layers.toggleExpand")}>
            <ChevronRight size={12} className="pbx-layers__chevron" aria-hidden="true" />
          </button>
        ) : (
          <span className="pbx-layers__toggle pbx-layers__toggle--leaf" aria-hidden="true" />
        )}

        <ComponentTypeIcon type={node.type} className="pbx-layers__icon" />

        {isRoot ? (
          <span
            className="pbx-layers__label pbx-layers__label--root"
            title={t("layers.rootLocked")}
          >
            {label}
          </span>
        ) : (
          <button
            type="button"
            className="pbx-layers__label"
            onClick={() => select(id)}
            aria-current={selected ? "true" : undefined}
            title={label}
          >
            {label}
          </button>
        )}

        {hidden ? (
          <span className="pbx-layers__badge" title={t("layers.hiddenAt", { breakpoint })}>
            {t("layers.hiddenBadge")}
          </span>
        ) : null}

        {isRoot ? null : (
          <IconButton
            className="pbx-layers__eye"
            intent="ghost"
            active={hidden}
            onClick={() => toggleNodeVisibility(id)}
            label={hidden ? t("layers.show") : t("layers.hide")}
          >
            {hidden ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
          </IconButton>
        )}
      </div>

      {hasChildren ? (
        <ul data-c42-tree-group className="pbx-layers__group">
          {children.map((childId) => (
            <LayersNode
              key={childId}
              id={childId}
              depth={depth + 1}
              doc={doc}
              breakpoint={breakpoint}
              cfg={cfg}
              rootId={rootId}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function LayersTree() {
  const { t } = useTranslation("header");
  const doc = useDocumentStore((s) => s.document);
  const breakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const cfg = useDocumentStore((s) => s.site.meta.breakpoints);

  const root = doc.nodes[doc.rootId];
  if (!root) return <p className="pbx-layers__empty">{t("layers.empty")}</p>;

  return (
    <Tree as="ul" expandAll className="pbx-layers__tree" aria-label={t("layers.treeLabel")}>
      <Fragment>
        <LayersNode id={doc.rootId} depth={0} doc={doc} breakpoint={breakpoint} cfg={cfg} rootId={doc.rootId} />
      </Fragment>
    </Tree>
  );
}
