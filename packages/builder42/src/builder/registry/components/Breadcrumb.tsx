/**
 * Breadcrumb — miga de pan del sitio publicado (docs/16 §12.1 #19).
 *
 * Componente `navigation` atómico (NO la miga del chrome del editor). Lista
 * editable con `options-list`: `label` = texto del nivel, `value` = href. Se
 * pinta como `<nav aria-label><ol>` con separadores; el ÚLTIMO nivel es la
 * página actual (texto con `aria-current="page"`, sin enlace). Mejora SEO y
 * navegación jerárquica.
 *
 * Auto-derivar la miga desde la jerarquía real del sitio (`buildPathMap`) queda
 * diferido: requiere una extensión de `RenderContext` (análoga a `localeInfo`)
 * que canvas y export rellenen — decisión para revisión del usuario. Con el
 * enfoque actual el usuario define los niveles.
 *
 * Render puro (P3): raíz `<nav>` con `rootRef`/`rootProps`; en `exportMode` sin
 * estilo inline en la raíz (AGENTS.md §5), HTML puro (P8).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { styleValueToCss } from "../../model/tokens";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

interface Crumb {
  label: string;
  value: string;
}

const BREADCRUMB_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block", gap: "8px" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.sm" },
    },
    appearance: { color: { token: "colors.muted" } },
  },
};

// `gap` YA NO vive aquí como literal fijo: se resuelve desde `node.style`
// (`layout.gap`, editable en el Inspector) y se inyecta en el render. El
// resto de `LIST_STYLE` sigue fijo (chrome estructural de la lista, no una
// elección del usuario).
const LIST_STYLE: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
};
const ITEM_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "var(--spacing-xs, 8px)",
};
const LINK_STYLE: CSSProperties = {
  color: "var(--colors-text, inherit)",
  textDecoration: "none",
};
const SEP_STYLE: CSSProperties = { opacity: 0.6 };
const CURRENT_STYLE: CSSProperties = {
  fontWeight: "var(--typography-weights-bold, 600)",
  color: "var(--colors-text)",
  opacity: 0.85,
};

function BreadcrumbRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));
  // El `<nav>` raíz es `display:block` (no flex): el `gap` de `layout` no
  // tendría efecto ahí. El campo SÍ es estándar del modelo (`layout.gap`,
  // editable en el Inspector) pero el valor resuelto se inyecta en el `<ol>`
  // (el elemento flex real) en vez de en la raíz.
  const resolvedGap = styleValueToCss(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS).layout?.gap);
  const listStyle: CSSProperties = { ...LIST_STYLE, gap: resolvedGap ?? "8px" };

  const items: Crumb[] = Array.isArray(node.props.items) ? (node.props.items as Crumb[]) : [];
  const separator = typeof node.props.separator === "string" && node.props.separator !== "" ? node.props.separator : "/";

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <nav
      ref={rootRef as Ref<HTMLElement> | undefined}
      className={mergedClassName}
      style={style}
      aria-label="Breadcrumb"
      {...restRootProps}
    >
      <ol style={listStyle}>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          const label = typeof item?.label === "string" && item.label !== "" ? item.label : "Nivel";
          const href = typeof item?.value === "string" && item.value !== "" ? item.value : "#";
          return (
            <li key={i} style={ITEM_STYLE}>
              {isLast ? (
                <span aria-current="page" style={CURRENT_STYLE}>{label}</span>
              ) : (
                <a href={href} style={LINK_STYLE}>{label}</a>
              )}
              {!isLast ? <span aria-hidden="true" style={SEP_STYLE}>{separator}</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export const breadcrumbDefinition: ComponentDefinition = {
  type: "breadcrumb",
  label: "Miga de pan",
  category: "navigation",
  acceptsChildren: false,
  defaultProps: {
    items: [
      { label: "Home", value: "/" },
      { label: "Category", value: "/category" },
      { label: "Current page", value: "" },
    ],
    separator: "/",
  },
  defaultStyle: structuredClone(BREADCRUMB_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "items", label: "Niveles (texto + href)", control: "options-list", group: "Contenido" },
      { key: "separator", label: "Separador", control: "text", group: "Contenido" },
    ],
  },
  styleSchema: { enabledGroups: ["layout", "typography", "spacing", "size", "appearance"] },
  render: BreadcrumbRender,
};
