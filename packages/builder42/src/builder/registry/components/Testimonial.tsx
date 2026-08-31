/**
 * Testimonial — prueba social: cita + avatar (iniciales) + nombre/cargo
 * (docs/16 §12.1 #12).
 *
 * Componente `content` atómico. Raíz `<figure>` themeable por tokens; dentro un
 * `<blockquote>` con la cita y un `<figcaption>` con un mini-avatar de iniciales
 * (círculo con borde `currentColor`, sin color hardcodeado — hereda el tema),
 * el nombre y el cargo. Todos los textos son PROPS traducibles (P9).
 *
 * Los sub-elementos usan estilo fijo NO temático (layout, tamaño relativo,
 * opacidad, `border:"1px solid"` que resuelve a `currentColor`). Render puro
 * (P3): raíz con `rootRef`/`rootProps`; en `exportMode` sin estilo inline en la
 * raíz (AGENTS.md §5), HTML puro (P8). Para un avatar con imagen real, usar el
 * componente `avatar` dentro de un `card`.
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const TESTIMONIAL_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    spacing: { padding: "24px", margin: "0" },
    size: { maxWidth: "520px" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
      lineHeight: { token: "typography.lineHeights.normal" },
    },
    appearance: {
      background: { token: "colors.surface.alt" },
      color: { token: "colors.text" },
      borderRadius: { token: "radii.md" },
    },
  },
};

const QUOTE_STYLE: CSSProperties = {
  margin: 0,
  fontStyle: "italic",
  fontSize: "var(--typography-sizes-base, 1.05em)",
};
const CAPTION_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--spacing-sm, 12px)",
  marginTop: "var(--spacing-sm, 16px)",
};
const AVATAR_STYLE: CSSProperties = {
  width: "40px",
  height: "40px",
  flexShrink: 0,
  borderRadius: "50%",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--colors-border, currentColor)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: "var(--typography-weights-bold, 700)",
  fontSize: "var(--typography-sizes-sm, 0.85em)",
};
const NAME_STYLE: CSSProperties = {
  display: "block",
  fontWeight: "var(--typography-weights-bold, 700)",
};
const ROLE_STYLE: CSSProperties = {
  display: "block",
  fontSize: "var(--typography-sizes-sm, 0.85em)",
  opacity: 0.7,
};

function TestimonialRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const quote = typeof node.props.quote === "string" && node.props.quote !== "" ? node.props.quote : "Testimonio";
  const name = typeof node.props.name === "string" ? node.props.name : "";
  const role = typeof node.props.role === "string" ? node.props.role : "";
  const initials = typeof node.props.initials === "string" && node.props.initials !== "" ? node.props.initials : "?";

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <figure
      ref={rootRef as Ref<HTMLElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      <blockquote style={QUOTE_STYLE}>{quote}</blockquote>
      <figcaption style={CAPTION_STYLE}>
        <span style={AVATAR_STYLE} aria-hidden="true">{initials}</span>
        <span>
          {name !== "" ? <span style={NAME_STYLE}>{name}</span> : null}
          {role !== "" ? <span style={ROLE_STYLE}>{role}</span> : null}
        </span>
      </figcaption>
    </figure>
  );
}

export const testimonialDefinition: ComponentDefinition = {
  type: "testimonial",
  label: "Testimonio",
  category: "content",
  acceptsChildren: false,
  defaultProps: {
    quote: "Este producto cambió por completo nuestra forma de trabajar.",
    name: "Ana García",
    role: "CEO, Acme Inc.",
    initials: "AG",
  },
  defaultStyle: structuredClone(TESTIMONIAL_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "quote", label: "Cita", control: "text", group: "Contenido", translatable: true },
      { key: "name", label: "Nombre", control: "text", group: "Contenido", translatable: true },
      { key: "role", label: "Cargo", control: "text", group: "Contenido", translatable: true },
      { key: "initials", label: "Iniciales", control: "text", group: "Contenido" },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: TestimonialRender,
};
