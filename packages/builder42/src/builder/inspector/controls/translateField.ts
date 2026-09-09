import type { TFunction } from "i18next";
import type { FieldSchema } from "@/builder/registry/types";
import { resolveOptions } from "@/builder/registry/types";

/** i18next-safe option key (`"left top"` → `"left_top"`). */
export function optionKey(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "empty";
}

const PROP_GROUP_SLUGS: Record<string, string> = {
  Contenido: "content",
  Acción: "action",
  Estado: "state",
  Formulario: "form",
  Validación: "validation",
  Accesibilidad: "accessibility",
  Apariencia: "appearance",
  Grid: "grid",
  Orientación: "orientation",
};

export function propGroupSlug(groupName: string): string {
  return PROP_GROUP_SLUGS[groupName] ?? groupName.toLowerCase();
}

function mapOptions(
  t: TFunction,
  prefix: string,
  options: FieldSchema["options"],
): FieldSchema["options"] {
  if (!options) return options;
  return () =>
    resolveOptions(options).map((o) => ({
      ...o,
      label: t(`${prefix}.${optionKey(o.value)}`, { defaultValue: o.label }),
    }));
}

/**
 * Clone a prop field with inspector labels/placeholders/options routed through
 * `common.props.<type>.<key>` (docs/landing-pages-builder-plan.md I1).
 */
export function translatePropField(
  t: TFunction,
  type: string,
  field: FieldSchema,
): FieldSchema {
  const prefix = `props.${type}.${field.key}`;
  return {
    ...field,
    label: t(prefix, { defaultValue: field.label }),
    placeholder: field.placeholder
      ? t(`${prefix}Placeholder`, { defaultValue: field.placeholder })
      : field.placeholder,
    options: mapOptions(t, `${prefix}Options`, field.options),
    labelOptions: mapOptions(t, `${prefix}LabelOptions`, field.labelOptions),
  };
}
