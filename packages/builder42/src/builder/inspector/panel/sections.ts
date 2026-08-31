/**
 * Descriptor declarativo del panel de propiedades unificado (docs/41 §4.1-4.2,
 * §5.3, §6). Este módulo es PURO: sin React, sin DOM, sin store — el core del
 * panel decide qué secciones/filas mostrar cruzando `PANEL_SECTIONS` con
 * `def.styleSchema.enabledGroups` (P4: no hace switch(type)).
 *
 * Invariante no negociable (docs/41 §1, §10.1): una propiedad de estilo
 * (`[group, key]`) existe en EXACTAMENTE una fila de UNA sección. Se verifica
 * mecánicamente en `sections.test.ts`.
 */

import type { BuilderNode, Breakpoint, StyleGroup, StyleProperties } from "@/builder/model/types";
import { STYLE_FIELDS } from "../styleFields";

// ---------------------------------------------------------------------------
// Tipos (docs/41 §4.2)
// ---------------------------------------------------------------------------

/** Identificador de sección, en el orden fijo de docs/41 §5.3. */
export type SectionId = "layout" | "spacing" | "size" | "typography" | "appearance" | "effects";

/** Ruta de un campo de estilo: `[grupo, clave]` (coincide con `StyleFieldDef`). */
export type StylePath = [StyleGroup, string];

/**
 * Tipo de control con el que se pinta una fila (docs/41 §4.4). Este paso solo
 * declara el catálogo de nombres — los componentes de control llegan en el
 * Paso 3; aquí es metadata pura para el descriptor.
 *
 * `"presetSegmented"` (fase 5 de simplificación del panel, D9 más abajo):
 * segmentado de TEXTO (sin icono, a diferencia de `"segmented"`) que en modo
 * simple (`useExperienceLevel().isSimple`) sustituye a un control `"text"` de
 * valor libre por presets curados de `row.presets` — hoy solo
 * `effects.boxShadow`. En modo avanzado la fila sigue siendo el
 * `CommittableInput` de texto libre normal (`row.control` no cambia lo que
 * declara `sections.ts`; la alternancia simple/avanzado vive en
 * `StylePanel.tsx`, mismo patrón que `layout.gridColumns` en fase 4). No se
 * reutiliza `"presetNumeric"` porque ese control alterna internamente a un
 * `NumericField` para valores no-preset — `box-shadow` no es una medida
 * numérica y el modo avanzado (fuera de este control) ya cubre el caso
 * "valor no-preset".
 */
export type PanelControlKind =
  | "segmented"
  | "select"
  | "numeric"
  | "presetNumeric"
  | "presetSegmented"
  | "color"
  | "pair"
  | "sides"
  | "chipsText"
  | "text";

/** Spec de icono para controles `segmented`/`sides` (nombre lógico, no el SVG). */
export interface IconSpec {
  /** Nombre del icono (resuelto por quien pinta, p. ej. vía `Icon` de `@/components`). */
  name: string;
  /** Clave i18n del `aria-label`/tooltip de esa opción. */
  labelKey: string;
  /** Valor CSS que representa este icono dentro del control. */
  value: string;
}

/** Un control puede editar 1..n paths de estilo (p. ej. Overflow X + Y en una fila). */
export interface RowDescriptor {
  /** Estable, para el estado de expandido y los tests (docs/41 §4.2). */
  id: string;
  /** Clave i18n (namespace `inspector`, prefijo `panel.rows.`, docs/41 §9). */
  labelKey: string;
  /** Control con el que se pinta (docs/41 §4.4). */
  control: PanelControlKind;
  /** `[group, key][]` — 1 para la mayoría, 2 para pares (`pair`, `sides` usa 1 shorthand). */
  fields: StylePath[];
  /**
   * Divulgación progresiva GLOBAL, gateada por `useExperienceLevel`
   * (fase 2 de simplificación del panel — antes era un disclosure LOCAL por
   * sección, docs/41 §5.4, ya derogado): con `experienceLevel==="simple"`
   * las filas `"advanced"` no se renderizan; con `"advanced"` se muestran
   * todas, mezcladas con las `"common"`, sin ninguna distinción visual.
   */
  tier: "common" | "advanced";
  /** Para control `"presetNumeric"`/`"chipsText"`: presets etiquetados. */
  presets?: { labelKey: string; value: string }[];
  /** Para control `"segmented"`/`"sides"`: iconos por opción/lado. */
  icons?: IconSpec[];
}

export interface SectionDescriptor {
  id: SectionId;
  /** Grupos del modelo que esta sección toca; se cruza con `enabledGroups`. */
  groups: StyleGroup[];
  /** Clave i18n (namespace `inspector`, prefijo `panel.sections.`). */
  labelKey: string;
  /** Filas en orden de render. */
  rows: RowDescriptor[];
}

// ---------------------------------------------------------------------------
// Orden fijo de secciones — docs/41 §5.3
// ---------------------------------------------------------------------------

/**
 * `PANEL_SECTIONS` — fuente de verdad del descriptor (docs/41 §6). El orden de
 * este array ES el orden fijo de render: Layout → Espaciado → Tamaño →
 * Tipografía → Apariencia → Efectos. No se reordena en runtime.
 *
 * D5 (docs/41 §3, §6): `appearance.color` (color de texto) vive en Tipografía,
 * no en Apariencia — decisión ya tomada, no se repite en dos secciones.
 *
 * D6 (docs/41 §3, §6, cumplido en el Paso 5): la sección `effects` declara 3
 * filas (`appearance.boxShadow`, `appearance.cursor`, `appearance.outline`),
 * ya presentes en `STYLE_FIELDS` desde el Paso 5 (`inspector/styleFields.ts`)
 * — por lo tanto renderizables (`rowIsRenderable` las acepta) y visibles en
 * cualquier nodo con el grupo `appearance` habilitado. `rowIsRenderable`
 * sigue existiendo como guarda genérica: si en el futuro se declarara una
 * fila con un campo aún sin entrada en `STYLE_FIELDS`, `sectionsForNode` la
 * filtraría igual (y OMITE la sección completa si se queda sin filas
 * renderizables, misma regla que "sección sin grupos habilitados se oculta",
 * docs/41 §5.3) — no es exclusivo del caso histórico de `effects`.
 *
 * D9 (fase 5 de simplificación del panel, este commit): `effects.boxShadow`
 * declara `presets` (S/M/L + "Ninguna") aunque su `control` siga siendo
 * `"text"` — el descriptor no cambia de tipo de control porque en modo
 * AVANZADO la fila sigue siendo el `CommittableInput` de texto libre de
 * siempre, sin cambios; solo en modo SIMPLE `StylePanel.tsx` sustituye el
 * control por `PresetSegmented` usando estos mismos `row.presets` (mismo
 * mecanismo de datos que `size.width`/`typography.fontSize`, que ya usan
 * `presets` con `control: "presetNumeric"` — aquí no aplica ese control
 * porque no hay fallback numérico, ver doc de `"presetSegmented"` arriba).
 * El preset `s` reutiliza el valor de `BASE_TOKENS.shadows.sm`
 * (`model/tokens.ts`) tal cual — es el único nivel que ya existía en la
 * escala de tokens del proyecto. `m`/`l` son valores NUEVOS (no existía
 * escala de 2 capas en `BASE_TOKENS.shadows`), inspirados en la escala
 * `shadow-md`/`shadow-lg` de Tailwind — documentado aquí por si se decide
 * en el futuro promoverlos a `BASE_TOKENS.shadows.md`/`.lg`.
 *
 * D10 (fase 6 de simplificación del panel, este commit): `appearance.border`
 * sigue declarando `control: "text"` (el descriptor no cambia de tipo, mismo
 * criterio que D9) — en modo AVANZADO la fila sigue siendo el
 * `CommittableInput` de texto libre de siempre. Solo en modo SIMPLE
 * `StylePanel.tsx` sustituye el control por `BorderSimple`
 * (`panel/controls/BorderSimple.tsx`), que combina 3 sub-controles (grosor/
 * tipo por `<select>`, color por `ColorField`) y arma/parsea el mismo string
 * shorthand (`parseBorderShorthand`/`serializeBorderShorthand`, puras). No se
 * declara `row.presets` para esta fila (a diferencia de `boxShadow`): los
 * sub-controles de `BorderSimple` no son presets del shorthand completo, sino
 * partes independientes del mismo shorthand — el catálogo de opciones
 * (grosores/tipos ofrecidos) vive como constantes en el propio componente
 * (`BORDER_SIMPLE_WIDTHS`/`BORDER_SIMPLE_STYLES`), no en el descriptor.
 *
 * **Cambio de criterio en `RowDescriptor.tier` (fase 2 de simplificación del
 * panel, petición explícita del usuario):** `tier` ya NO controla un
 * disclosure LOCAL por sección ("Avanzado ⌄" con Map de sesión, umbral de
 * 2+ filas para que valiera la pena, auto-expansión al detectar un valor ya
 * declarado). Ese mecanismo se eliminó completo. `tier` ahora se cruza
 * GLOBALMENTE con `useExperienceLevel` en `StylePanel.tsx`: `"simple"` oculta
 * toda fila `"advanced"` del DOM (de cualquier sección), `"advanced"` las
 * muestra todas sin distinción visual de las `"common"`. Motivo del cambio:
 * mantener dos mecanismos de "avanzado" a la vez (el disclosure local y el
 * switch global de `useExperienceLevel`, que ya gateaba idiomas/SEO/JSON)
 * era redundante — se unificó bajo un solo switch.
 */
export const PANEL_SECTIONS: SectionDescriptor[] = [
  {
    id: "layout",
    groups: ["layout"],
    labelKey: "panel.sections.layout",
    rows: [
      { id: "layout.display", labelKey: "panel.rows.display", control: "segmented", fields: [["layout", "display"]], tier: "common" },
      { id: "layout.direction", labelKey: "panel.rows.direction", control: "segmented", fields: [["layout", "flexDirection"]], tier: "common" },
      { id: "layout.justify", labelKey: "panel.rows.justify", control: "segmented", fields: [["layout", "justifyContent"]], tier: "common" },
      { id: "layout.align", labelKey: "panel.rows.align", control: "segmented", fields: [["layout", "alignItems"]], tier: "common" },
      { id: "layout.gap", labelKey: "panel.rows.gap", control: "numeric", fields: [["layout", "gap"]], tier: "common" },
      { id: "layout.wrap", labelKey: "panel.rows.wrap", control: "segmented", fields: [["layout", "flexWrap"]], tier: "advanced" },
      { id: "layout.overflow", labelKey: "panel.rows.overflow", control: "pair", fields: [["layout", "overflowX"], ["layout", "overflowY"]], tier: "advanced" },
      { id: "layout.gridColumns", labelKey: "panel.rows.gridColumns", control: "chipsText", fields: [["layout", "gridTemplateColumns"]], tier: "advanced" },
      { id: "layout.cell", labelKey: "panel.rows.cell", control: "pair", fields: [["layout", "gridColumn"], ["layout", "gridRow"]], tier: "advanced" },
    ],
  },
  {
    id: "spacing",
    groups: ["spacing"],
    labelKey: "panel.sections.spacing",
    rows: [
      { id: "spacing.padding", labelKey: "panel.rows.padding", control: "sides", fields: [["spacing", "padding"]], tier: "common" },
      { id: "spacing.margin", labelKey: "panel.rows.margin", control: "sides", fields: [["spacing", "margin"]], tier: "common" },
    ],
  },
  {
    id: "size",
    groups: ["size"],
    labelKey: "panel.sections.size",
    rows: [
      {
        id: "size.width",
        labelKey: "panel.rows.width",
        control: "presetNumeric",
        fields: [["size", "width"]],
        tier: "common",
        presets: [
          { labelKey: "panel.width.full", value: "100%" },
          { labelKey: "panel.width.auto", value: "auto" },
        ],
      },
      { id: "size.height", labelKey: "panel.rows.height", control: "numeric", fields: [["size", "height"]], tier: "common" },
      { id: "size.minHeight", labelKey: "panel.rows.minHeight", control: "numeric", fields: [["size", "minHeight"]], tier: "advanced" },
      { id: "size.maxWidth", labelKey: "panel.rows.maxWidth", control: "numeric", fields: [["size", "maxWidth"]], tier: "advanced" },
    ],
  },
  {
    id: "typography",
    // D5: `appearance.color` vive aquí, no en `appearance` (docs/41 §6).
    groups: ["typography", "appearance"],
    labelKey: "panel.sections.typography",
    rows: [
      {
        id: "typography.fontSize",
        labelKey: "panel.rows.fontSize",
        control: "presetNumeric",
        fields: [["typography", "fontSize"]],
        tier: "common",
        presets: [
          { labelKey: "panel.fontSize.s", value: "14px" },
          { labelKey: "panel.fontSize.m", value: "16px" },
          { labelKey: "panel.fontSize.l", value: "20px" },
        ],
      },
      { id: "typography.color", labelKey: "panel.rows.color", control: "color", fields: [["appearance", "color"]], tier: "common" },
      { id: "typography.align", labelKey: "panel.rows.textAlign", control: "segmented", fields: [["typography", "textAlign"]], tier: "common" },
      { id: "typography.weight", labelKey: "panel.rows.fontWeight", control: "numeric", fields: [["typography", "fontWeight"]], tier: "common" },
      { id: "typography.family", labelKey: "panel.rows.fontFamily", control: "select", fields: [["typography", "fontFamily"]], tier: "advanced" },
      { id: "typography.lineHeight", labelKey: "panel.rows.lineHeight", control: "numeric", fields: [["typography", "lineHeight"]], tier: "advanced" },
      { id: "typography.decoration", labelKey: "panel.rows.textDecoration", control: "segmented", fields: [["typography", "textDecoration"]], tier: "advanced" },
    ],
  },
  {
    id: "appearance",
    groups: ["appearance"],
    labelKey: "panel.sections.appearance",
    rows: [
      { id: "appearance.background", labelKey: "panel.rows.background", control: "color", fields: [["appearance", "background"]], tier: "common" },
      { id: "appearance.borderRadius", labelKey: "panel.rows.borderRadius", control: "numeric", fields: [["appearance", "borderRadius"]], tier: "common" },
      { id: "appearance.border", labelKey: "panel.rows.border", control: "text", fields: [["appearance", "border"]], tier: "advanced" },
    ],
  },
  {
    id: "effects",
    // D6: sin grupo propio en el modelo — son campos de `appearance` agrupados
    // por presentación (docs/41 §2.1 punto 1).
    groups: ["appearance"],
    labelKey: "panel.sections.effects",
    rows: [
      {
        id: "effects.boxShadow",
        labelKey: "panel.rows.boxShadow",
        control: "text",
        fields: [["appearance", "boxShadow"]],
        tier: "advanced",
        // "Ninguna" (value: "") NO vive aquí (fix, este commit): un 4to botón
        // de texto en el mismo `.pbx-segmented` de 26px fijo (pensado para
        // iconos/letras cortas S/M/L) cortaba la palabra "Ninguna" — se
        // renderiza aparte como botón independiente (`StylePanel.tsx`, junto
        // a `PresetSegmented`), fuera de este array.
        presets: [
          { labelKey: "panel.boxShadow.s", value: "0 1px 2px rgba(0,0,0,0.05)" },
          { labelKey: "panel.boxShadow.m", value: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)" },
          { labelKey: "panel.boxShadow.l", value: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)" },
        ],
      },
      { id: "effects.cursor", labelKey: "panel.rows.cursor", control: "select", fields: [["appearance", "cursor"]], tier: "advanced" },
      { id: "effects.outline", labelKey: "panel.rows.outline", control: "text", fields: [["appearance", "outline"]], tier: "advanced" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers puros (docs/41 §4.2)
// ---------------------------------------------------------------------------

/** Set de `"group.key"` presentes en `STYLE_FIELDS` — el catálogo editable hoy. */
const RENDERABLE_FIELD_KEYS: ReadonlySet<string> = new Set(
  STYLE_FIELDS.map((f) => `${f.group}.${f.key}`),
);

function fieldKey(path: StylePath): string {
  return `${path[0]}.${path[1]}`;
}

/**
 * ¿Todos los `fields` de esta fila existen ya en `STYLE_FIELDS`? Una fila cuyo
 * campo todavía no está en el catálogo (caso D6, sección `effects` antes del
 * Paso 5) no es renderizable — `sectionsForNode` la filtra.
 */
export function rowIsRenderable(row: RowDescriptor): boolean {
  return row.fields.every((path) => RENDERABLE_FIELD_KEYS.has(fieldKey(path)));
}

/**
 * ¿Todos los `fields` de esta fila pertenecen a grupos habilitados por el
 * componente? Hace falta filtrar **por fila** y no solo por sección porque una
 * sección de PRESENTACIÓN puede tocar dos grupos del modelo (docs/41 §2.1,
 * §6): `typography` incluye `appearance.color` (D5) y `effects` es 100 %
 * `appearance`. Sin este filtro, un `image` (`enabledGroups` con `appearance`
 * pero sin `typography`) vería filas de tipografía que hoy no ve, y un `alert`
 * (`typography` sin `appearance`) vería el color de texto que su schema no
 * habilita — una regresión frente a `StyleGroupAccordion`, que solo pinta
 * grupos habilitados.
 */
function rowGroupsEnabled(row: RowDescriptor, enabled: ReadonlySet<StyleGroup>): boolean {
  return row.fields.every((path) => enabled.has(path[0]));
}

/**
 * Secciones visibles para un nodo, en el orden fijo, dados sus grupos
 * habilitados (`def.styleSchema.enabledGroups`, o los 5 grupos si el
 * componente no restringe). Una sección se oculta si:
 * - ninguno de sus `groups` está en `enabledGroups`, o
 * - tras filtrar las filas no renderizables (`rowIsRenderable`) y las que
 *   tocan grupos no habilitados (`rowGroupsEnabled`) no le queda ninguna fila
 *   (docs/41 §5.3, caso `effects` antes del Paso 5).
 *
 * Las filas devueltas ya vienen filtradas a las renderizables y habilitadas.
 */
export function sectionsForNode(enabledGroups: StyleGroup[]): SectionDescriptor[] {
  const enabled = new Set(enabledGroups);
  const out: SectionDescriptor[] = [];
  for (const section of PANEL_SECTIONS) {
    const touchesEnabledGroup = section.groups.some((g) => enabled.has(g));
    if (!touchesEnabledGroup) continue;
    const renderableRows = section.rows.filter(
      (row) => rowIsRenderable(row) && rowGroupsEnabled(row, enabled),
    );
    if (renderableRows.length === 0) continue;
    out.push({ ...section, rows: renderableRows });
  }
  return out;
}

/**
 * Filas de una sección para un tier dado (`"common"` o `"advanced"`), ya
 * filtradas a renderizables.
 *
 * **Cambio de criterio (fase 2 de simplificación del panel, petición
 * explícita del usuario):** ya NO existe un umbral de "cuántas filas
 * avanzadas justifican un disclosure" — el disclosure LOCAL por sección
 * ("Avanzado ⌄") se eliminó por completo. El gateo de qué filas `advanced`
 * se muestran pasó a ser GLOBAL vía `useExperienceLevel` (`StylePanel.tsx`):
 * con `experienceLevel==="simple"` las filas `advanced` no se renderizan en
 * absoluto (ni colapsadas); con `"advanced"` se muestran todas, mezcladas
 * con las `"common"`, sin ningún control de expandir/colapsar. Esta función
 * ahora es una separación pura por `tier`, sin ningún umbral ni
 * reclasificación.
 */
export function rowsFor(section: SectionDescriptor, tier: "common" | "advanced"): RowDescriptor[] {
  return section.rows.filter((row) => row.tier === tier && rowIsRenderable(row));
}

/** Lee `style[group][key]` de una capa parcial de `StyleProperties`, tipado laxo (valor crudo o token ref). */
function readField(layer: Partial<StyleProperties> | undefined, path: StylePath): unknown {
  if (!layer) return undefined;
  const [group, key] = path;
  const groupValue = layer[group] as Record<string, unknown> | undefined;
  return groupValue?.[key];
}

/**
 * Capa de estilo del nodo en el breakpoint dado: `base` para `"base"`, o el
 * override de ESE breakpoint exacto (sin cascada) para los demás. Esto es lo
 * que corrige `styleGroupCounts.ts#countActiveFields` (docs/41 §4.2): un
 * conteo "en el breakpoint activo" no debe contar valores heredados de una
 * capa inferior, solo lo declarado EN esa capa.
 */
function layerAt(node: BuilderNode, breakpoint: Breakpoint): Partial<StyleProperties> | undefined {
  if (breakpoint === "base") return node.style.base;
  return node.style.overrides?.[breakpoint];
}

/**
 * Cuenta cuántos campos de `section` (cualquier tier) están declarados EN LA
 * CAPA del breakpoint activo (no en cualquier capa del nodo, a diferencia de
 * `countActiveFields`). Ejemplo del bug que corrige: un valor declarado solo
 * en `base` con breakpoint activo `md` cuenta 0 en `md` y 1 en `base`.
 */
export function modifiedCountAt(node: BuilderNode, section: SectionDescriptor, breakpoint: Breakpoint): number {
  const layer = layerAt(node, breakpoint);
  if (!layer) return 0;
  let count = 0;
  for (const row of section.rows) {
    if (!rowIsRenderable(row)) continue;
    for (const path of row.fields) {
      if (readField(layer, path) !== undefined) count++;
    }
  }
  return count;
}
