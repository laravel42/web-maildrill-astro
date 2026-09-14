/**
 * ProfileMenu — icono de perfil en el header que abre un dropdown (c42) con
 * las preferencias del editor (Fase 11.d, docs/18):
 *   1. Idioma del editor (dimensión A, `LanguageSelect`).
 *   2. Sistema de color (tema de 3 estados, `ThemeToggle`).
 *   3. Controles de reordenamiento por flechas (auto/on/off, docs/24 §2.3,
 *      `ReorderControlsToggle`).
 *   4. Nivel de experiencia (simple/avanzado, `ExperienceLevelToggle`) —
 *      bandera NUEVA e independiente del `uiComplexity` derogado en docs/41
 *      (ver nota de abajo), preguntada una vez en `OnboardingExperienceModal`
 *      al primer inicio y modificable aquí después.
 *
 * docs/41 Paso 8, D1: se eliminó el toggle `uiComplexity` (simple/avanzado)
 * — el comportamiento avanzado pasó a ser el único, sin interruptor. El
 * `experienceLevel` de arriba es un concepto NUEVO y separado: no reintroduce
 * ninguna condicional derogada del Inspector.
 *
 * Chrome del editor (P8/P10): usa el `Dropdown` headless de c42. No confundir
 * el idioma del editor (aquí) con el idioma de CONTENIDO (`ContentLocaleSelect`,
 * en el panel de configuración de sitio del Inspector) — ver AGENTS.md §5.4.
 *
 * `closeOnSelect={false}`: el usuario puede cambiar idioma y tema sin que el
 * panel se cierre entre acciones.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Dropdown, LanguageSelect, Settings, Rocket } from "@/components";
import { ThemeToggle } from "./ThemeToggle";
import { ReorderControlsToggle } from "./ReorderControlsToggle";
import { ExperienceLevelToggle } from "./ExperienceLevelToggle";
import { useDocumentStore } from "@/builder/store/documentStore";
import { useLocalConfig } from "@/hooks/useLocalConfig";
import { useThemeMode } from "@/hooks/useThemeMode";
import { fetchHealth } from "@/services/apiClient";
import { dataTourAttr, BUILDER42_TOUR_ANCHORS } from "@/app/tour/tourAnchors";

function PrefHeading({
  panel,
  children,
}: {
  panel: boolean;
  children: string;
}) {
  if (panel) {
    return <h4 className="pbx-inspector__heading">{children}</h4>;
  }
  return <div className="pbx-profile__section-label">{children}</div>;
}

/** Preferencias del editor — dropdown del header y tab Settings del Inspector. */
export function EditorPreferences({
  showPublishLink = false,
  panel = false,
}: {
  showPublishLink?: boolean;
  panel?: boolean;
}) {
  const { t } = useTranslation("header");
  const openSiteSettings = useDocumentStore((s) => s.openSiteSettings);
  const [, , , themeHostControlled] = useThemeMode();
  const [inspectorCollapsed, setInspectorCollapsed] = useLocalConfig("inspectorCollapsed");
  const [publishEnabled, setPublishEnabled] = useState(false);

  useEffect(() => {
    if (!showPublishLink) return;
    fetchHealth()
      .then((h) => setPublishEnabled(h.publish.enabled))
      .catch(() => setPublishEnabled(false));
  }, [showPublishLink]);

  const handleManagedSitesClick = () => {
    if (inspectorCollapsed) setInspectorCollapsed(false);
    openSiteSettings("publish");
  };

  const divider = panel ? null : <div className="pbx-profile__divider" aria-hidden="true" />;

  return (
    <>
      <div className="pbx-profile__section">
        <PrefHeading panel={panel}>{t("language.label")}</PrefHeading>
        <LanguageSelect />
      </div>
      {!themeHostControlled && (
        <>
          {divider}
          <div className="pbx-profile__section">
            <PrefHeading panel={panel}>{t("theme.label")}</PrefHeading>
            <ThemeToggle />
          </div>
        </>
      )}
      {divider}
      <div className="pbx-profile__section">
        <PrefHeading panel={panel}>{t("reorderControls.label")}</PrefHeading>
        <ReorderControlsToggle />
      </div>
      {divider}
      <div className="pbx-profile__section">
        <PrefHeading panel={panel}>{t("experienceLevel.label")}</PrefHeading>
        <ExperienceLevelToggle />
      </div>
      {showPublishLink && publishEnabled && (
        <>
          {divider}
          <div className="pbx-profile__section">
            <button
              type="button"
              className="pbx-profile__action"
              data-c42-dropdown-item
              onClick={handleManagedSitesClick}
            >
              <Rocket size={15} aria-hidden="true" />
              {t("publish.managedSites")}
            </button>
          </div>
        </>
      )}
    </>
  );
}

export function ProfileMenu() {
  const { t } = useTranslation("header");

  return (
    <Dropdown closeOnSelect={false} placement="bottom-end" className="pbx-profile">
      <button
        type="button"
        data-c42-dropdown-trigger
        className="pbx-profile__trigger"
        title={t("profile.label")}
        aria-label={t("profile.label")}
        {...dataTourAttr(BUILDER42_TOUR_ANCHORS.profileMenu)}
      >
        <Settings size={18} aria-hidden="true" />
      </button>
      <motion.div
        data-c42-dropdown-menu
        className="pbx-profile__menu"
        initial={{ opacity: 0, scale: 0.96, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.14, ease: "easeOut" }}
      >
        <EditorPreferences showPublishLink />
      </motion.div>
    </Dropdown>
  );
}
