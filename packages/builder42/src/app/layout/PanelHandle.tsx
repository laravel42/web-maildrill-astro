/**
 * PanelHandle — pestaña vertical anclada al borde del canvas que
 * colapsa/expande Sidebar o Inspector. Homologa el patrón de los otros
 * builders del monorepo (email-builder `InspectorHandle`/
 * `ComponentsLibraryHandle`; wa-template-studio `InspectorPanelHandle`/
 * `LibraryPanelHandle`): una sola pestaña, siempre visible (abierto o
 * colapsado), en vez de los botones fijos del header (`PanelToggleButtons`,
 * retirado) + el `×` interno del Inspector (`InspectorForm`, retirado).
 *
 * `side="left"` para el Sidebar (pestaña pegada a su borde derecho);
 * `side="right"` para el Inspector (pestaña pegada a su borde izquierdo).
 */

import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight } from "@/components";

export function PanelHandle({
  side,
  collapsed,
  onToggle,
}: {
  side: "left" | "right";
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation("header");
  const label = side === "left" ? t("panels.toggleSidebar") : t("panels.toggleInspector");

  // Cuando el panel está abierto, la flecha apunta hacia SU propio borde
  // (colapsar); cuando está colapsado, apunta hacia el canvas (expandir) —
  // misma semántica de affordance que `PanelLeft`/`PanelRight` antes.
  const ChevronIcon =
    side === "left"
      ? collapsed
        ? ChevronRight
        : ChevronLeft
      : collapsed
        ? ChevronLeft
        : ChevronRight;

  return (
    <button
      type="button"
      className={
        `pbx-panel-handle pbx-panel-handle--${side}` +
        (collapsed ? " pbx-panel-handle--collapsed" : "")
      }
      title={label}
      aria-label={label}
      aria-pressed={!collapsed}
      onClick={onToggle}
    >
      <ChevronIcon size={14} aria-hidden="true" />
    </button>
  );
}
