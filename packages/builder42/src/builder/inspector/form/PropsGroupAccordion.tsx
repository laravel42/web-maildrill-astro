import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight } from "@/components";
import type { BuilderNode } from "@/builder/model/types";
import type { FieldSchema } from "@/builder/registry/types";
import { PropField } from "../controls/PropField";
import { GENERAL_PROP_GROUP } from "./constants";
import { PropGroupIcon } from "./GroupIcons";

/**
 * Acordeón de un grupo de props. Mismo patrón visual que StyleGroupAccordion
 * (reusa las clases `pbx-style-group*`), abierto por defecto.
 */
export function PropsGroupAccordion({
  node,
  groupName,
  fields,
}: {
  node: BuilderNode;
  groupName: string;
  fields: FieldSchema[];
}) {
  const { t } = useTranslation("inspector");
  const [open, setOpen] = useState(true);

  const label =
    groupName === GENERAL_PROP_GROUP ? t("form.propsGeneral") : groupName;

  return (
    <div className={`pbx-style-group${open ? " pbx-style-group--open" : " pbx-style-group--collapsed"}`}>
      <button
        type="button"
        className="pbx-style-group__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`pbx-props-group-body-${groupName}`}
      >
        <span className="pbx-style-group__icon">
          <PropGroupIcon />
        </span>
        <span className="pbx-style-group__name">{label}</span>
        <span className="pbx-style-group__count" title={`${fields.length} campo(s)`}>
          {fields.length}
        </span>
        <span className="pbx-style-group__chevron" aria-hidden="true">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {open && (
        <div className="pbx-style-group__body" id={`pbx-props-group-body-${groupName}`}>
          {fields
            .filter((f) => !f.visibleWhen || f.visibleWhen(node))
            .map((field) => (
              <PropField key={field.key} node={node} field={field} />
            ))}
        </div>
      )}
    </div>
  );
}
