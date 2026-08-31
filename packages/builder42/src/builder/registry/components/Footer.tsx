/**
 * Footer — pie del sitio: contenedor semántico `<footer>` con columnas + línea
 * de copyright (docs/16 §12.1 #16).
 *
 * Componente `navigation` que ACEPTA HIJOS: el usuario coloca dentro columnas de
 * enlaces (containers con `text`/`button`/`nav-menu`/`social-links`). Además
 * pinta una línea de copyright opcional (`props.copyright`, traducible) separada
 * por un borde superior. El separador usa `var(--colors-border)` inline (token
 * en canvas y export), coherente con el tema.
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

const COPYRIGHT_STYLE: CSSProperties = {
  display: "block",
  marginTop: "8px",
  paddingTop: "16px",
  borderTop: "1px solid var(--colors-border, #e2e8f0)",
  opacity: 0.7,
  textAlign: "center",
};

function FooterRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const copyright = typeof node.props.copyright === "string" ? node.props.copyright : "";

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
          Pie vacío — suelta columnas de enlaces
        </span>
      ) : null}
      {copyright !== "" ? <small style={COPYRIGHT_STYLE}>{copyright}</small> : null}
    </footer>
  );
}

export const footerDefinition: ComponentDefinition = {
  type: "footer",
  label: "Pie de página",
  category: "navigation",
  acceptsChildren: true,
  defaultProps: { copyright: "© 2026 Mi Empresa. Todos los derechos reservados." },
  defaultStyle: structuredClone(FOOTER_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "copyright", label: "Copyright", control: "text", group: "Contenido", translatable: true },
    ],
  },
  styleSchema: { enabledGroups: ["layout", "spacing", "size", "appearance", "typography"] },
  render: FooterRender,
};
