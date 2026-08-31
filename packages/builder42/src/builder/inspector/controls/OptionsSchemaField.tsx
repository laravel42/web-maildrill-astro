/**
 * OptionsSchemaField — motor de controles compartido para `optionsSchema`
 * (docs/10 §3, docs/44 §2.2). Renderiza UN campo de un `PropsSchema` con el
 * control adecuado según `field.control` (toggle, select, theme-select,
 * numeric, texto/número), igual que ya hacía `BehaviorsSection` para las
 * opciones de un behavior — extraído aquí para que otras secciones del
 * Inspector que también consumen un `optionsSchema` (p. ej.
 * `NodeClickActionSection`, docs/44 Fase 1) usen el MISMO motor de campos en
 * vez de reimplementarlo (P4 aplicado al propio Inspector: un solo lugar que
 * sabe pintar un `FieldSchema`).
 *
 * Desacoplado de dónde vive el valor: recibe `value` + `onChange`, no conoce
 * `nodeId` ni el store. `BehaviorsSection` sigue teniendo su wrapper propio
 * (`BehaviorOptionField`) que resuelve `value`/`onChange` contra
 * `setBehaviorOption`; el nuevo consumidor resuelve los suyos contra
 * `setNodeAction`.
 */

import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import type { FieldSchema } from "@/builder/registry/types";
import { resolveOptions } from "@/builder/registry/types";
import { Toggle } from "@/components";
import { FieldHelp } from "./FieldHelp";
import { NumericUnitInput } from "./NumericUnitInput";

export function OptionsSchemaField({
  field,
  value,
  onChange,
  label,
}: {
  field: FieldSchema;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Label ya traducido (el llamador decide la clave i18n de su propio namespace/prefijo). */
  label: string;
}) {
  const { t } = useTranslation("inspector");
  const themes = useDocumentStore((s) => s.site.meta.themes);
  const openSiteSettings = useDocumentStore((s) => s.openSiteSettings);

  const isRowLayout =
    field.control === "toggle" ||
    field.control === "select" ||
    field.control === "theme-select" ||
    field.control === "numeric";

  const themeIds = themes ? Object.keys(themes) : [];

  return (
    <div className={`pbx-control${isRowLayout ? " pbx-control--row" : " pbx-control--stacked"}`}>
      <div className="pbx-control__header">
        <span className="pbx-control__label">{label}</span>
        {field.help ? <FieldHelp message={t(field.help)} /> : null}
      </div>
      <div className="pbx-control__body">
        {field.control === "theme-select" ? (
          themeIds.length === 0 ? (
            // Sin temas en el sitio: no hay nada que elegir. En vez de un select
            // vacío, se manda al usuario a crearlos en la sección de Temas; al
            // volver, sus temas aparecerán ya cargados en este select.
            <div className="pbx-behavior-theme-empty">
              <span className="pbx-behavior-theme-empty__msg">{t("behaviors.themeToggle.noThemes")}</span>
              <button
                type="button"
                className="pbx-behavior-theme-empty__btn"
                onClick={() => openSiteSettings("themes")}
              >
                {t("behaviors.themeToggle.configureThemes")}
              </button>
            </div>
          ) : (
            <select
              className="pbx-control__input pbx-control__input--select"
              value={typeof value === "string" ? value : ""}
              onChange={(e) => onChange(e.target.value)}
            >
              <option value="">{t("behaviors.themeToggle.selectPlaceholder")}</option>
              {themeIds.map((id) => (
                <option key={id} value={id}>
                  {themes![id]!.name}
                </option>
              ))}
            </select>
          )
        ) : field.control === "toggle" ? (
          <Toggle checked={value === true} onChange={(c) => onChange(c)} label={label} />
        ) : field.control === "select" ? (
          <select
            className="pbx-control__input pbx-control__input--select"
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value)}
          >
            {resolveOptions(field.options).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : field.control === "numeric" ? (
          <NumericUnitInput
            value={value === undefined || value === null ? "" : String(value)}
            units={field.units ?? []}
            defaultUnit={field.defaultUnit}
            step={field.step}
            placeholder={field.placeholder}
            onCommit={onChange}
          />
        ) : (
          <input
            className="pbx-control__input"
            type={field.control === "number" ? "number" : "text"}
            value={value === undefined || value === null ? "" : String(value)}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.control === "number" ? Number(e.target.value) : e.target.value)}
          />
        )}
      </div>
    </div>
  );
}
