/**
 * App — layout de 4 paneles (PLAN §6): Header arriba; Sidebar / Canvas /
 * Inspector debajo. Cada panel es una proyección del store (P1).
 */

import { MotionConfig } from "framer-motion";
import { Header } from "./layout/Header";
import { Sidebar } from "./layout/Sidebar";
import { Canvas } from "./layout/Canvas";
import { Inspector } from "./layout/Inspector";
import { TokensStyle } from "./layout/TokensStyle";
import { BehaviorsStyle } from "./layout/BehaviorsStyle";
import { ComponentsStyle } from "./layout/ComponentsStyle";
import { OnboardingExperienceModal } from "./layout/OnboardingExperienceModal";
import { useUndoRedoShortcuts } from "@/builder/store/useTemporalStore";
import { useDocumentStore } from "@/builder/store/documentStore";
import { useLocalConfig } from "@/hooks/useLocalConfig";

export function App() {
  useUndoRedoShortcuts();
  const isPreview = useDocumentStore((s) => s.view === "preview");
  const [sidebarCollapsed] = useLocalConfig("sidebarCollapsed");
  const [inspectorCollapsed] = useLocalConfig("inspectorCollapsed");
  const [experienceLevelChosen] = useLocalConfig("experienceLevelChosen");

  const bodyClasses = ["pbx-body"];
  if (isPreview) bodyClasses.push("pbx-body--preview");
  if (sidebarCollapsed) bodyClasses.push("pbx-body--sidebar-collapsed");
  if (inspectorCollapsed) bodyClasses.push("pbx-body--inspector-collapsed");

  return (
    // reducedMotion="user" — todas las animaciones respetan
    // prefers-reduced-motion del SO (Fase 11.e, docs/18).
    <MotionConfig reducedMotion="user">
      <div className="pbx-app">
        <TokensStyle />
        <BehaviorsStyle />
        <ComponentsStyle />
        <Header />
        {/* En Preview (docs/21 §3.5) se ocultan Sidebar e Inspector: la vista
            previa ocupa todo el ancho para emular el navegador. El Header
            permanece (cambio de vista/viewport). */}
        <div className={bodyClasses.join(" ")}>
          {isPreview ? null : <Sidebar />}
          <Canvas />
          {isPreview ? null : <Inspector />}
        </div>
        {experienceLevelChosen ? null : <OnboardingExperienceModal />}
      </div>
    </MotionConfig>
  );
}
