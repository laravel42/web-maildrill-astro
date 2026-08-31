import type { ReactElement } from "react";
import { Toggle } from "@/components";
import type { ControlType } from "@/builder/registry/types";
import { resolveOptions } from "@/builder/registry/types";
import { CommittableInput } from "../CommittableInput";
import { ImageSourceField } from "../ImageSourceField";
import { LinkField } from "../LinkField";
import { NumericUnitInput } from "../NumericUnitInput";
import { OptionsListControl, type SelectOption } from "../OptionsListControl";
import { PageVisibilityListControl } from "../PageVisibilityListControl";
import { SearchableSelectControl } from "../SearchableSelectControl";
import type { PropControlContext } from "./types";

function OptionsListRenderer({ node, field, raw }: PropControlContext) {
  return (
    <OptionsListControl
      nodeId={node.id}
      fieldKey={field.key}
      options={Array.isArray(raw) ? (raw as SelectOption[]) : []}
      labelOptions={resolveOptions(field.labelOptions)}
      renderLabelPreview={field.renderLabelPreview}
    />
  );
}

function PageVisibilityListRenderer({ node, field, raw }: PropControlContext) {
  return (
    <PageVisibilityListControl
      nodeId={node.id}
      fieldKey={field.key}
      hiddenPageIds={Array.isArray(raw) ? (raw as string[]) : []}
    />
  );
}

function ImageSourceRenderer({ node, field }: PropControlContext) {
  return <ImageSourceField node={node} fieldKey={field.key} />;
}

function LinkRenderer({ node, field }: PropControlContext) {
  return <LinkField node={node} fieldKey={field.key} />;
}

function ToggleRenderer({ node, field, raw, setProp }: PropControlContext) {
  return (
    <Toggle
      checked={raw === true || raw === "true"}
      onChange={(c) => setProp(node.id, field.key, c)}
      label={field.label}
    />
  );
}

function SelectRenderer({ field, value, commit }: PropControlContext) {
  const options = resolveOptions(field.options);
  return (
    <select
      className="pbx-control__input pbx-control__input--select"
      value={value}
      onChange={(e) => commit(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function SearchableSelectRenderer({ field, value, commit }: PropControlContext) {
  return (
    <SearchableSelectControl
      value={value}
      options={resolveOptions(field.options)}
      placeholder={field.placeholder}
      onCommit={commit}
      renderPreview={field.renderOptionPreview}
    />
  );
}

function RichtextRenderer({ t }: PropControlContext) {
  return <p className="pbx-control__hint">{t("richtextField.editInline")}</p>;
}

function TextInputRenderer({ field, value, commit }: PropControlContext) {
  return (
    <CommittableInput
      value={value}
      type={field.control === "url" ? "url" : "text"}
      placeholder={field.placeholder}
      onCommit={commit}
    />
  );
}

function NumericRenderer({ field, value, commit }: PropControlContext) {
  return (
    <NumericUnitInput
      value={value}
      units={field.units ?? []}
      defaultUnit={field.defaultUnit}
      step={field.step}
      placeholder={field.placeholder}
      onCommit={commit}
    />
  );
}

/**
 * Mapa declarativo ControlType → renderer (P4). Agregar un control nuevo =
 * registrar aquí; PropField no necesita otro `switch`.
 */
export const PROP_CONTROL_RENDERERS: Partial<
  Record<ControlType, (ctx: PropControlContext) => ReactElement>
> = {
  "options-list": OptionsListRenderer,
  "page-visibility-list": PageVisibilityListRenderer,
  "image-src": ImageSourceRenderer,
  link: LinkRenderer,
  toggle: ToggleRenderer,
  select: SelectRenderer,
  "searchable-select": SearchableSelectRenderer,
  richtext: RichtextRenderer,
  numeric: NumericRenderer,
};

/**
 * Controles puramente INFORMATIVOS: no aceptan ningún input del usuario, solo
 * pintan un hint (ej. `RichtextRenderer` — el contenido real de `text` se
 * edita en el canvas vía Tiptap, docs/12 §B.11). Tabla declarativa a
 * propósito (P4, mismo patrón que `PROP_CONTROL_RENDERERS` arriba): vive aquí
 * porque este es el único lugar del código que conoce qué hace cada
 * `ControlType` en la práctica — `InspectorForm.tsx`/`PropsSection.tsx` no
 * deben inspeccionar `field.control` por su cuenta (evita un
 * `if (field.control === "richtext")` disperso, ya que `FieldSchema.control`
 * es un string libre). Agregar un control nuevo que sea igualmente
 * informativo (sin input real) = agregar su nombre aquí.
 */
const NON_EDITABLE_CONTROLS: ReadonlySet<ControlType> = new Set(["richtext"]);

/** Un field es "editable" si su control acepta algún input real del usuario. */
export function fieldIsEditable(field: { control: ControlType }): boolean {
  return !NON_EDITABLE_CONTROLS.has(field.control);
}

/** Al menos un field de la lista es editable (ver `fieldIsEditable`). */
export function hasEditableFields(fields: readonly { control: ControlType }[]): boolean {
  return fields.some(fieldIsEditable);
}

/** Cuenta solo los fields editables — es lo que informa el badge de la tab "Props". */
export function countEditableFields(fields: readonly { control: ControlType }[]): number {
  return fields.filter(fieldIsEditable).length;
}

/** Fallback para `text`, `number`, `url` y cualquier control sin renderer dedicado. */
export function renderDefaultPropControl(ctx: PropControlContext): ReactElement {
  return TextInputRenderer(ctx);
}

export function renderPropControl(ctx: PropControlContext): ReactElement {
  const renderer = PROP_CONTROL_RENDERERS[ctx.field.control];
  return renderer ? renderer(ctx) : renderDefaultPropControl(ctx);
}

/** Layout row para toggles y selects; stacked para el resto. */
export function propControlUsesRowLayout(control: ControlType): boolean {
  return control === "toggle" || control === "select" || control === "searchable-select" || control === "numeric";
}
