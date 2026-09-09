/**
 * Badge — etiqueta pequeña (`<span>`) tipo "nuevo/pro/oferta" (docs/16 §12.1 #4).
 *
 * Componente `content` atómico: el texto es PROP (`props.label`, traducible P9);
 * la presentación es STYLE por tokens (P6). Render puro (P3): raíz `<span>` con
 * `rootRef`/`rootProps` sin wrapper (docs/02 §10.3); en `exportMode` sin estilo
 * inline (el CSS sale por clase, AGENTS.md §5) y HTML puro (P8).
 *
 * **Sobre las "variantes de color"** (criterio docs/16 §12.3): NO se implementan
 * como prop. El estilo que llega al export sale de `node.style` (serializado a
 * clase por el `cssSerializer`), no del `render` — que en `exportMode` devuelve
 * `style: undefined`. Un color elegido en `render` según una prop se vería en el
 * canvas pero DESAPARECERÍA en el export (bug de la clase Button, AGENTS.md §5).
 * Por eso el badge se entrega con un `defaultStyle` neutro ligado a tokens y el
 * usuario lo recolorea desde el Inspector (fondo `colors.primary`→`colors.success`/
 * `colors.error`, etc.) — coherente con el sistema de temas. Un sistema de
 * "presets de variante" que reescriba `node.style` es una feature transversal,
 * no per-componente (queda para decisión del usuario).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const BADGE_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "inline-block" },
    spacing: { padding: "2px 10px" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.sm" },
      fontWeight: { token: "typography.weights.bold" },
      lineHeight: { token: "typography.lineHeights.tight" },
    },
    appearance: {
      background: { token: "colors.primary.default" },
      color: { token: "colors.primary.on" },
      borderRadius: { token: "radii.sm" },
    },
  },
};

function BadgeRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));
  const label = typeof node.props.label === "string" && node.props.label !== "" ? node.props.label : "Badge";

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <span
      ref={rootRef as Ref<HTMLSpanElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {label}
    </span>
  );
}

export const badgeDefinition: ComponentDefinition = {
  type: "badge",
  label: "Etiqueta",
  category: "content",
  acceptsChildren: false,
  defaultProps: { label: "New" },
  defaultStyle: structuredClone(BADGE_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "label", label: "Texto", control: "text", group: "Contenido", translatable: true },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "appearance"] },
  render: BadgeRender,
};
