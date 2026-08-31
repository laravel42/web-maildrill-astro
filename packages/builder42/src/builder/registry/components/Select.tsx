/**
 * Select — componente de formulario con custom dropdown accesible (docs/14 §1,
 * docs/15 tier 1).
 *
 * **Estrategia de dos capas (igual que LanguageNav, docs/14 §2):**
 *
 * 1. **Sin JS — fallback `<details>`:** el `<summary>` actúa como trigger y la
 *    `<ul>` con las opciones se muestra al abrir. CSS puro con `var(--colors-*)`.
 *    El `<select>` nativo está oculto en el DOM solo para el submit del form.
 *
 * 2. **Con `ui.js`:** el enhancer detecta si el CSS del componente está cargado
 *    comprobando que `var(--colors-surface-default)` se resuelve. Si no (editor
 *    sin CSS del export), construye el custom UI dinámicamente. Si sí (output
 *    con CSS), activa el combobox ARIA sobre el markup existente del `<details>`.
 *
 * Cumple P3 (un solo render canvas/export), P8 (HTML puro en export).
 * Todos los colores via var(--colors-*) en baseCss (no hardcodeados).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

interface SelectOption {
  label: string;
  value: string;
}

function SelectRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const options: SelectOption[] = Array.isArray(node.props.options)
    ? (node.props.options as SelectOption[])
    : [];
  const name = typeof node.props.name === "string" ? node.props.name : undefined;
  const placeholder = typeof node.props.placeholder === "string" ? node.props.placeholder : undefined;
  const ariaLabel = typeof node.props.ariaLabel === "string" && node.props.ariaLabel
    ? node.props.ariaLabel
    : undefined;

  const listboxId = `pb-listbox-${node.id}`;

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName, "pb-select"].filter(Boolean).join(" ") || undefined;

  // El label visible en el trigger: placeholder o primera opción.
  const triggerLabel = placeholder ?? options[0]?.label ?? "";

  return (
    <details
      ref={rootRef as Ref<HTMLDetailsElement> | undefined}
      className={mergedClassName}
      style={style}
      data-pb-ui="select"
      {...restRootProps}
    >
      {/*
        Summary = trigger visible SIN JS. CSS lo estiliza igual que LanguageNav.
        Con JS el enhancer lo convierte en un combobox ARIA real.
      */}
      <summary
        className="pb-select__summary"
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
      >
        <span className="pb-select__trigger-label">
          {triggerLabel}
        </span>
        <span className="pb-select__arrow" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </summary>

      {/*
        Lista de opciones — visible cuando <details> está abierto (sin JS).
        Con JS el enhancer gestiona la visibilidad vía aria-expanded.
      */}
      <ul
        id={listboxId}
        role="listbox"
        className="pb-select__listbox"
        aria-label={ariaLabel}
      >
        {options.map((opt, i) => (
          <li
            key={i}
            role="option"
            className="pb-select__option"
            data-value={opt.value}
            aria-selected="false"
          >
            {opt.label}
          </li>
        ))}
      </ul>

      {/*
        Select nativo — solo para form submit. Siempre oculto visualmente;
        el enhancer lo mantiene sincronizado con la selección del custom UI.
        Sin JS el usuario selecciona desde la lista <ul> de arriba (no del nativo).
      */}
      <select
        className="pb-select__native"
        name={name}
        defaultValue=""
        aria-hidden="true"
        tabIndex={-1}
        style={{ display: "none" }}
      >
        {placeholder && (
          <option value="" disabled hidden>
            {placeholder}
          </option>
        )}
        {options.map((opt, i) => (
          <option key={i} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </details>
  );
}

export const SELECT_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    appearance: {
      background: { token: "colors.surface.default" },
      color: { token: "colors.text" },
      borderRadius: { token: "radii.sm" },
      borderWidth: "1px",
      borderStyle: "solid",
      borderColor: { token: "colors.border" },
      cursor: "pointer",
    },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
      lineHeight: { token: "typography.lineHeights.normal" },
    },
    size: { width: "100%" },
  },
};

export const selectDefinition: ComponentDefinition = {
  type: "select",
  label: "Select",
  category: "form",
  acceptsChildren: false,
  uiRuntime: "select",
  disallowsClickAction: true,
  defaultProps: {
    options: [
      { label: "Opción 1", value: "option1" },
      { label: "Opción 2", value: "option2" },
      { label: "Opción 3", value: "option3" },
    ],
    name: "",
    placeholder: "Seleccionar…",
    ariaLabel: "",
  },
  defaultStyle: structuredClone(SELECT_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "options", label: "Opciones", control: "options-list", group: "Contenido" },
      { key: "placeholder", label: "Placeholder", control: "text", group: "Contenido" },
      { key: "name", label: "Name (atributo)", control: "text", group: "Formulario" },
      { key: "ariaLabel", label: "Aria label", control: "text", group: "Accesibilidad" },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: SelectRender,
};


