/**
 * Hero — banner principal: contenedor semántico `<section>` (docs/16 §12.1 #11, §12.2).
 *
 * Componente `content` que ACEPTA HIJOS: preset de "hero" (padding generoso,
 * altura mínima, contenido centrado vertical/horizontal, texto centrado) por
 * tokens. El usuario coloca dentro título/subtítulo (`text`) y CTA (`button`).
 *
 * Fondo: se controla con `appearance.background` (color por token por defecto;
 * el usuario puede poner una imagen/gradiente como valor libre desde el
 * Inspector). El **overlay** sobre imagen de fondo (capa semitransparente) queda
 * diferido: requiere una segunda capa (pseudo-elemento o wrapper) que el modelo
 * de estilo actual no expone — decisión de diseño para revisión del usuario (D4).
 *
 * Render puro (P3): raíz `<section>` con `rootRef`/`rootProps` sin wrapper; en
 * `exportMode` sin estilo inline (CSS por clase, AGENTS.md §5) y HTML puro (P8).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const HERO_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: "16px",
    },
    spacing: { padding: "64px 24px" },
    size: { width: "100%", minHeight: "320px" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      textAlign: "center",
    },
    appearance: {
      background: { token: "colors.surface.alt" },
      color: { token: "colors.text" },
    },
  },
};

function HeroRender(ctx: RenderContext) {
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
          Hero vacío — suelta título, subtítulo y CTA
        </span>
      ) : null}
    </section>
  );
}

export const heroDefinition: ComponentDefinition = {
  type: "hero",
  label: "Hero",
  category: "content",
  acceptsChildren: true,
  defaultProps: {},
  defaultStyle: structuredClone(HERO_DEFAULT_STYLE),
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["layout", "spacing", "size", "appearance", "typography"] },
  render: HeroRender,
};
