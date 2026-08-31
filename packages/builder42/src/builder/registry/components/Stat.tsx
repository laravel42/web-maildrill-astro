/**
 * Stat — KPI: número grande + etiqueta (docs/16 §12.1 #7).
 *
 * Componente `content` atómico de alto impacto ("+10k clientes"). Valor y label
 * son PROPS traducibles (P9); la presentación es STYLE por tokens (P6). Render
 * puro (P3): raíz `<div>` con `rootRef`/`rootProps` sin wrapper; en `exportMode`
 * sin estilo inline en la raíz (CSS por clase, AGENTS.md §5) y HTML puro (P8).
 *
 * La jerarquía visual valor/label vive en sub-elementos con estilo fijo NO
 * temático (tamaño relativo `em`, peso, opacidad); el color se hereda del root
 * (`currentColor` ← token `colors.text`).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const STAT_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    spacing: { padding: "8px" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
      textAlign: "center",
    },
    appearance: { color: { token: "colors.text" } },
  },
};

const VALUE_STYLE: CSSProperties = {
  display: "block",
  fontSize: "2.75em",
  fontWeight: "var(--typography-weights-bold, 700)",
  lineHeight: 1.1,
};

const LABEL_STYLE: CSSProperties = {
  display: "block",
  fontSize: "var(--typography-sizes-base, 1em)",
  marginTop: "var(--spacing-xs, 4px)",
  opacity: 0.7,
};

function StatRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));
  const value = typeof node.props.value === "string" && node.props.value !== "" ? node.props.value : "0";
  const label = typeof node.props.label === "string" ? node.props.label : "";

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {/* Marcador para el behavior `count-up` (docs/44 §5 fila P1): el runtime
          anima ESTE span, nunca el `<div>` raíz completo (que también
          contiene el label) — sin este marcador, `el.textContent` del nodo
          hidratado mezclaría valor + etiqueta. Presente siempre (no solo con
          el behavior activo): es un marcador inocuo, cero costo sin JS. */}
      <span style={VALUE_STYLE} data-pb-stat-value>
        {value}
      </span>
      {label !== "" ? <span style={LABEL_STYLE}>{label}</span> : null}
    </div>
  );
}

export const statDefinition: ComponentDefinition = {
  type: "stat",
  label: "Estadística",
  category: "content",
  acceptsChildren: false,
  defaultProps: { value: "+10k", label: "clientes felices" },
  defaultStyle: structuredClone(STAT_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "value", label: "Valor", control: "text", group: "Contenido", translatable: true },
      { key: "label", label: "Etiqueta", control: "text", group: "Contenido", translatable: true },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: StatRender,
};
