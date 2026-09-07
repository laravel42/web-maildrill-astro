/**
 * Stat — KPI: número grande + etiqueta (docs/16 §12.1 #7).
 *
 * COMPOSITE de componentes base (docs/23, mismo espíritu que `accordion`/
 * `testimonial`): la raíz sigue siendo un `<div>` atómico (mismo
 * `defaultStyle`), pero el valor y la etiqueta son NODOS HIJO reales:
 *
 *   stat (div, acceptsChildren)
 *   ├── <id>-value : stat-value (nodo de SLOT dedicado, `isSlot: "stat"`,
 *   │                 lleva el marcador `data-pb-stat-value` en su raíz —
 *   │                 el behavior `count-up` lo busca con
 *   │                 `el.querySelector("[data-pb-stat-value]")` dentro del
 *   │                 nodo `stat` hidratado, a cualquier profundidad, así
 *   │                 que sigue funcionando sin ningún cambio)
 *   └── <id>-label  : text (etiqueta, nodo genérico normal)
 *
 * Motivo (bug real, feedback de usuario): el espaciado entre el valor y la
 * etiqueta vivía en un `marginTop` fijo no editable (`LABEL_STYLE`), y su
 * tipografía (tamaño/peso) tampoco era ajustable — ambos eran
 * `CSSProperties` fijas aplicadas a un `<span>` interno. Al convertirlos en
 * nodos reales, su `spacing`/`typography` quedan editables de fábrica desde
 * el Inspector (pedido explícito: poder personalizar fontSize/fontWeight/
 * fontFamily del valor y la etiqueta).
 *
 * `stat-value` no puede ser un `text` genérico: el marcador
 * `data-pb-stat-value` es específico de este composite y un componente base
 * como `text` no debe conocer "stat" (P4) — se modela igual que
 * `accordion-item`/`tab` (nodo de slot dedicado, `hiddenInPalette: true`,
 * solo se crea vía `defaultChildren`/la migración de este componente).
 *
 * Retrocompatibilidad: un documento guardado con el `stat` viejo (props
 * `value`/`label`, sin `children`) se migra automáticamente al cargar — ver
 * `model/migrateSlots.ts` (`migrateSiteStats`).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, DefaultChildSpec, RenderContext } from "../types";

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

/** `stat-value`: tamaño grande + bold (antes `VALUE_STYLE`), ahora editable. */
export const STAT_VALUE_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    typography: { fontSize: "2.75em", fontWeight: { token: "typography.weights.bold" }, lineHeight: "1.1" },
    spacing: { margin: "0" },
  },
};

/**
 * `text` de la etiqueta: tamaño base + color atenuado + margin superior
 * (antes `LABEL_STYLE.marginTop`/`opacity`). El modelo de estilo no tiene
 * `opacity` (ver misma nota en `Testimonial.tsx`) — se usa `colors.muted`
 * para el mismo efecto de jerarquía visual.
 */
export const STAT_LABEL_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    typography: { fontSize: { token: "typography.sizes.base" } },
    appearance: { color: { token: "colors.muted" } },
    spacing: { margin: "4px 0 0 0" },
  },
};

function StatRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;
  const isEmpty = !node.children || node.children.length === 0;

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {children}
      {!exportMode && isEmpty ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Estadística vacía — añade el valor y la etiqueta
        </span>
      ) : null}
    </div>
  );
}

/** `render` del nodo de slot `stat-value`: mismo marcador que antes emitía `Stat.tsx` directamente. */
function StatValueRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));
  const value = typeof node.props.value === "string" && node.props.value !== "" ? node.props.value : "0";

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    // Marcador para el behavior `count-up` (docs/44 §5 fila P1): el runtime
    // anima ESTE elemento, nunca la raíz completa del `stat` (que también
    // contiene la etiqueta) — sin este marcador, `el.textContent` del nodo
    // hidratado mezclaría valor + etiqueta. Presente siempre (no solo con el
    // behavior activo): es un marcador inocuo, cero costo sin JS.
    <span
      ref={rootRef as Ref<HTMLSpanElement> | undefined}
      className={mergedClassName}
      style={style}
      data-pb-stat-value
      {...restRootProps}
    >
      {value}
    </span>
  );
}

/** `defaultChildren` sembrados al crear un `stat` nuevo desde la paleta. */
export const STAT_DEFAULT_CHILDREN: DefaultChildSpec[] = [
  { type: "stat-value", props: { value: "+10k" }, style: STAT_VALUE_STYLE },
  { type: "text", props: { content: "clientes felices" }, style: STAT_LABEL_STYLE },
];

export const statDefinition: ComponentDefinition = {
  type: "stat",
  label: "Estadística",
  category: "content",
  acceptsChildren: true,
  defaultProps: {},
  defaultStyle: structuredClone(STAT_DEFAULT_STYLE),
  defaultChildren: STAT_DEFAULT_CHILDREN,
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: StatRender,
};

export const statValueDefinition: ComponentDefinition = {
  type: "stat-value",
  label: "Valor",
  category: "content",
  acceptsChildren: false,
  isSlot: "stat",
  hiddenInPalette: true,
  defaultProps: { value: "+10k" },
  defaultStyle: structuredClone(STAT_VALUE_STYLE),
  propsSchema: {
    fields: [{ key: "value", label: "Valor", control: "text", group: "Contenido", translatable: true }],
  },
  // typography completo editable (pedido explícito: fontSize/fontWeight/fontFamily personalizables).
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: StatValueRender,
};
