/**
 * NavMenu — menú de enlaces `<nav>` (docs/16 §12.1 #17).
 *
 * Componente `navigation` atómico, alternativa ligera al `navbar` (sin
 * hamburger, cero-JS). Orientación horizontal o vertical.
 *
 * **Vinculado al sistema de páginas** (mismo rework que `navbar`, docs/16
 * §12.4, feedback de usuario): los enlaces YA NO son texto+href libres que el
 * usuario escribe a mano (`props.links`, formato anterior). Se generan
 * automáticamente desde `ctx.pagesInfo` (todas las páginas del sitio, en
 * `pageOrder`, con su ruta ya resuelta — lo construyen `NodeRenderer` en
 * canvas y `resolversFor` en export con el mismo `buildPathMap`, P3). Agregar
 * una página nueva al sitio la hace aparecer aquí sin tocar el componente; el
 * usuario decide qué páginas ocultar con `props.hiddenPageIds` (checklist en
 * el Inspector, mismo control `page-visibility-list` que `navbar`) — el resto
 * se muestra. Sin `ctx.pagesInfo` (fallback defensivo) no se pinta ningún
 * enlace.
 *
 * Render puro (P3): raíz `<nav>` con `rootRef`/`rootProps` sin wrapper; en
 * `exportMode` sin estilo inline en la raíz (CSS por clase, AGENTS.md §5) y HTML
 * puro (P8). La orientación va inline en el `<ul>` (sub-elemento) para emitirse
 * igual en canvas y export.
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const NAV_MENU_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
    },
    appearance: { color: { token: "colors.text" } },
  },
};

const LINK_STYLE: CSSProperties = {
  display: "block",
  padding: "var(--spacing-xs, 4px) var(--spacing-sm, 8px)",
  color: "var(--colors-text, inherit)",
  textDecoration: "none",
};

function NavMenuRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps, pagesInfo } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const hiddenPageIds = new Set(
    Array.isArray(node.props.hiddenPageIds) ? (node.props.hiddenPageIds as string[]) : [],
  );
  const links = (pagesInfo ?? []).filter((p) => !hiddenPageIds.has(p.pageId));
  const vertical = node.props.orientation === "vertical";
  const listStyle: CSSProperties = {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: vertical ? "column" : "row",
    flexWrap: vertical ? "nowrap" : "wrap",
    gap: "var(--spacing-xs, 8px)",
  };

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <nav
      ref={rootRef as Ref<HTMLElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      <ul style={listStyle}>
        {links.map((link) => (
          <li key={link.pageId}>
            <a href={link.href} style={LINK_STYLE} aria-current={link.isCurrent ? "page" : undefined}>
              {link.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export const navMenuDefinition: ComponentDefinition = {
  type: "nav-menu",
  label: "Menú de navegación",
  category: "navigation",
  acceptsChildren: false,
  defaultProps: {
    hiddenPageIds: [],
    orientation: "horizontal",
  },
  defaultStyle: structuredClone(NAV_MENU_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "hiddenPageIds", label: "Páginas visibles en el menú", control: "page-visibility-list", group: "Contenido" },
      {
        key: "orientation",
        label: "Orientación",
        control: "select",
        group: "Contenido",
        options: [
          { label: "Horizontal", value: "horizontal" },
          { label: "Vertical", value: "vertical" },
        ],
      },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: NavMenuRender,
};
