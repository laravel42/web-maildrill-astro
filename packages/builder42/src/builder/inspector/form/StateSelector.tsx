import { useTranslation } from "react-i18next";
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
      <select
        id="pbx-state-selector__input"
        className="pbx-control__input pbx-control__input--select"
        value={active ?? "__normal__"}
        onChange={(e) => onChange(e.target.value === "__normal__" ? null : (e.target.value as StyleState))}
        aria-label={t("form.stateEditing")}
      >
        <option value="__normal__">{t("form.stateNormal")}</option>
        {states.map((s) => (
          <option key={s.state} value={s.state}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
