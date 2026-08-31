/**
 * Textarea — componente de formulario (Fase 10, docs/16 §10.1).
 *
 * Renderiza un `<textarea>` nativo con soporte para `rows`, `placeholder`,
 * `required` y `disabled`. Sin JS: funciona con validación HTML5 nativa.
 * El `id` del nodo se expone como atributo `id` en el `<textarea>` para
 * asociación accesible con un `<label for="...">`.
 *
 * Cumple P3 (un solo render canvas/export), P8 (HTML puro sin runtime).
 * Todos los colores via tokens BASE_TOKENS (no hardcodeados).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const TEXTAREA_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    size: { width: "100%" },
    spacing: { padding: { token: "spacing.sm" } },
    appearance: {
      background: { token: "colors.surface.default" },
      color: { token: "colors.text" },
      borderRadius: { token: "radii.sm" },
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: { token: "colors.border" },
    },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
      lineHeight: { token: "typography.lineHeights.normal" },
    },
  },
};

function TextareaRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const name = typeof node.props.name === "string" ? node.props.name : undefined;
  const placeholder = typeof node.props.placeholder === "string" ? node.props.placeholder : undefined;
  const rows =
    typeof node.props.rows === "number" && node.props.rows > 0
      ? node.props.rows
      : 4;
  const required = node.props.required === true;
  const disabled = node.props.disabled === true;

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName, "pb-textarea"].filter(Boolean).join(" ") || undefined;

  return (
    <textarea
      ref={rootRef as Ref<HTMLTextAreaElement> | undefined}
      id={node.id}
      name={name}
      placeholder={placeholder}
      rows={rows}
      required={required || undefined}
      disabled={disabled || undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    />
  );
}

export const textareaDefinition: ComponentDefinition = {
  type: "textarea",
  label: "Textarea",
  category: "form",
  acceptsChildren: false,
  disallowsClickAction: true,
  defaultProps: {
    name: "",
    placeholder: "",
    rows: 4,
    required: false,
    disabled: false,
  },
  defaultStyle: structuredClone(TEXTAREA_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "name", label: "Name (atributo)", control: "text", group: "Formulario" },
      { key: "placeholder", label: "Placeholder", control: "text", group: "Contenido", translatable: true },
      { key: "rows", label: "Filas", control: "number", group: "Apariencia" },
      { key: "required", label: "Requerido", control: "toggle", group: "Validación" },
      { key: "disabled", label: "Deshabilitado", control: "toggle", group: "Estado" },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: TextareaRender,
};
