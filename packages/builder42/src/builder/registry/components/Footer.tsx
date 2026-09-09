/**
 * Footer — pie del sitio: contenedor semántico `<footer>` con columnas + línea
 * de copyright (docs/16 §12.1 #16).
 *
 * Componente `navigation` que ACEPTA HIJOS: el usuario coloca dentro columnas de
 * enlaces (containers con `text`/`button`/`nav-menu`/`social-links`) y también
 * la línea de copyright, como un bloque `text` normal más — no un prop propio.
 * Así el copyright es seleccionable, editable inline (richtext) y con su propio
 * estilo, igual que cualquier otro texto del canvas (mismo arreglo que
 * `pricing-card.features`, docs/54 P0 #1). `props.copyright` ya NO existe: las
 * plantillas que necesiten esa línea deben añadir un hijo `text`.
 *
 * Render puro (P3): raíz `<footer>` con `rootRef`/`rootProps` sin wrapper; en
 * `exportMode` sin estilo inline en la raíz (CSS por clase, AGENTS.md §5) y HTML
 * puro (P8).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const FOOTER_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex", flexDirection: "column", gap: "24px" },
    spacing: { padding: "40px 24px" },
    size: { width: "100%" },
    typography: { fontFamily: { token: "typography.families.sans" }, fontSize: { token: "typography.sizes.sm" } },
    appearance: {
      background: { token: "colors.surface.alt" },
      color: { token: "colors.text" },
    },
  },
};

function FooterRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;
  const isEmpty = !node.children || node.children.length === 0;

  return (
    <footer
      ref={rootRef as Ref<HTMLElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {children}
      {!exportMode && isEmpty ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Empty footer — drop link columns
        </span>
      ) : null}
    </footer>
  );
}

export const footerDefinition: ComponentDefinition = {
  type: "footer",
  label: "Pie de página",
  category: "navigation",
  acceptsChildren: true,
  defaultProps: {},
  defaultStyle: structuredClone(FOOTER_DEFAULT_STYLE),
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["layout", "spacing", "size", "appearance", "typography"] },
  render: FooterRender,
};
