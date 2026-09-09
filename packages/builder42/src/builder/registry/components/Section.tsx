/**
 * Section — banda semántica `<section>` con contenido centrado (docs/16 §12.1 #3).
 *
 * Componente `layout` que acepta hijos (como `container`/`form`). Su razón de ser
 * frente a un `container` genérico es doble: (1) tag semántico `<section>` (mejora
 * SEO/accesibilidad como región de la página) y (2) `defaultStyle` pensado para una
 * banda de contenido — ancho máximo ligado a `sizes.container` y centrado con
 * `margin: 0 auto`, el patrón más repetido en landings.
 *
 * Presentación 100% en `defaultStyle` por tokens (P6, AGENTS-COMPONENTS §2): fondo
 * `colors.surface.default`, ancho máximo `sizes.container`, padding `spacing.lg`.
 * Render puro (P3): raíz con `rootRef`/`rootProps` sin wrapper (docs/02 §10.3);
 * en `exportMode` sin estilo inline (el CSS sale por clase, AGENTS.md §5) y HTML
 * puro (P8).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const SECTION_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: {
      display: "flex",
      flexDirection: "column",
      gap: "16px",
      alignItems: "stretch",
    },
    size: { width: "100%", maxWidth: { token: "sizes.container" }, minHeight: "64px" },
    spacing: { padding: "24px", margin: "0 auto" },
    appearance: {
      background: { token: "colors.surface.default" },
    },
  },
};

function SectionRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;
  const isEmpty = !node.children || node.children.length === 0;

  return (
    <section
      ref={rootRef as Ref<HTMLElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {children}
      {!exportMode && isEmpty ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Empty section — drop components here
        </span>
      ) : null}
    </section>
  );
}

export const sectionDefinition: ComponentDefinition = {
  type: "section",
  label: "Section",
  category: "layout",
  acceptsChildren: true,
  defaultProps: {},
  defaultStyle: structuredClone(SECTION_DEFAULT_STYLE),
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["layout", "spacing", "size", "appearance", "typography"] },
  render: SectionRender,
};
