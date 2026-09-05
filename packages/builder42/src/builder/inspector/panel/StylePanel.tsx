/**
 * StylePanel — pila de secciones del panel de propiedades unificado, con
 * orden fijo, gateo GLOBAL de filas avanzadas vía `useExperienceLevel` y
 * badge de conteo por breakpoint activo (docs/41 §5.3, Paso 5 de la tabla
 * §7). Sustituye a `form/StyleSection.tsx` (`StyleSection*`), pero SIN
 * cablearse todavía a `InspectorForm.tsx` (docs/41 §0.1) — aditivo y
 * reversible, ese cableado es el Paso 6.
 *
 * Combina:
 * - `panel/sections.ts` (PURO): qué secciones/filas mostrar, en qué orden,
 *   y badge de conteo.
 * - `panel/origin.ts` (vía `PropertyField`): tri-estado heredado/modificado/
 *   token por fila.
 * - `panel/PanelSection.tsx` / `PropertyRow.tsx`: presentación.
 * - `panel/controls/*`: el control concreto por `RowDescriptor.control`.
 *
 * Mismo contrato de props que `StyleSection.tsx` (`{ node }`): lee
 * `activeBreakpoint` y `site.meta.breakpoints` del store real — NUNCA
 * `DEFAULT_BREAKPOINTS` hardcodeado (docs/41 §2.1 punto 3).
 *
 * **Divulgación progresiva de filas avanzadas (fase 2 de simplificación del
 * panel, petición explícita del usuario, este commit):** ya NO hay un
 * disclosure "Avanzado ⌄" local por sección (Map de sesión, umbral de 2+
 * filas, auto-expansión al detectar un valor avanzado ya declarado — todo
 * ese mecanismo se eliminó). El gateo es GLOBAL vía `useExperienceLevel()`:
 * con `isSimple`, las filas `tier==="advanced"` no se renderizan en absoluto
 * (desaparecen del DOM, ni colapsadas ni con chevron); con `isAdvanced`,
 * TODAS las filas (`common` + `advanced`) se muestran siempre, mezcladas en
 * el mismo bloque continuo de la sección, sin ningún control de expandir.
 */

import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { useExperienceLevel } from "@/hooks/useExperienceLevel";
import { getDefinition } from "@/builder/registry/componentRegistry";
import { PbxSelect } from "@/components";
import type { BuilderNode, StyleGroup, StyleState, StyleValue } from "@/builder/model/types";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  AlignCenter,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  StretchVertical,
  Rows3,
  Columns3,
  Grid3x3,
  StretchHorizontal,
  Square,
  IconButton,
  CloseIcon,
} from "@/components";
import { ALL_GROUPS, STYLE_GROUP_ICONS } from "../form/constants";
import { StateSelector } from "../form/StateSelector";
import { StateStyleField } from "../controls/StateStyleField";
import { styleFieldsForGroup, tokenGroupForField, type StyleFieldDef } from "../styleFields";
import {
  sectionsForNode,
  rowsFor,
  modifiedCountAt,
  ALWAYS_VISIBLE_ADVANCED_ROW_IDS,
  type RowDescriptor,
  type SectionDescriptor,
  type SectionId,
  type StylePath,
} from "./sections";
import { PanelSection } from "./PanelSection";
import { PropertyRow } from "./PropertyRow";
import { PropertyField, type PropertyFieldRenderArgs } from "./PropertyField";
import { NumericField } from "./controls/NumericField";
import { PresetNumeric } from "./controls/PresetNumeric";
import { PairGrid } from "./controls/PairGrid";
import { SidesGrid, type SideKey } from "./controls/SidesGrid";
import { SidesAxisPresets } from "./controls/SidesAxisPresets";
import { ColorField } from "./controls/ColorField";
import { ChipsTextField } from "./controls/ChipsTextField";
import { GridColumnsSimple } from "./controls/GridColumnsSimple";
import { PresetSegmented } from "./controls/PresetSegmented";
import { BorderSimple } from "./controls/BorderSimple";
import { IconSegmented, type IconSegmentedOption } from "./controls/IconSegmented";
import { CommittableInput } from "../controls/CommittableInput";
import { SearchableSelectControl } from "../controls/SearchableSelectControl";
import { GOOGLE_FONT_ENTRIES } from "@/builder/registry/catalogs/generated/googleFonts.names";
import { resolveValueOrigin } from "./origin";

// ---------------------------------------------------------------------------
// Mapeo de opciones de enum -> icono Lucide (docs/41 Paso 5 punto 6,
// `segmented`). Solo cubre los campos que HOY usan `control: "segmented"`
// en `panel/sections.ts` (§6): flexDirection, justifyContent, alignItems,
// textAlign, textDecoration, flexWrap, display. Claves i18n `panel.options.*`
// (agregadas en este paso a los 3 locales, AGENTS §5.1).
// ---------------------------------------------------------------------------

const SEGMENTED_ICONS: Record<string, Record<string, { icon: IconSegmentedOption["icon"]; labelKey: string }>> = {
  flexDirection: {
    // Iconos descriptivos (fix, petición del usuario): el icono representa
    // cómo QUEDAN DISPUESTOS los hijos, no el nombre CSS. `row` coloca los
    // hijos lado a lado en horizontal → se ven como barras VERTICALES
    // (`Columns3`); `column` los apila en vertical → barras HORIZONTALES
    // (`Rows3`). Antes estaban al revés (row=Rows3), que confundía porque
    // mostraba el icono del eje contrario al resultado visual real.
    // `row-reverse`/`column-reverse` reutilizan el mismo icono que su
    // contraparte no invertida: no se ofrecen como opción elegible del
    // control simple (ver `SIMPLE_DIRECTION_VALUES` más abajo), pero si un
    // nodo ya tiene ese valor guardado, conservan un icono coherente.
    row: { icon: Columns3, labelKey: "panel.options.row" },
    column: { icon: Rows3, labelKey: "panel.options.column" },
    "row-reverse": { icon: Columns3, labelKey: "panel.options.rowReverse" },
    "column-reverse": { icon: Rows3, labelKey: "panel.options.columnReverse" },
  },
  display: {
    // Solo 3 opciones ofrecidas por el control simple (flex/grid/block, ver
    // `SIMPLE_DISPLAY_VALUES`): son las que cubren el 95% de los casos de
    // layout de un componente del builder. `inline-block`/`inline-flex`/
    // `none` siguen siendo valores válidos del modelo (STYLE_FIELDS no se
    // tocó) — solo no se ofrecen para elegir desde este control.
    flex: { icon: StretchHorizontal, labelKey: "panel.options.displayFlex" },
    grid: { icon: Grid3x3, labelKey: "panel.options.displayGrid" },
    block: { icon: Square, labelKey: "panel.options.displayBlock" },
  },
  justifyContent: {
    "flex-start": { icon: AlignHorizontalJustifyStart, labelKey: "panel.options.flexStart" },
    center: { icon: AlignHorizontalJustifyCenter, labelKey: "panel.options.center" },
    "flex-end": { icon: AlignHorizontalJustifyEnd, labelKey: "panel.options.flexEnd" },
    "space-between": { icon: AlignHorizontalSpaceBetween, labelKey: "panel.options.spaceBetween" },
    "space-around": { icon: AlignHorizontalSpaceBetween, labelKey: "panel.options.spaceAround" },
    "space-evenly": { icon: AlignHorizontalSpaceBetween, labelKey: "panel.options.spaceEvenly" },
  },
  alignItems: {
    stretch: { icon: StretchVertical, labelKey: "panel.options.stretch" },
    "flex-start": { icon: AlignStartVertical, labelKey: "panel.options.flexStart" },
    center: { icon: AlignCenterVertical, labelKey: "panel.options.center" },
    "flex-end": { icon: AlignEndVertical, labelKey: "panel.options.flexEnd" },
    baseline: { icon: AlignCenterVertical, labelKey: "panel.options.baseline" },
  },
  textAlign: {
    left: { icon: AlignLeft, labelKey: "panel.options.alignLeft" },
    center: { icon: AlignCenter, labelKey: "panel.options.alignCenter" },
    right: { icon: AlignRight, labelKey: "panel.options.alignRight" },
    justify: { icon: AlignJustify, labelKey: "panel.options.alignJustify" },
  },
  textDecoration: {
    none: { icon: AlignJustify, labelKey: "panel.options.decorationNone" },
    underline: { icon: AlignLeft, labelKey: "panel.options.underline" },
    "line-through": { icon: AlignCenter, labelKey: "panel.options.lineThrough" },
  },
  flexWrap: {
    nowrap: { icon: AlignJustify, labelKey: "panel.options.nowrap" },
    wrap: { icon: AlignCenter, labelKey: "panel.options.wrap" },
    "wrap-reverse": { icon: AlignRight, labelKey: "panel.options.wrapReverse" },
  },
};

/**
 * Subconjunto de valores ofrecidos por el control SIMPLE de estas dos filas
 * puntuales (`layout.direction`, `layout.display`) — restricción de
 * PRESENTACIÓN, no de modelo (fase 1 de simplificación del panel, pedido del
 * usuario). `STYLE_FIELDS` (`styleFields.ts`) sigue declarando las 4/6
 * opciones completas: no se toca el campo global porque otros consumidores
 * (por ejemplo un futuro modo avanzado, o el propio valor ya guardado de un
 * nodo antiguo) siguen necesitando el catálogo completo. El filtro vive aquí,
 * a nivel de fila, con un `Record<row.id, valores permitidos>` en vez de una
 * propiedad genérica en `RowDescriptor` — son las únicas dos filas con esta
 * necesidad hoy; generalizarlo sin un segundo caso sería especular.
 *
 * Comportamiento documentado para un valor YA guardado que quedó fuera de
 * este subconjunto (p. ej. `row-reverse` de una edición anterior): NO se
 * agrega a las opciones ofrecidas (el usuario no puede volver a elegirlo a
 * propósito desde este control simple), pero tampoco se pierde ni se
 * reescribe — sigue en `node.style` y se exporta igual. `IconSegmented` no
 * resalta ninguna opción como activa en ese caso (su `value` no coincide con
 * ningún `option.value`), igual que ya hace hoy cuando el campo no tiene
 * ningún valor declarado ("heredado") — mismo criterio visual, sin lógica
 * nueva en el control. Ver `StylePanel.test.tsx` para el caso cubierto.
 */
const SIMPLE_SEGMENTED_VALUES: Record<string, string[]> = {
  "layout.direction": ["row", "column"],
  "layout.display": ["flex", "grid", "block"],
  // Distribución (justify-content): de 6 opciones a las 3 más usadas —
  // agrupar al inicio, centrar, y distribuir a los extremos. `flex-end`/
  // `space-around`/`space-evenly` siguen siendo valores válidos del modelo
  // (no se tocó `STYLE_FIELDS`), solo no se ofrecen en el control simple.
  "layout.justify": ["flex-start", "center", "space-between"],
};

/**
 * Filas `tier: "advanced"` que NO se gatean por el switch global de
 * `experienceLevel` (fase 2) porque tienen su PROPIA lógica de control en
 * modo simple, resuelta dentro de `StylePanelRow` (`StylePanelSection` las
 * incluye explícitamente aunque `showAdvanced` sea `false`):
 * - `layout.gridColumns` (fase 4): visible solo si `display:grid`
 *   (`resolvedDisplayIsGrid`), con `GridColumnsSimple` en vez de
 *   `ChipsTextField`.
 * - `effects.boxShadow` (fase 5): SIEMPRE visible (a diferencia de
 *   `gridColumns`, no depende de otro campo), con `PresetSegmented` en vez
 *   de `CommittableInput`.
 * - `appearance.border` (fase 6): SIEMPRE visible, mismo criterio que
 *   `boxShadow` (no depende de otro campo), con `BorderSimple` (3
 *   sub-controles: grosor/color/tipo) en vez de `CommittableInput`.
 */
/**
 * `ALWAYS_VISIBLE_ADVANCED_ROW_IDS` ahora vive en `sections.ts` (H1, docs/54
 * §2): `modifiedCountAt` necesita la misma lista para no contar como
 * "modificada" una fila `advanced` oculta en modo simple, así que se movió
 * al módulo puro compartido en vez de duplicarla aquí.
 */


const SIDE_ICON: Record<SideKey, React.ReactNode> = {
  top: <ArrowUp size={12} aria-hidden="true" />,
  right: <ArrowRight size={12} aria-hidden="true" />,
  bottom: <ArrowDown size={12} aria-hidden="true" />,
  left: <ArrowLeft size={12} aria-hidden="true" />,
};

/** Busca el `StyleFieldDef` correspondiente a un `[group,key]` (docs/41 Paso 5 punto 6). */
function findFieldDef(path: StylePath): StyleFieldDef | undefined {
  return styleFieldsForGroup(path[0]).find((f) => f.key === path[1]);
}

/**
 * ¿El valor RESUELTO de `layout.display` del nodo (en el breakpoint activo,
 * cascada + `defaultStyle` incluidos — mismo criterio que usa `PropertyField`
 * internamente vía `resolveValueOrigin`) es `"grid"`? Fase 4 de simplificación
 * del panel: gatea si la fila `layout.gridColumns` se muestra en absoluto en
 * modo simple.
 *
 * DECISIÓN DE DÓNDE VIVE ESTE GANCHO (documentada, pedida por la tarea): no
 * se agrega un mecanismo genérico "visible si campo X = valor Y" al
 * descriptor PURO de `sections.ts` — es la PRIMERA fila que necesita
 * condicionar su visibilidad según el valor de OTRO campo del mismo nodo, y
 * `rowIsRenderable`/`rowGroupsEnabled` (los dos ganchos existentes) resuelven
 * preguntas distintas (¿el campo está en el catálogo? ¿el grupo está
 * habilitado por el componente?), no "¿qué vale actualmente otro campo?".
 * Inventar un `RowDescriptor.visibleIf` genérico para un solo caso hoy sería
 * especular (mismo criterio ya aplicado en `SIMPLE_SEGMENTED_VALUES` arriba,
 * fase 1). Si en el futuro aparece un segundo caso real, ahí se justifica
 * generalizar. Por ahora el condicional vive aquí, en `StylePanel.tsx`
 * (Componente, no descriptor), reutilizando `resolveValueOrigin` — el mismo
 * módulo puro que ya resuelve el tri-estado de `PropertyField` — para no
 * reimplementar la cascada de breakpoints/defaultStyle a mano.
 * Si el valor resuelto es una referencia a token (`{ token }`) en vez de un
 * string plano, se trata como "no grid" (no se resuelve el token aquí): caso
 * de borde no observado en la práctica (nadie tokeniza `display`), y tratarlo
 * como "no grid" es la opción segura (oculta la fila en vez de arriesgar un
 * falso positivo).
 */
function resolvedDisplayIsGrid(
  node: BuilderNode,
  defaultStyle: StylePanelDefaultStyle,
  breakpoint: ReturnType<typeof useDocumentStore.getState>["activeBreakpoint"],
  breakpointConfig: ReturnType<typeof useDocumentStore.getState>["site"]["meta"]["breakpoints"],
): boolean {
  const origin = resolveValueOrigin(node.style, defaultStyle, breakpoint, breakpointConfig, [
    "layout",
    "display",
  ]);
  const value = origin.kind === "none" ? undefined : origin.value;
  return value === "grid";
}

/** `defaultStyle` del componente (registry) — mismo tipo condicional usado por `StylePanelSection`. */
type StylePanelDefaultStyle = ReturnType<typeof getDefinition> extends infer D
  ? D extends { defaultStyle: infer S }
    ? S | undefined
    : undefined
  : undefined;

export function StylePanel({ node }: { node: BuilderNode }) {
  const { t } = useTranslation("inspector");
  const breakpoint = useDocumentStore((s) => s.activeBreakpoint);
  // Config de breakpoints REAL del sitio (docs/41 §2.1 punto 3) — nunca
  // `DEFAULT_BREAKPOINTS` hardcodeado.
  const breakpointConfig = useDocumentStore((s) => s.site.meta.breakpoints);
  const tokens = useDocumentStore((s) => s.site.meta.tokens);
  const setPreviewState = useDocumentStore((s) => s.setPreviewState);
  // Gateo GLOBAL de filas avanzadas (fase 2 de simplificación del panel,
  // este commit): con `isSimple` las filas `tier==="advanced"` no se
  // renderizan en absoluto; con `isAdvanced` se muestran todas.
  const { isSimple } = useExperienceLevel();

  const def = getDefinition(node.type);
  const defaultStyle = def?.defaultStyle;
  const enabledGroups: StyleGroup[] = def?.styleSchema?.enabledGroups ?? ALL_GROUPS;

  const sections = useMemo(() => sectionsForNode(enabledGroups), [enabledGroups]);

  // ---- Estado de expansión de SECCIÓN completa (punto 4): todas abiertas
  // por defecto, `useState` local del componente (no persiste sesión, no
  // hay razón documentada para colapsarlas al montar).
  const [openSections, setOpenSections] = useState<Set<SectionId>>(
    () => new Set(sections.map((s) => s.id)),
  );
  const toggleSection = (id: SectionId) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Si cambian las secciones visibles (cambio de nodo a otro tipo con otro
  // `enabledGroups`), las nuevas secciones deben nacer abiertas también.
  useEffect(() => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const s of sections) {
        if (!next.has(s.id)) {
          next.add(s.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo re-evalúa cuando cambia el SET de secciones visibles (por id), no la referencia del array.
  }, [sections.map((s) => s.id).join(",")]);

  // ---- Candado de SidesGrid (punto 6 'sides'): estado POR NODO, local,
  // reseteado al cambiar de nodo (docs/41 §4.4).
  const [sidesLocked, setSidesLocked] = useState<{ padding: boolean; margin: boolean }>({
    padding: false,
    margin: false,
  });
  useEffect(() => {
    setSidesLocked({ padding: false, margin: false });
  }, [node.id]);

  // ---- StateSelector (punto 8, D7): mismo comportamiento que
  // `form/StyleSection.tsx` — replicado tal cual por ahora, sin reposicionar
  // (eso es Paso 6/7). `pressed` se agrega dinámicamente si el nodo tiene un
  // behavior `toggle`, igual que la implementación actual.
  const hasToggleBehavior = (node.behaviors ?? []).some((b) => b.type === "toggle");
  const availableStates = useMemo(() => {
    const declared = def?.styleSchema?.states ?? [];
    if (!hasToggleBehavior) return declared;
    return [...declared, { state: "pressed" as StyleState, label: t("form.statePressed") }];
  }, [def, hasToggleBehavior, t]);
  const [activeState, setActiveState] = useState<StyleState | null>(null);
  const handleStateChange = (state: StyleState | null) => {
    setActiveState(state);
    setPreviewState(node.id, state);
  };
  // Al cambiar de nodo, el eje de estado vuelve a "Normal" (mismo criterio
  // que el breakpoint: UI-state que no sobrevive a cambiar de selección).
  useEffect(() => {
    setActiveState(null);
  }, [node.id]);

  return (
    <div className="pbx-style-groups">
      {availableStates.length > 0 && (
        <StateSelector states={availableStates} active={activeState} onChange={handleStateChange} />
      )}

      {activeState !== null ? (
        // Punto 8, opción simplificada elegida (ver resumen final): con un
        // estado de interacción activo se reutiliza `StateStyleField` TAL
        // CUAL ya existe, por sección/grupo — el tri-estado de origen
        // (heredado/capa/defaultStyle) es un concepto del eje de BREAKPOINT,
        // no tiene sentido en el eje de estado (plano, sin cascada).
        <>
          {enabledGroups.map((group) => {
            const fields = styleFieldsForGroup(group);
            if (fields.length === 0) return null;
            return (
              <div key={group} className="pbx-panel-section">
                <div className="pbx-panel-section__body">
                  {fields.map((field) => (
                    <StateStyleField
                      key={field.key}
                      node={node}
                      state={activeState}
                      field={field}
                      raw={readStateRaw(node, activeState, field.group, field.key)}
                      tokens={tokens}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      ) : (
        sections.map((section) => (
          <StylePanelSection
            key={section.id}
            node={node}
            section={section}
            breakpoint={breakpoint}
            breakpointConfig={breakpointConfig}
            defaultStyle={defaultStyle}
            tokens={tokens}
            open={openSections.has(section.id)}
            onToggleOpen={() => toggleSection(section.id)}
            showAdvanced={!isSimple}
            isSimple={isSimple}
            sidesLocked={sidesLocked}
            onToggleSidesLock={(key) =>
              setSidesLocked((prev) => ({ ...prev, [key]: !prev[key] }))
            }
          />
        ))
      )}
    </div>
  );
}

/** Lee `node.style.states[state][group][key]`, igual que `StyleGroupAccordion` para armar `raw`. */
function readStateRaw(node: BuilderNode, state: StyleState, group: string, key: string): StyleValue | undefined {
  const layer = node.style.states?.[state] as Record<string, Record<string, StyleValue>> | undefined;
  return layer?.[group]?.[key];
}

// ---------------------------------------------------------------------------
// Una sección completa: encabezado + filas (comunes siempre, avanzadas solo
// si `showAdvanced`, mezcladas en el mismo bloque continuo — sin disclosure).
// ---------------------------------------------------------------------------
function StylePanelSection({
  node,
  section,
  breakpoint,
  breakpointConfig,
  defaultStyle,
  tokens,
  open,
  onToggleOpen,
  sidesLocked,
  onToggleSidesLock,
  showAdvanced,
  isSimple,
}: {
  node: BuilderNode;
  section: SectionDescriptor;
  breakpoint: ReturnType<typeof useDocumentStore.getState>["activeBreakpoint"];
  breakpointConfig: ReturnType<typeof useDocumentStore.getState>["site"]["meta"]["breakpoints"];
  defaultStyle: StylePanelDefaultStyle;
  tokens: ReturnType<typeof useDocumentStore.getState>["site"]["meta"]["tokens"];
  open: boolean;
  onToggleOpen: () => void;
  sidesLocked: { padding: boolean; margin: boolean };
  onToggleSidesLock: (key: "padding" | "margin") => void;
  /** Gateo global (fase 2, este commit): `true` (experienceLevel advanced) muestra también las filas `tier==="advanced"`; `false` (simple) las omite del DOM. */
  showAdvanced: boolean;
  /** `experienceLevel` actual (fase 4, este commit): decide el control de `layout.gridColumns` (`GridColumnsSimple` vs `ChipsTextField`) y su condición de visibilidad en modo simple. */
  isSimple: boolean;
}) {
  const { t } = useTranslation("inspector");

  const commonRows = rowsFor(section, "common");
  // Ver `ALWAYS_VISIBLE_ADVANCED_ROW_IDS` arriba: estas filas siempre llegan
  // a `StylePanelRow` aunque estemos en modo simple, porque cada una decide
  // su propio control/visibilidad internamente en vez de gatearse por el
  // switch global de `tier`.
  const specialRowsInSimple = !showAdvanced
    ? rowsFor(section, "advanced").filter((r) => ALWAYS_VISIBLE_ADVANCED_ROW_IDS.includes(r.id))
    : [];
  const advancedRows = showAdvanced ? rowsFor(section, "advanced") : specialRowsInSimple;
  const modifiedCount = modifiedCountAt(node, section, breakpoint, !showAdvanced);
  const Icon = STYLE_GROUP_ICONS[section.groups[0] as StyleGroup];

  const renderRow = (row: RowDescriptor) => (
    <StylePanelRow
      key={row.id}
      node={node}
      row={row}
      breakpoint={breakpoint}
      breakpointConfig={breakpointConfig}
      defaultStyle={defaultStyle}
      tokens={tokens}
      sidesLocked={sidesLocked}
      onToggleSidesLock={onToggleSidesLock}
      isSimple={isSimple}
    />
  );

  return (
    <PanelSection
      id={section.id}
      label={t(section.labelKey)}
      icon={Icon ? <Icon size={14} /> : undefined}
      modifiedCount={modifiedCount}
      open={open}
      onToggleOpen={onToggleOpen}
    >
      {commonRows.map(renderRow)}
      {advancedRows.map(renderRow)}
    </PanelSection>
  );
}

// ---------------------------------------------------------------------------
// Una fila: decide el control concreto según `row.control` (docs/41 Paso 5
// punto 6).
// ---------------------------------------------------------------------------
function StylePanelRow({
  node,
  row,
  breakpoint,
  breakpointConfig,
  defaultStyle,
  tokens,
  sidesLocked,
  onToggleSidesLock,
  isSimple,
}: {
  node: BuilderNode;
  row: RowDescriptor;
  breakpoint: ReturnType<typeof useDocumentStore.getState>["activeBreakpoint"];
  breakpointConfig: ReturnType<typeof useDocumentStore.getState>["site"]["meta"]["breakpoints"];
  defaultStyle: StylePanelDefaultStyle;
  tokens: ReturnType<typeof useDocumentStore.getState>["site"]["meta"]["tokens"];
  sidesLocked: { padding: boolean; margin: boolean };
  onToggleSidesLock: (key: "padding" | "margin") => void;
  /** `experienceLevel` actual (fase 4, este commit): ver `layout.gridColumns` más abajo. */
  isSimple: boolean;
}) {
  const { t } = useTranslation("inspector");
  const label = t(row.labelKey);
  const controlId = `pbx-field-${row.id}`;

  // ---------------------------------------------------------------------
  // Caso especial componente `icon` en modo simple (petición del usuario):
  // los iconos son cuadrados por naturaleza, así que en vez de 2 filas
  // separadas (`size.width` + `size.height`) se muestra UNA sola fila
  // "Tamaño" que escribe AMBAS medidas con el mismo valor de una vez. La
  // fila de `width` se transforma (label "Tamaño" + `commit` espejo a
  // `height`); la de `height` se omite del DOM (`return null`) para no
  // duplicar. En modo avanzado (o cualquier otro tipo de nodo) las dos
  // filas se comportan como siempre, independientes. Se resuelve por
  // `node.type` + `isSimple` + `row.id` — mismo criterio de caso especial
  // que `layout.gridColumns` más abajo.
  // ---------------------------------------------------------------------
  const isSimpleIcon = isSimple && node.type === "icon";
  if (isSimpleIcon && row.id === "size.height") {
    return null;
  }
  if (isSimpleIcon && row.id === "size.width") {
    const path = row.fields[0];
    if (!path) return null;
    const field = findFieldDef(path);
    const tokenGroupPrefix = field ? tokenGroupForField(field) : null;
    const presets = (row.presets ?? []).map((p) => ({ label: t(p.labelKey), value: p.value }));
    return (
      <PropertyField
        node={node}
        breakpoint={breakpoint}
        breakpointConfig={breakpointConfig}
        defaultStyle={defaultStyle}
        label={t("panel.rows.size")}
        path={path}
        tokenGroupPrefix={tokenGroupPrefix}
        tokens={tokens}
        controlId={controlId}
      >
        {({ freeValue, commit }) => {
          // Commit espejo: además de `width` (que lo escribe el propio
          // `PropertyField` vía `commit`), replica el MISMO valor en
          // `size.height` directamente en el store. `""` (reset) borra ambas.
          const commitSquare = (v: string) => {
            commit(v);
            const heightPath: StylePath = ["size", "height"];
            if (v === "") {
              useDocumentStore.getState().resetStyleProp(node.id, breakpoint, heightPath);
            } else {
              useDocumentStore.getState().setStyleProp(node.id, breakpoint, heightPath, v);
            }
          };
          return (
            <PresetNumeric
              value={freeValue}
              presets={presets}
              numericProps={{
                units: field?.units ?? ["px"],
                defaultUnit: field?.defaultUnit,
                placeholder: field?.placeholder,
              }}
              presetsAriaLabel={t("panel.rows.size")}
              onCommit={commitSquare}
            />
          );
        }}
      </PropertyField>
    );
  }

  // ---------------------------------------------------------------------
  // Caso especial `layout.gridColumns` (fase 4 de simplificación del panel,
  // este commit): en modo simple, esta fila SOLO se muestra si el valor
  // RESUELTO de `layout.display` del nodo es `"grid"` — si no, no se
  // renderiza en absoluto (ni vacía, ni deshabilitada). En modo avanzado se
  // comporta exactamente igual que antes: siempre visible, `ChipsTextField`,
  // sin condicionar a `display`. Se resuelve por `row.id` (no por
  // `row.control`) para no afectar ningún otro `chipsText` futuro que no
  // tenga esta necesidad.
  // ---------------------------------------------------------------------
  if (row.id === "layout.gridColumns") {
    if (isSimple && !resolvedDisplayIsGrid(node, defaultStyle, breakpoint, breakpointConfig)) {
      return null;
    }
    const path = row.fields[0];
    if (!path) return null;
    const field = findFieldDef(path);
    const tokenGroupPrefix = field ? tokenGroupForField(field) : null;
    return (
      <PropertyField
        node={node}
        breakpoint={breakpoint}
        breakpointConfig={breakpointConfig}
        defaultStyle={defaultStyle}
        label={label}
        path={path}
        tokenGroupPrefix={tokenGroupPrefix}
        tokens={tokens}
        controlId={controlId}
      >
        {({ freeValue, commit }) =>
          isSimple ? (
            <GridColumnsSimple
              value={freeValue}
              placeholder={t("panel.gridColumnsSimple.placeholder")}
              ariaLabel={t("panel.gridColumnsSimple.ariaLabel")}
              onCommit={commit}
            />
          ) : (
            <ChipsTextField
              value={freeValue}
              presets={(row.presets ?? []).map((p) => ({ label: t(p.labelKey), value: p.value }))}
              placeholder={field?.placeholder}
              onCommit={commit}
            />
          )
        }
      </PropertyField>
    );
  }

  // ---------------------------------------------------------------------
  // Caso especial `effects.boxShadow` (fase 5 de simplificación del panel,
  // este commit): en modo simple se sustituye el `CommittableInput` de texto
  // libre por `PresetSegmented` con los `row.presets` curados (Ninguna/S/M/L,
  // ver D9 en `sections.ts`). A diferencia de `layout.gridColumns` (fase 4),
  // esta fila NO depende del valor de otro campo — siempre visible, solo
  // cambia el CONTROL según `isSimple`. En modo avanzado se comporta
  // exactamente igual que antes: `CommittableInput` de texto libre, sin
  // condicionar a nada.
  // ---------------------------------------------------------------------
  if (row.id === "effects.boxShadow") {
    const path = row.fields[0];
    if (!path) return null;
    const field = findFieldDef(path);
    const tokenGroupPrefix = field ? tokenGroupForField(field) : null;
    return (
      <PropertyField
        node={node}
        breakpoint={breakpoint}
        breakpointConfig={breakpointConfig}
        defaultStyle={defaultStyle}
        label={label}
        path={path}
        tokenGroupPrefix={tokenGroupPrefix}
        tokens={tokens}
        controlId={controlId}
      >
        {({ freeValue, commit }) =>
          isSimple ? (
            <div className="pbx-boxshadow-simple">
              {/* "Ninguna" como botón independiente (fix, este commit): un
                  4to botón de TEXTO en el mismo `.pbx-segmented` de 26px fijo
                  (pensado para S/M/L, letras cortas) cortaba la palabra
                  "Ninguna" — se separa en su propio `IconButton` (X), del
                  mismo alto (26px, `size="md"`) para alinear visualmente con
                  el segmentado de al lado. */}
              <IconButton
                icon={CloseIcon}
                size="md"
                label={t("panel.boxShadow.none")}
                active={freeValue === ""}
                onClick={() => commit("")}
              />
              <PresetSegmented
                options={(row.presets ?? []).map((p) => ({ label: t(p.labelKey), value: p.value }))}
                value={freeValue}
                onCommit={commit}
                ariaLabel={label}
              />
            </div>
          ) : (
            <CommittableInput value={freeValue} placeholder={field?.placeholder} onCommit={commit} />
          )
        }
      </PropertyField>
    );
  }

  // ---------------------------------------------------------------------
  // Caso especial `appearance.border` (fase 6 de simplificación del panel,
  // este commit): en modo simple se sustituye el `CommittableInput` de texto
  // libre (shorthand CSS completo escrito a mano) por `BorderSimple`, que
  // combina 3 sub-controles (grosor/tipo por `<select>`, color por
  // `ColorField`) y arma/parsea el MISMO string shorthand — no hay 3 campos
  // nuevos en el modelo, sigue siendo un solo `appearance.border: string`
  // (mismo criterio que `effects.boxShadow`, fase 5). SIEMPRE visible en
  // ambos modos, no depende de otro campo. En modo avanzado se comporta
  // exactamente igual que antes: `CommittableInput` de texto libre.
  // ---------------------------------------------------------------------
  if (row.id === "appearance.border") {
    const path = row.fields[0];
    if (!path) return null;
    const field = findFieldDef(path);
    const tokenGroupPrefix = field ? tokenGroupForField(field) : null;
    return (
      <PropertyField
        node={node}
        breakpoint={breakpoint}
        breakpointConfig={breakpointConfig}
        defaultStyle={defaultStyle}
        label={label}
        path={path}
        tokenGroupPrefix={tokenGroupPrefix}
        tokens={tokens}
        controlId={controlId}
      >
        {({ freeValue, commit }) =>
          isSimple ? (
            <BorderSimple value={freeValue} onCommit={commit} />
          ) : (
            <CommittableInput value={freeValue} placeholder={field?.placeholder} onCommit={commit} />
          )
        }
      </PropertyField>
    );
  }

  if (row.control === "pair") {
    // Punto 6 'pair': fila compartida (`PropertyRow columns={2}`) + 2
    // `PropertyField` INDEPENDIENTES en modo `bare` (opción (a) elegida, ver
    // resumen final) — cada mitad tiene su propio tri-estado/reset/token.
    const [pathA, pathB] = row.fields;
    if (!pathA || !pathB) return null;
    const fieldA = findFieldDef(pathA);
    const fieldB = findFieldDef(pathB);
    // H3 (docs/54 §2): antes `${label} A`/`${label} B` — un lector de
    // pantalla anunciaba "Overflow A" en vez de "Overflow X"/"Overflow
    // horizontal", y no había ninguna distinción VISUAL entre las dos
    // mitades. `StyleFieldDef.label` ya tiene el texto correcto por campo
    // ("Overflow X", "Overflow Y", "Celda: columna", "Celda: fila") — se usa
    // tal cual como `aria-label`, y su último segmento (tras ": " si lo
    // tiene) como mini-label visible corto.
    const labelA = fieldA?.label ?? `${label} A`;
    const labelB = fieldB?.label ?? `${label} B`;
    const shortLabel = (full: string) => full.includes(": ") ? full.split(": ")[1]! : full;
    return (
      <PropertyRow label={label} columns={2}>
        <PairGrid
          fields={[
            {
              ariaLabel: labelA,
              visibleLabel: shortLabel(labelA),
              control: (
                <PropertyField
                  node={node}
                  breakpoint={breakpoint}
                  breakpointConfig={breakpointConfig}
                  defaultStyle={defaultStyle}
                  label={label}
                  path={pathA}
                  tokenGroupPrefix={fieldA ? tokenGroupForField(fieldA) : null}
                  tokens={tokens}
                  bare
                >
                  {(args) => renderLeafControl(fieldA, args)}
                </PropertyField>
              ),
            },
            {
              ariaLabel: labelB,
              visibleLabel: shortLabel(labelB),
              control: (
                <PropertyField
                  node={node}
                  breakpoint={breakpoint}
                  breakpointConfig={breakpointConfig}
                  defaultStyle={defaultStyle}
                  label={label}
                  path={pathB}
                  tokenGroupPrefix={fieldB ? tokenGroupForField(fieldB) : null}
                  tokens={tokens}
                  bare
                >
                  {(args) => renderLeafControl(fieldB, args)}
                </PropertyField>
              ),
            },
          ]}
        />
      </PropertyRow>
    );
  }

  const path = row.fields[0];
  if (!path) return null;
  const field = findFieldDef(path);
  const tokenGroupPrefix = field ? tokenGroupForField(field) : null;

  // ---------------------------------------------------------------------
  // `spacing.padding`/`spacing.margin` (control `"sides"`,
  // docs/spacing-simple-presets-plan.md): en modo simple se sustituye la
  // rejilla numérica 2×2 de `SidesGrid` por `SidesAxisPresets` (2 selects,
  // eje X/Y, presets sm/md/lg de `BASE_TOKENS.spacing`) — mismo criterio que
  // `layout.gridColumns`/`effects.boxShadow`/`appearance.border` arriba: el
  // descriptor (`row.control`) no cambia, solo el componente que pinta la
  // fila. En modo simple se pierde el candado/`tokenAction` de `SidesGrid`
  // (no aplican: cada select ya controla 2 lados a la vez, y no hay acción
  // de vincular a token para un preset compuesto) — el modo avanzado
  // conserva ambos sin cambios.
  // ---------------------------------------------------------------------
  if (row.control === "sides") {
    const sideKey = path[1] === "margin" ? "margin" : "padding";
    return (
      <PropertyField
        node={node}
        breakpoint={breakpoint}
        breakpointConfig={breakpointConfig}
        defaultStyle={defaultStyle}
        label={label}
        path={path}
        tokenGroupPrefix={tokenGroupPrefix}
        tokens={tokens}
        tall
        inlineTokenAction
      >
        {({ freeValue, commit, tokenAction }) =>
          isSimple ? (
            <SidesAxisPresets value={freeValue} onCommit={commit} />
          ) : (
            <SidesGrid
              value={freeValue}
              units={field?.units ?? ["px", "%", "em", "rem"]}
              defaultUnit={field?.defaultUnit}
              icons={SIDE_ICON}
              locked={sidesLocked[sideKey]}
              onToggleLock={() => onToggleSidesLock(sideKey)}
              onCommit={commit}
              tokenAction={tokenAction}
            />
          )
        }
      </PropertyField>
    );
  }

  return (
    <PropertyField
      node={node}
      breakpoint={breakpoint}
      breakpointConfig={breakpointConfig}
      defaultStyle={defaultStyle}
      label={label}
      path={path}
      tokenGroupPrefix={tokenGroupPrefix}
      tokens={tokens}
      controlId={controlId}
    >
      {(args) => renderRowControl(row, field, args, t, controlId, isSimple, tokens)}
    </PropertyField>
  );
}

/**
 * Control interno para filas de campo simple (todo salvo `pair`/`sides`,
 * que se resuelven aparte arriba). Recibe `{freeValue, commit}` del
 * render-prop de `PropertyField`.
 */
/**
 * Opciones del `searchableSelect` de `typography.family` (H2, docs/54 §2):
 * primero las familias declaradas como TOKEN del sitio
 * (`tokens.typography.families`, valores ya en uso/coherentes con el tema),
 * luego el catálogo generado de Google Fonts (`registry/catalogs/generated`)
 * como fuente de familias libres para elegir. El `value` de cada opción es
 * el stack CSS completo que se escribe en `typography.fontFamily` — para un
 * token de sitio, `fam.stack` (p. ej. "Inter, system-ui, sans-serif"); para
 * una entrada de Google Fonts, `"<family>, sans-serif"` (con fallback
 * genérico según su `category`, mismo criterio de fallback que usa
 * `TokenFontFamily.stack` en los tokens base). Pura: sin React, testeable.
 */
function fontFamilyOptions(
  tokens: ReturnType<typeof useDocumentStore.getState>["site"]["meta"]["tokens"] | undefined,
): { label: string; value: string }[] {
  const siteFamilies = tokens?.typography?.families ?? {};
  const siteOptions = Object.entries(siteFamilies).map(([key, fam]) => ({
    label: `${key} (${fam.stack.split(",")[0]?.trim() ?? fam.stack})`,
    value: fam.stack,
  }));
  const googleFallback: Record<string, string> = {
    serif: "serif",
    "sans-serif": "sans-serif",
    display: "sans-serif",
    handwriting: "cursive",
    monospace: "monospace",
  };
  const googleOptions = GOOGLE_FONT_ENTRIES.map((entry) => ({
    label: entry.family,
    value: `${entry.family}, ${googleFallback[entry.category] ?? "sans-serif"}`,
  }));
  return [...siteOptions, ...googleOptions];
}

function renderRowControl(
  row: RowDescriptor,
  field: StyleFieldDef | undefined,
  args: PropertyFieldRenderArgs,
  t: (key: string, opts?: Record<string, unknown>) => string,
  controlId: string,
  isSimple: boolean,
  tokens?: ReturnType<typeof useDocumentStore.getState>["site"]["meta"]["tokens"],
): React.ReactNode {
  const { freeValue, commit } = args;

  switch (row.control) {
    case "searchableSelect":
      return (
        <SearchableSelectControl
          value={freeValue}
          options={fontFamilyOptions(tokens)}
          placeholder={field?.placeholder}
          onCommit={commit}
        />
      );

    case "select": {
      const options = field?.options ?? [];
      return (
        <PbxSelect
          id={controlId}
          value={freeValue}
          onChange={commit}
          options={options}
        />
      );
    }

    case "numeric":
      return (
        <NumericField
          value={freeValue}
          units={field?.units ?? ["px"]}
          defaultUnit={field?.defaultUnit}
          placeholder={field?.placeholder}
          onCommit={commit}
        />
      );

    case "presetNumeric": {
      const presets = (row.presets ?? []).map((p) => ({ label: t(p.labelKey), value: p.value }));
      return (
        <PresetNumeric
          value={freeValue}
          presets={presets}
          numericProps={{
            units: field?.units ?? ["px"],
            defaultUnit: field?.defaultUnit,
            placeholder: field?.placeholder,
          }}
          presetsAriaLabel={t(row.labelKey)}
          onCommit={commit}
        />
      );
    }

    case "segmented": {
      const optionMap = field?.key ? SEGMENTED_ICONS[field.key] : undefined;
      const allowedValues = SIMPLE_SEGMENTED_VALUES[row.id];
      const sourceOptions = allowedValues
        ? (field?.options ?? []).filter((opt) => allowedValues.includes(opt.value))
        : field?.options ?? [];
      const options: IconSegmentedOption[] = sourceOptions.map((opt) => {
        const spec = optionMap?.[opt.value];
        return {
          value: opt.value,
          icon: spec?.icon ?? AlignJustify,
          label: spec ? t(spec.labelKey) : opt.label,
        };
      });
      return (
        <IconSegmented options={options} value={freeValue} onCommit={commit} ariaLabel={t(row.labelKey)} />
      );
    }

    case "color":
      return (
        <ColorField
          value={/^#[0-9a-f]{6}$/i.test(freeValue) ? freeValue : freeValue || "#000000"}
          onCommit={commit}
          label={t(row.labelKey)}
          hideHexInput={isSimple}
        />
      );

    case "chipsText": {
      const presets = (row.presets ?? []).map((p) => ({ label: t(p.labelKey), value: p.value }));
      return (
        <ChipsTextField value={freeValue} presets={presets} placeholder={field?.placeholder} onCommit={commit} />
      );
    }

    case "text":
    default:
      return <CommittableInput value={freeValue} placeholder={field?.placeholder} onCommit={commit} />;
  }
}

/** Variante de `renderRowControl` para las 2 mitades de un `pair` (mismo catálogo, sin `row.control` propio por mitad — ambas comparten el control del `row` padre). */
function renderLeafControl(field: StyleFieldDef | undefined, args: PropertyFieldRenderArgs): React.ReactNode {
  const { freeValue, commit } = args;
  if (field?.control === "select") {
    return (
      <PbxSelect
        value={freeValue}
        onChange={commit}
        options={field.options ?? []}
      />
    );
  }
  return (
    <CommittableInput value={freeValue} placeholder={field?.placeholder} onCommit={commit} />
  );
}
