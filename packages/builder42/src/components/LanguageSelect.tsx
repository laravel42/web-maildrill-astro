/**
 * LanguageSelect — selector de idioma del editor (docs/12 §A).
 *
 * Control segmentado (mismo patrón que `ThemeToggle` / `ExperienceLevelToggle`).
 * Persiste la elección en localStorage y dispara `i18n.changeLanguage`.
 * Chrome del editor (P8).
 */

import { useTranslation } from "react-i18next";
import { writeConfig } from "@/hooks/useLocalConfig";
import { SUPPORTED_LANGS, type EditorLang } from "@/i18n";

const LANG_LABELS: Record<EditorLang, string> = {
  es: "Español",
  en: "English",
  it: "Italiano",
};

function resolvedLang(lng: string | undefined): EditorLang {
  const base = (lng ?? "en").slice(0, 2) as EditorLang;
  return SUPPORTED_LANGS.includes(base) ? base : "en";
}

export function LanguageSelect() {
  const { t, i18n } = useTranslation("header");
  const current = resolvedLang(i18n.resolvedLanguage ?? i18n.language);

  const handleChange = (lang: EditorLang) => {
    void i18n.changeLanguage(lang);
    writeConfig("editorLang", lang);
  };

  return (
    <div className="pbx-theme-toggle" role="group" aria-label={t("language.label")}>
      {SUPPORTED_LANGS.map((lang) => (
        <button
          key={lang}
          type="button"
          className={
            "pbx-theme-toggle__btn" +
            (current === lang ? " pbx-theme-toggle__btn--active" : "")
          }
          aria-pressed={current === lang}
          title={LANG_LABELS[lang]}
          onClick={() => handleChange(lang)}
        >
          <span className="pbx-theme-toggle__label">{LANG_LABELS[lang]}</span>
        </button>
      ))}
    </div>
  );
}
