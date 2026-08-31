/**
 * Tab — NODO DE SLOT del composite `tabs` (docs/23 §3.1, Opción A). No es un
 * componente de la paleta (`hiddenInPalette`): se crea solo vía la afordancia
 * "+ añadir pestaña" del `tabs`, y solo puede vivir dentro de un `tabs`
 * (`isSlot: "tabs"`).
 *
 * Es un **container**: su `props.label` es el título de la pestaña (translatable,
 * i18n por-nodo, docs/12 §B) y sus `children` son el CONTENIDO del panel (nodos
 * reales, arrastrables). El `tabs` (composite `splitRender`) lee las slots vía
 * `RenderContext.slots`: arma la tablist desde `props.label` y coloca el panel
 * envolviendo este nodo. Por eso el `render` de `Tab` pinta SOLO su caja de
 * contenido droppable (la envoltura ARIA `.pb-tabs__panel` la pone el padre).
 *
 * Recorte/edición (AGENTS.md §5, paridad con `Container`/`Card`): en canvas fija
 * `position:relative` (ancla el overlay de drop, chrome no exportado) y deja el
 * contenido en flujo; en `exportMode` sin estilo inline (P8).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const TAB_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "stretch" },
  },
};

function TabRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : {
        position: "relative",
        ...stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS)),
      };

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName =
    ["pb-tab", className, rootClassName].filter(Boolean).join(" ") || undefined;
  const isEmpty = !node.children || node.children.length === 0;

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {children}
      {!exportMode && isEmpty ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Panel vacío — suelta componentes aquí
        </span>
      ) : null}
    </div>
  );
}

export const tabDefinition: ComponentDefinition = {
  type: "tab",
  label: "Pestaña",
  category: "content",
  acceptsChildren: true,
  isSlot: "tabs",
  hiddenInPalette: true,
  defaultProps: { label: "Pestaña" },
  defaultStyle: structuredClone(TAB_DEFAULT_STYLE),
  // Una pestaña nueva nace con un `text` de contenido (docs/23 §7); el `tabs`
  // sobreescribe el contenido de sus 3 pestañas iniciales con su propio texto.
  defaultChildren: [{ type: "text", props: { content: "<p>Contenido de la pestaña.</p>" } }],
  propsSchema: {
    fields: [
      { key: "label", label: "Título de la pestaña", control: "text", group: "Contenido", translatable: true },
    ],
  },
  styleSchema: { enabledGroups: ["layout", "spacing", "size", "appearance", "typography"] },
  render: TabRender,
};
