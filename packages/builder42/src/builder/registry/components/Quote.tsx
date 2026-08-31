/**
 * Quote — cita destacada `<blockquote>` con atribución (docs/16 §12.1 #6).
 *
 * Componente `content` atómico, semánticamente distinto de `text`: el navegador
 * y los lectores lo tratan como cita. Texto y autor son PROPS traducibles (P9);
 * la presentación es STYLE por tokens (P6). Render puro (P3): raíz
 * `<blockquote>` con `rootRef`/`rootProps` sin wrapper; en `exportMode` sin
 * estilo inline en la raíz (CSS por clase, AGENTS.md §5) y HTML puro (P8).
 *
 * La atribución se pinta en un `<cite>` con estilo de sub-elemento fijo pero
 * NO temático (solo layout/tamaño relativo/opacidad; el color se hereda por
 * `currentColor`) — es markup intrínseco del componente, no un nodo estilable.
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const QUOTE_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    spacing: { padding: "16px 24px", margin: "0" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.lg" },
      lineHeight: { token: "typography.lineHeights.normal" },
    },
    appearance: {
      background: { token: "colors.surface.alt" },
      color: { token: "colors.text" },
      borderRadius: { token: "radii.md" },
    },
  },
};

const CITE_STYLE: CSSProperties = {
  display: "block",
  marginTop: "var(--spacing-sm, 12px)",
  fontStyle: "normal",
  fontSize: "var(--typography-sizes-sm, 0.8em)",
  fontWeight: "var(--typography-weights-bold, 600)",
  opacity: 0.7,
};

const QUOTE_TEXT_STYLE: CSSProperties = {
  margin: 0,
  fontStyle: "italic",
  fontSize: "var(--typography-sizes-lg, 1em)",
};

function QuoteRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));
  const content =
    typeof node.props.content === "string" && node.props.content !== ""
      ? node.props.content
      : "Cita de ejemplo";
  const attribution = typeof node.props.attribution === "string" ? node.props.attribution : "";

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <blockquote
      ref={rootRef as Ref<HTMLQuoteElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      <p style={QUOTE_TEXT_STYLE}>{content}</p>
      {attribution !== "" ? <cite style={CITE_STYLE}>— {attribution}</cite> : null}
    </blockquote>
  );
}

export const quoteDefinition: ComponentDefinition = {
  type: "quote",
  label: "Cita",
  category: "content",
  acceptsChildren: false,
  defaultProps: { content: "El diseño no es solo cómo se ve, sino cómo funciona.", attribution: "Steve Jobs" },
  defaultStyle: structuredClone(QUOTE_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "content", label: "Cita", control: "text", group: "Contenido", translatable: true },
      { key: "attribution", label: "Autor", control: "text", group: "Contenido", translatable: true },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: QuoteRender,
};
