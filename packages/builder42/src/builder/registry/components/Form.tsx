/**
 * Form — componente contenedor de formulario (Fase 10, docs/16 §10.1).
 *
 * Renderiza un `<form>` que acepta hijos de categoría `form` (input, textarea,
 * select, label, button-submit). Soporta `action`, `method` y `novalidate`.
 *
 * Sin JS: el form hace submit nativo con validación HTML5. El tier 2b Alpine
 * (docs/16 §10b) añadirá validación en tiempo real como behavior opt-in.
 *
 * El componente usa `<form>` como raíz, lo que garantiza que los descendientes
 * participen en el ciclo nativo de submit/validación (P8 — sin runtime).
 *
 * Cumple P3 (un solo render canvas/export), P4 (el core no conoce "form").
 * Todos los colores via tokens BASE_TOKENS (no hardcodeados).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const FORM_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex", flexDirection: "column", gap: { token: "spacing.md" } },
    spacing: { padding: { token: "spacing.md" } },
    appearance: {
      background: { token: "colors.surface.default" },
      borderRadius: { token: "radii.md" },
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: { token: "colors.border" },
    },
  },
};

function FormRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps, children } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const action = typeof node.props.action === "string" && node.props.action
    ? node.props.action
    : undefined;
  const method: "get" | "post" =
    node.props.method === "post" ? "post" : "get";
  const noValidate = node.props.noValidate === true;

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName, "pb-form"].filter(Boolean).join(" ") || undefined;

  return (
    <form
      ref={rootRef as Ref<HTMLFormElement> | undefined}
      action={action}
      method={method}
      noValidate={noValidate || undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {children}
    </form>
  );
}

export const formDefinition: ComponentDefinition = {
  type: "form",
  label: "Formulario",
  category: "form",
  acceptsChildren: true,
  defaultProps: {
    action: "",
    method: "post",
    noValidate: false,
  },
  defaultStyle: structuredClone(FORM_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "action", label: "Action (URL)", control: "text", group: "Formulario" },
      {
        key: "method",
        label: "Método",
        control: "select",
        group: "Formulario",
        options: [
          { label: "POST", value: "post" },
          { label: "GET", value: "get" },
        ],
      },
      { key: "noValidate", label: "Desactivar validación HTML5", control: "toggle", group: "Validación" },
    ],
  },
  styleSchema: { enabledGroups: ["layout", "spacing", "size", "appearance"] },
  render: FormRender,
};
