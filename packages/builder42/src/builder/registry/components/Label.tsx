/**
 * Label — componente de formulario (Fase 10).
 *
 * Renderiza un `<label>` accesible con prop `for` que apunta al `id` del campo
 * asociado. La asociación se hace mediante el atributo `htmlFor` (React) / `for`
 * (HTML), que conecta el label con el `id` del `<input>`, `<textarea>` o
 * `<select>` correspondiente dentro del mismo formulario.
 *
 * Cumple P3 (un solo render canvas/export), P8 (HTML puro sin runtime).
 * Todos los colores via tokens BASE_TOKENS (no hardcodeados).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const LABEL_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.sm" },
      fontWeight: { token: "typography.weights.bold" },
      lineHeight: { token: "typography.lineHeights.normal" },
    },
    appearance: {
      color: { token: "colors.text" },
    },
  },
};

function LabelRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const text = typeof node.props.text === "string" ? node.props.text : "Etiqueta";
  // `for` es palabra reservada en JS; React usa `htmlFor`
  const htmlFor = typeof node.props.for === "string" && node.props.for
    ? node.props.for
    : undefined;

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <label
      ref={rootRef as Ref<HTMLLabelElement> | undefined}
      className={mergedClassName}
      style={style}
      htmlFor={htmlFor}
      {...restRootProps}
    >
      {text}
    </label>
  );
}

export const labelDefinition: ComponentDefinition = {
  type: "label",
  label: "Label",
  category: "form",
  acceptsChildren: false,
  defaultProps: {
    text: "Etiqueta",
    for: "",
  },
  defaultStyle: structuredClone(LABEL_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "text", label: "Texto", control: "text", group: "Contenido", translatable: true },
      { key: "for", label: "Para (id del campo)", control: "text", group: "Accesibilidad" },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: LabelRender,
};
