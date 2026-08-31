/**
 * Input — componente de formulario (Fase 10, docs/16 §10.1).
 *
 * Renderiza un `<input>` nativo con soporte para tipos text/email/tel/number/password.
 * Sin JS: funciona con validación HTML5 nativa (required, type, minlength…).
 * Con `ui.js`: los estados focus/error se mejoran visualmente mediante CSS de
 * clase en `chrome.css` (no hay enhancer JS — el `<input>` nativo es suficiente).
 *
 * El `id` del nodo se expone como atributo `id` en el `<input>` para que un
 * `<label for="...">` pueda asociarse correctamente.
 *
 * Cumple P3 (un solo render canvas/export), P8 (HTML puro sin runtime).
 * Todos los colores via tokens BASE_TOKENS (no hardcodeados).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

type InputType = "text" | "email" | "tel" | "number" | "password";

export const INPUT_DEFAULT_STYLE: NodeStyle = {
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

function InputRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const name = typeof node.props.name === "string" ? node.props.name : undefined;
  const placeholder = typeof node.props.placeholder === "string" ? node.props.placeholder : undefined;
  const type: InputType =
    typeof node.props.type === "string" &&
    ["text", "email", "tel", "number", "password"].includes(node.props.type as string)
      ? (node.props.type as InputType)
      : "text";
  const required = node.props.required === true;
  const disabled = node.props.disabled === true;

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName, "pb-input"].filter(Boolean).join(" ") || undefined;

  return (
    <input
      ref={rootRef as Ref<HTMLInputElement> | undefined}
      id={node.id}
      type={type}
      name={name}
      placeholder={placeholder}
      required={required || undefined}
      disabled={disabled || undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    />
  );
}

export const inputDefinition: ComponentDefinition = {
  type: "input",
  label: "Input",
  category: "form",
  acceptsChildren: false,
  disallowsClickAction: true,
  defaultProps: {
    name: "",
    type: "text",
    placeholder: "",
    required: false,
    disabled: false,
  },
  defaultStyle: structuredClone(INPUT_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      {
        key: "type",
        label: "Tipo",
        control: "select",
        group: "Formulario",
        options: [
          { label: "Texto", value: "text" },
          { label: "Email", value: "email" },
          { label: "Teléfono", value: "tel" },
          { label: "Número", value: "number" },
          { label: "Contraseña", value: "password" },
        ],
      },
      { key: "name", label: "Name (atributo)", control: "text", group: "Formulario" },
      { key: "placeholder", label: "Placeholder", control: "text", group: "Contenido", translatable: true },
      { key: "required", label: "Requerido", control: "toggle", group: "Validación" },
      { key: "disabled", label: "Deshabilitado", control: "toggle", group: "Estado" },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: InputRender,
};
