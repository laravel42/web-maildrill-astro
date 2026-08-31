/**
 * Catálogo de campos de estilo editables por grupo (docs/03 §2-3). El Inspector
 * genera un control por cada uno; qué grupos se muestran lo decide el
 * `styleSchema.enabledGroups` de cada componente (P4).
 *
 * Los valores se guardan como strings CSS válidos (docs/03 §6): "16px", "1fr",
 * "repeat(2, 1fr)", "#0af"…
 *
 * Fase 11.b: control `"numeric"` para campos de una sola medida con unidad
 * (px, %, em, rem…). Muestra el NumericUnitInput — pill con número + unidad
 * clickeable + stepper ▲▼. Campos con múltiples valores (padding shorthand,
 * gridTemplateColumns…) siguen usando `"text"` porque no son una sola medida.
 */

import type { StyleGroup } from "../model/types";

/** Tipo de control efectivo del Inspector. */
export type StyleControlKind = "select" | "color" | "text" | "numeric";

export interface StyleFieldDef {
  group: StyleGroup;
  key: string;
  label: string;
  control: StyleControlKind;
  options?: { label: string; value: string }[];
  placeholder?: string;
  /** Unidades válidas para control="numeric" */
  units?: string[];
  /**
   * Unidad por defecto (T7) para control="numeric": si el valor entra SIN
   * unidad (p. ej. el usuario teclea "16"), se aplica esta al commit/step en
   * vez de quedar *unitless*. NO se pone en campos donde unitless es válido y
   * con significado (p. ej. `line-height` como ratio, `font-weight`).
   */
  defaultUnit?: string;
  /**
   * Clave i18n (namespace `inspector`) de una salvedad de compatibilidad entre
   * navegadores para esta propiedad (T6). Si está presente, el Inspector pinta
   * un icono de alerta junto al título con el texto en un tooltip.
   */
  compat?: string;
}

// Conjuntos de unidades reutilizables
const U_LENGTH  = ["px", "%", "em", "rem", "vw", "vh", "ch"] as const;
const U_SIZE    = ["px", "%", "em", "rem", "vw", "vh", "fr", "ch"] as const;
const U_RADII   = ["px", "%", "em", "rem"] as const;
const U_FONT    = ["px", "rem", "em", "%"] as const;
const U_WEIGHT  = ["100","200","300","400","500","600","700","800","900"] as const;
const U_LINE    = ["", "px", "em", "rem"] as const; // sin unidad = ratio puro

export const STYLE_FIELDS: StyleFieldDef[] = [
  // ---- layout ---------------------------------------------------------------
  {
    group: "layout",
    key: "display",
    label: "Display",
    control: "select",
    options: [
      { label: "flex", value: "flex" },
      { label: "grid", value: "grid" },
      { label: "block", value: "block" },
      { label: "inline-block", value: "inline-block" },
      { label: "inline-flex", value: "inline-flex" },
      { label: "none", value: "none" },
    ],
  },
  {
    group: "layout",
    key: "flexDirection",
    label: "Dirección",
    control: "select",
    options: [
      { label: "row", value: "row" },
      { label: "column", value: "column" },
      { label: "row-reverse", value: "row-reverse" },
      { label: "column-reverse", value: "column-reverse" },
    ],
  },
  {
    group: "layout",
    key: "justifyContent",
    label: "Justify",
    control: "select",
    options: [
      { label: "flex-start", value: "flex-start" },
      { label: "center", value: "center" },
      { label: "flex-end", value: "flex-end" },
      { label: "space-between", value: "space-between" },
      { label: "space-around", value: "space-around" },
      { label: "space-evenly", value: "space-evenly" },
    ],
  },
  {
    group: "layout",
    key: "alignItems",
    label: "Align",
    control: "select",
    options: [
      { label: "stretch", value: "stretch" },
      { label: "flex-start", value: "flex-start" },
      { label: "center", value: "center" },
      { label: "flex-end", value: "flex-end" },
      { label: "baseline", value: "baseline" },
    ],
  },
  {
    group: "layout",
    key: "gap",
    label: "Gap",
    control: "numeric",
    units: [...U_LENGTH],
    defaultUnit: "px",
    placeholder: "16px",
  },
  {
    group: "layout",
    key: "flexWrap",
    label: "Wrap",
    control: "select",
    options: [
      { label: "nowrap", value: "nowrap" },
      { label: "wrap", value: "wrap" },
      { label: "wrap-reverse", value: "wrap-reverse" },
    ],
  },
  {
    group: "layout",
    key: "overflowX",
    label: "Overflow X",
    control: "select",
    options: [
      { label: "visible", value: "visible" },
      { label: "auto (slider)", value: "auto" },
      { label: "scroll (slider)", value: "scroll" },
      { label: "hidden", value: "hidden" },
    ],
  },
  {
    group: "layout",
    key: "overflowY",
    label: "Overflow Y",
    control: "select",
    options: [
      { label: "visible", value: "visible" },
      { label: "auto", value: "auto" },
      { label: "scroll", value: "scroll" },
      { label: "hidden", value: "hidden" },
    ],
  },
  {
    group: "layout",
    key: "gridTemplateColumns",
    label: "Grid columns",
    control: "text",
    placeholder: "repeat(2, 1fr)",
  },
  {
    group: "layout",
    key: "gridColumn",
    label: "Celda: columna",
    control: "text",
    placeholder: "2  ·  1 / 3  ·  span 2",
  },
  {
    group: "layout",
    key: "gridRow",
    label: "Celda: fila",
    control: "text",
    placeholder: "1  ·  span 2",
  },

  // ---- spacing — estos admiten shorthands (padding: "8px 16px"), así que text ----
  { group: "spacing", key: "padding", label: "Padding", control: "text", placeholder: "16px" },
  { group: "spacing", key: "margin",  label: "Margin",  control: "text", placeholder: "0 auto" },

  // ---- size -----------------------------------------------------------------
  {
    group: "size",
    key: "width",
    label: "Width",
    control: "numeric",
    units: [...U_SIZE],
    defaultUnit: "px",
    placeholder: "100%",
  },
  {
    group: "size",
    key: "height",
    label: "Height",
    control: "numeric",
    units: [...U_SIZE],
    defaultUnit: "px",
    placeholder: "auto",
  },
  {
    group: "size",
    key: "minHeight",
    label: "Min height",
    control: "numeric",
    units: [...U_SIZE],
    defaultUnit: "px",
    placeholder: "0",
  },
  {
    group: "size",
    key: "maxWidth",
    label: "Max width",
    control: "numeric",
    units: [...U_SIZE],
    defaultUnit: "px",
    placeholder: "none",
  },

  // ---- appearance -----------------------------------------------------------
  { group: "appearance", key: "background",    label: "Fondo",       control: "color" },
  { group: "appearance", key: "color",         label: "Color texto", control: "color" },
  { group: "appearance", key: "border",        label: "Borde",       control: "text",    placeholder: "1px solid #ccc" },
  {
    group: "appearance",
    key: "borderRadius",
    label: "Radio",
    control: "numeric",
    units: [...U_RADII],
    defaultUnit: "px",
    placeholder: "8px",
  },

  // ---- typography -----------------------------------------------------------
  { group: "typography", key: "fontFamily",    label: "Fuente",       control: "text",    placeholder: "Inter, sans-serif" },
  {
    group: "typography",
    key: "fontSize",
    label: "Tamaño",
    control: "numeric",
    units: [...U_FONT],
    defaultUnit: "px",
    placeholder: "16px",
  },
  {
    group: "typography",
    key: "fontWeight",
    label: "Peso",
    control: "numeric",
    units: [...U_WEIGHT],
    placeholder: "400",
  },
  {
    group: "typography",
    key: "lineHeight",
    label: "Interlineado",
    control: "numeric",
    units: [...U_LINE],
    placeholder: "1.5",
  },
  {
    group: "typography",
    key: "textAlign",
    label: "Alineación",
    control: "select",
    options: [
      { label: "left",    value: "left" },
      { label: "center",  value: "center" },
      { label: "right",   value: "right" },
      { label: "justify", value: "justify" },
    ],
  },
  {
    group: "typography",
    key: "textDecoration",
    label: "Decoración",
    control: "select",
    options: [
      { label: "none",         value: "none" },
      { label: "underline",    value: "underline" },
      { label: "line-through", value: "line-through" },
    ],
  },

  // ---- appearance (D6, docs/41 §3, §6 — sección "Efectos" del panel) --------
  // Estos 3 campos ya existen en el modelo (`StyleProperties.appearance`,
  // docs/41 §2.1.1) pero estaban ausentes de este catálogo → no editables
  // desde el Inspector. `panel/sections.ts` ya declara sus filas en la
  // sección `effects`; sin esta entrada, `rowIsRenderable` las filtraba
  // (la sección quedaba oculta por falta de campos renderizables).
  {
    group: "appearance",
    key: "boxShadow",
    label: "Sombra",
    control: "text",
    placeholder: "0 4px 6px rgba(0,0,0,0.1)",
  },
  {
    group: "appearance",
    key: "cursor",
    label: "Cursor",
    control: "select",
    options: [
      { label: "default",     value: "default" },
      { label: "pointer",     value: "pointer" },
      { label: "not-allowed", value: "not-allowed" },
      { label: "grab",        value: "grab" },
      { label: "text",        value: "text" },
      { label: "help",        value: "help" },
      { label: "wait",        value: "wait" },
      { label: "zoom-in",     value: "zoom-in" },
    ],
  },
  {
    group: "appearance",
    key: "outline",
    label: "Outline",
    control: "text",
    placeholder: "2px solid #2563eb",
  },
];

export function styleFieldsForGroup(group: StyleGroup): StyleFieldDef[] {
  return STYLE_FIELDS.filter((f) => f.group === group);
}

/**
 * Prefijo de ruta de token aplicable a un campo (docs/08 §2, §5-6), o `null` si
 * el campo no se tokeniza (enums estructurales, `border` compuesto…).
 */
export function tokenGroupForField(field: StyleFieldDef): string | null {
  if (field.group === "appearance") {
    if (field.key === "background" || field.key === "color") return "colors";
    if (field.key === "borderRadius") return "radii";
    return null;
  }
  if (field.group === "spacing") return "spacing";
  if (field.group === "size") {
    return field.key === "maxWidth" ? "sizes" : "spacing";
  }
  if (field.group === "layout" && field.key === "gap") return "spacing";
  if (field.group === "typography") {
    switch (field.key) {
      case "fontFamily":   return "typography.families";
      case "fontSize":     return "typography.sizes";
      case "fontWeight":   return "typography.weights";
      case "lineHeight":   return "typography.lineHeights";
      default:             return null;
    }
  }
  return null;
}
