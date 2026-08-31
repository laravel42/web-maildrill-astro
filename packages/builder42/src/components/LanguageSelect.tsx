/**
 * LanguageSelect — selector de idioma del editor usando c42 Select (docs/12 §A).
 *
 * Usa el controlador `Select` de c42-react con markup estilizado que hace match
 * con el chrome del proyecto. Persiste la elección en localStorage y dispara
 * `i18n.changeLanguage`. Es chrome del editor (P8).
 */

import { useTranslation } from "react-i18next";
import { Select } from "@josecortez1/c42-react";
import { ChevronDown } from "./Icon";
import { writeConfig } from "@/hooks/useLocalConfig";
import { SUPPORTED_LANGS, type EditorLang } from "@/i18n";

const LANG_LABELS: Record<EditorLang, string> = {
  es: "Español",
  en: "English",
  it: "Italiano",
};

export function LanguageSelect() {
  const { t, i18n } = useTranslation("header");
  const current = i18n.language as EditorLang;

  const handleChange = (detail: { value: string }) => {
    const lang = detail.value as EditorLang;
    void i18n.changeLanguage(lang);
    writeConfig("editorLang", lang);
  };

  return (
    <Select
      defaultValue={current}
      onChange={handleChange}
      className="pbx-lang"
    >
      <button
        data-c42-select-trigger
        className="pbx-lang__trigger"
        aria-label={t("language.label")}
      >
        <span data-c42-select-value>{LANG_LABELS[current]}</span>
        <ChevronDown size={13} className="pbx-lang__caret" aria-hidden="true" />
      </button>
      <div data-c42-select-listbox className="pbx-lang__listbox">
        {SUPPORTED_LANGS.map((lang) => (
          <div
            key={lang}
            data-c42-select-option
            data-value={lang}
            className="pbx-lang__option"
          >
            {LANG_LABELS[lang]}
          </div>
        ))}
      </div>
    </Select>
  );
}
