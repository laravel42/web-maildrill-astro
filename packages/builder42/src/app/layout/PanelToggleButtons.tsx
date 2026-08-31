/**
 * PanelToggleButtons — botones de toggle para sidebar e inspector (Fase 11.10).
 * Colapsan/expanden los paneles laterales del editor para adaptarse a viewports
 * angostos. El estado se persiste vía useLocalConfig.
 */

import { useTranslation } from "react-i18next";
import { useLocalConfig } from "@/hooks/useLocalConfig";
import { PanelLeft, PanelRight } from "@/components";

export function PanelToggleButtons() {
  const { t } = useTranslation("header");
  const [sidebarCollapsed, setSidebarCollapsed] = useLocalConfig("sidebarCollapsed");
  const [inspectorCollapsed, setInspectorCollapsed] = useLocalConfig("inspectorCollapsed");

  return (
    <div className="pbx-panel-toggle" role="group" aria-label={t("panels.toggleSidebar")}>
      <button
        type="button"
        className={
          "pbx-panel-toggle__btn" +
          (sidebarCollapsed ? " pbx-panel-toggle__btn--active" : "")
        }
        title={t("panels.toggleSidebar")}
        aria-pressed={sidebarCollapsed}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        <PanelLeft size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={
          "pbx-panel-toggle__btn" +
          (inspectorCollapsed ? " pbx-panel-toggle__btn--active" : "")
        }
        title={t("panels.toggleInspector")}
        aria-pressed={inspectorCollapsed}
        onClick={() => setInspectorCollapsed(!inspectorCollapsed)}
      >
        <PanelRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
