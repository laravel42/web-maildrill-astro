/**
 * Divider — separador visual (`<hr>`), docs/16 §12.1 #1.
 *
 * Componente `layout` sin props funcionales: grosor, color, estilo y margen son
 * STYLE (P6), no props — viven en `defaultStyle` y se editan desde los grupos
 * `size`/`spacing`/`appearance` del Inspector. La línea se pinta con
 * `appearance.background` (ligado a `colors.border`) sobre un bloque de altura
 * configurable; `border: none` neutraliza el borde nativo del `<hr>` para que el
 * grosor lo controle `size.height` de forma predecible.
 *
 * Render puro (P3): sin hooks, aplica `rootRef`/`rootProps` en la raíz sin
 * wrapper (docs/02 §10.3). En `exportMode` no emite estilo inline (el CSS sale
 * por clase, AGENTS.md §5) y el `<hr>` es HTML puro (P8).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

const DIVIDER_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    size: { width: "100%", height: "2px" },
    spacing: { margin: "16px 0" },
    appearance: {
      background: { token: "colors.border" },
      border: "none",
      borderRadius: { token: "radii.sm" },
    },
  },
};

function DividerRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <hr
      ref={rootRef as Ref<HTMLHRElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    />
  );
}

export const dividerDefinition: ComponentDefinition = {
  type: "divider",
  label: "Separador",
  category: "layout",
  acceptsChildren: false,
  defaultProps: {},
  defaultStyle: structuredClone(DIVIDER_DEFAULT_STYLE),
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["spacing", "size", "appearance"] },
  render: DividerRender,
};
