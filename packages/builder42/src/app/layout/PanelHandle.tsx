/**
 * PanelHandle — pestaña vertical anclada al borde del canvas que
 * colapsa/expande Sidebar o Inspector. Homologa el patrón de los otros
 * builders del monorepo (email-builder `InspectorHandle`/
 * `ComponentsLibraryHandle`; wa-template-studio `InspectorPanelHandle`/
 * `LibraryPanelHandle`): una sola pestaña, siempre visible (abierto o
 * colapsado), en vez de los botones fijos del header (`PanelToggleButtons`,
 * retirado) + el `×` interno del Inspector (`InspectorForm`, retirado).
 *
 * Icono + label vertical (`writing-mode: vertical-rl`, ver CSS) — mismo
 * patrón que `.wts-panel-handle-label`/`Library` en wa-template-studio.
 *
 * `side="left"` para el Sidebar (pestaña pegada a su borde derecho, label
 * "Componentes"); `side="right"` para el Inspector (pestaña pegada a su
 * borde izquierdo, label "Inspector").
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
  const { t: tHeader } = useTranslation("header");
  const { t: tSidebar } = useTranslation("sidebar");
  const { t: tInspector } = useTranslation("inspector");
  const label = side === "left" ? tHeader("panels.toggleSidebar") : tHeader("panels.toggleInspector");
  const panelName = side === "left" ? tSidebar("tabs.components") : tInspector("title");

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
      <ChevronIcon size={13} aria-hidden="true" />
      <span className="pbx-panel-handle__label">{panelName}</span>
    </button>
  );
}
