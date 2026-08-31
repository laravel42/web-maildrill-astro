/**
 * Spacer — bloque vacío de altura configurable (docs/16 §12.1 #2).
 *
 * Componente `layout` para controlar el espaciado vertical entre secciones sin
 * hackear paddings/márgenes de los vecinos. La altura es STYLE (P6) y responsive:
 * vive en `defaultStyle.base.size.height` y se puede sobreescribir por breakpoint
 * desde el Inspector (`size`). No tiene props funcionales.
 *
 * Render puro (P3): un `<div>` vacío sin fondo (transparente), aria-hidden para
 * que no aporte ruido a lectores de pantalla. En `exportMode` sin estilo inline
 * (AGENTS.md §5) y HTML puro (P8).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

const SPACER_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    size: { width: "100%", height: "48px" },
  },
};

function SpacerRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={mergedClassName}
      style={style}
      aria-hidden="true"
      {...restRootProps}
    />
  );
}

export const spacerDefinition: ComponentDefinition = {
  type: "spacer",
  label: "Espaciador",
  category: "layout",
  acceptsChildren: false,
  defaultProps: {},
  defaultStyle: structuredClone(SPACER_DEFAULT_STYLE),
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["size"] },
  render: SpacerRender,
};
