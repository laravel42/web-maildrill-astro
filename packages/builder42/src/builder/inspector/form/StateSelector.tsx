import { useTranslation } from "react-i18next";
import { PbxSelect } from "@/components";
import type { StyleState } from "@/builder/model/types";

/**
 * Selector "Estado: Normal / Seleccionado…" (T9, AGENTS.md). Solo se muestra
 * si el componente declara estados editables (`styleSchema.states`). Cambia
 * qué capa edita `StyleSection` (normal vs. `node.style.states[x]`) — UI-state
 * local (no persiste, no entra a undo/redo): al cambiar de nodo vuelve a
 * "Normal", igual que el breakpoint activo no es parte del documento.
 */
export function StateSelector({
  states,
  active,
  onChange,
}: {
  states: { state: StyleState; label: string }[];
  active: StyleState | null;
  onChange: (state: StyleState | null) => void;
}) {
  const { t } = useTranslation("inspector");
  return (
    <div className="pbx-state-selector">
      <label className="pbx-state-selector__label" htmlFor="pbx-state-selector__input">
        {t("form.stateEditing")}
      </label>
      <PbxSelect
        id="pbx-state-selector__input"
        value={active ?? "__normal__"}
        onChange={(v) => onChange(v === "__normal__" ? null : (v as StyleState))}
        ariaLabel={t("form.stateEditing")}
        options={[
          { value: "__normal__", label: t("form.stateNormal") },
          ...states.map((s) => ({ value: s.state, label: s.label })),
        ]}
      />
    </div>
  );
}
