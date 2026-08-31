/**
 * OnboardingExperienceModal — modal que se muestra UNA sola vez, al primer
 * inicio de la aplicación en este navegador, en DOS pasos:
 *   1. Idioma del editor (`editorLang`, dimensión A — ver docs/12 §A y
 *      AGENTS.md §5.4). Se pregunta primero porque, si el navegador quedó en
 *      un idioma que el usuario no entiende, la pregunta del paso 2 (nivel
 *      de experiencia) sería ilegible para él/ella — feedback de usuario.
 *      Las etiquetas de este paso usan el nombre NATIVO de cada idioma
 *      ("Español"/"English"/"Italiano"), nunca traducidas, para que sean
 *      reconocibles sin importar el idioma actual de `i18next`.
 *   2. Nivel de experiencia de la UI (`experienceLevel`, ver
 *      `useLocalConfig.ts`): simple o avanzado. Ya se muestra en el idioma
 *      elegido en el paso 1 (`i18n.changeLanguage` dispara el re-render
 *      traducido vía `useTranslation`).
 *
 * Ambas respuestas se persisten en localStorage (`editorLang`,
 * `experienceLevel` + `experienceLevelChosen`) y se pueden cambiar después
 * desde `ProfileMenu` (`LanguageSelect`, `ExperienceLevelToggle`).
 *
 * Bandera `experienceLevel` NUEVA e independiente del `uiComplexity`
 * derogado en docs/41 (D1) — no reintroduce ninguna de sus condicionales.
 * El alcance concreto de qué secciones de la UI cambian con cada valor se
 * define incrementalmente.
 *
 * `SimpleModal` en vez de `Modal` de c42 (mismo motivo documentado en
 * `src/components/SimpleModal.tsx`): este modal aparece como resultado de un
 * efecto que corre DESPUÉS del montaje inicial de `App` (no en el primer
 * render), exactamente el patrón que rompe al controller imperativo de c42
 * bajo `React.StrictMode`.
 *
 * Ninguno de los 2 pasos tiene botón de cierre/overlay-dismiss: es un
 * flujo obligatorio de primer uso (todas las opciones son válidas, así que
 * no hay "cancelar"). Cerrar con Escape en el paso 1 mantiene el idioma
 * actual y avanza al paso 2; en el paso 2 defaultea a "advanced" y completa
 * el onboarding — mismo criterio que antes de agregar el paso de idioma.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SimpleModal, Sparkles, SlidersHorizontal, Globe } from "@/components";
import { useLocalConfig, type ConfigMap } from "@/hooks/useLocalConfig";
import { writeConfig } from "@/hooks/useLocalConfig";
import { SUPPORTED_LANGS, type EditorLang } from "@/i18n";

type ExperienceLevel = ConfigMap["experienceLevel"];

const LANG_LABELS: Record<EditorLang, string> = {
  es: "Español",
  en: "English",
  it: "Italiano",
};

export function OnboardingExperienceModal() {
  const { t, i18n } = useTranslation("header");
  const [, setExperienceLevel] = useLocalConfig("experienceLevel");
  const [, setChosen] = useLocalConfig("experienceLevelChosen");
  const [step, setStep] = useState<"lang" | "experience">("lang");

  const chooseLang = (lang: EditorLang) => {
    void i18n.changeLanguage(lang);
    writeConfig("editorLang", lang);
    setStep("experience");
  };

  const chooseExperience = (level: ExperienceLevel) => {
    setExperienceLevel(level);
    setChosen(true);
  };

  const handleClose = () => {
    // Escape en cualquiera de los 2 pasos completa el onboarding con el
    // valor por defecto — mismo criterio que antes de agregar el paso 1.
    if (step === "lang") {
      setStep("experience");
      return;
    }
    chooseExperience("advanced");
  };

  return (
    <SimpleModal className="pbx-modal" onClose={handleClose}>
      <div data-c42-modal-overlay className="pbx-modal__overlay" />
      {step === "lang" ? (
        <div
          data-c42-modal-content
          className="pbx-modal__content pbx-onboarding-modal"
          aria-label="Choose your language"
        >
          <div className="pbx-modal__header">
            <h3 className="pbx-modal__title">Choose your language</h3>
          </div>

          <div className="pbx-modal__body">
            <p className="pbx-onboarding-modal__subtitle">Elige tu idioma · Scegli la tua lingua</p>

            <div className="pbx-onboarding-modal__options">
              {SUPPORTED_LANGS.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className="pbx-onboarding-modal__option pbx-onboarding-modal__option--compact"
                  onClick={() => chooseLang(lang)}
                >
                  <Globe size={22} aria-hidden="true" />
                  <span className="pbx-onboarding-modal__option-title">{LANG_LABELS[lang]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div
          data-c42-modal-content
          className="pbx-modal__content pbx-onboarding-modal"
          aria-label={t("onboarding.title")}
        >
          <div className="pbx-modal__header">
            <h3 className="pbx-modal__title">{t("onboarding.title")}</h3>
          </div>

          <div className="pbx-modal__body">
            <p className="pbx-onboarding-modal__subtitle">{t("onboarding.subtitle")}</p>

            <div className="pbx-onboarding-modal__options">
              <button
                type="button"
                className="pbx-onboarding-modal__option"
                onClick={() => chooseExperience("simple")}
              >
                <Sparkles size={22} aria-hidden="true" />
                <span className="pbx-onboarding-modal__option-title">{t("onboarding.simpleTitle")}</span>
                <span className="pbx-onboarding-modal__option-desc">{t("onboarding.simpleDesc")}</span>
              </button>

              <button
                type="button"
                className="pbx-onboarding-modal__option"
                onClick={() => chooseExperience("advanced")}
              >
                <SlidersHorizontal size={22} aria-hidden="true" />
                <span className="pbx-onboarding-modal__option-title">{t("onboarding.advancedTitle")}</span>
                <span className="pbx-onboarding-modal__option-desc">{t("onboarding.advancedDesc")}</span>
              </button>
            </div>

            <p className="pbx-onboarding-modal__hint">{t("onboarding.changeHint")}</p>
          </div>
        </div>
      )}
    </SimpleModal>
  );
}
