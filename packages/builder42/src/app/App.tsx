/**
 * App — layout de 4 paneles (PLAN §6): Header arriba; Sidebar / Canvas /
 * Inspector debajo. Cada panel es una proyección del store (P1).
 */

import { useEffect, useState } from "react";
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
import { fetchHealth } from "@/services/apiClient";
import i18n from "@/i18n";
import { useBuilder42Tour } from "./tour/useBuilder42Tour";

export function App() {
  useUndoRedoShortcuts();
  const isPreview = useDocumentStore((s) => s.view === "preview");
  const [sidebarMode] = useLocalConfig("sidebarMode");
  const [inspectorCollapsed] = useLocalConfig("inspectorCollapsed");
  const [experienceLevelChosen] = useLocalConfig("experienceLevelChosen");
  const [experienceLevel] = useLocalConfig("experienceLevel");

  // Standalone (docs/36 F3): the publish adapter is the real dev server, so
  // this checks the same `fetchHealth().publish.enabled` PublishPanel/
  // EditorPreferences already query, gating the `pbx.publish` tour step
  // exactly like it gates the panel itself (§3.2 precondition).
  const [publishAvailable, setPublishAvailable] = useState(false);
  useEffect(() => {
    fetchHealth()
      .then((h) => setPublishAvailable(h.publish.enabled))
      .catch(() => setPublishAvailable(false));
  }, []);

  useBuilder42Tour({
    config: { experienceLevel, publishAvailable, standaloneChrome: true },
    onboardingResolved: experienceLevelChosen,
    i18nInstance: i18n,
  });

  const bodyClasses = ["pbx-body"];
  if (isPreview) bodyClasses.push("pbx-body--preview");
  if (sidebarMode === "compact") bodyClasses.push("pbx-body--sidebar-compact");
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
            permanece (cambio de vista/viewport). Las pestañas de
            colapsar/expandir (`PanelHandle`) viven DENTRO de `Sidebar`/
            `Inspector` (ancladas a su propio borde) — homologan el patrón de
            email-builder/wa-template-studio y se ocultan junto con su panel. */}
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
