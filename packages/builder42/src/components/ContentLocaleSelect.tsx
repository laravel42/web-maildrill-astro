/**
 * ContentLocaleSelect — selector del idioma de CONTENIDO activo (docs/12 §B.6).
 *
 * Análogo al selector de viewport: define qué CAPA de contenido edita el
 * Inspector (`editingLocale` en el store), no el idioma de la UI del editor
 * (eso es `LanguageSelect`, dimensión A). Solo se renderiza si el sitio tiene
 * `meta.i18n` configurado con más de un locale — un sitio monolingüe no lo
 * necesita.
 *
 * Usa el controlador `Select` de c42-react, mismo patrón que `LanguageSelect`
 * (P10).
 */

import { useTranslation } from "react-i18next";
import { Select } from "@josecortez1/c42-react";
import { Globe, ChevronDown } from "./Icon";
import { useDocumentStore } from "@/builder/store/documentStore";

/** Labels legibles para los idiomas de contenido más comunes; cae al código. */
const LOCALE_LABELS: Record<string, string> = {
  es: "Español",
  en: "English",
  it: "Italiano",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
};

function labelFor(locale: string): string {
  return LOCALE_LABELS[locale] ?? locale.toUpperCase();
}

export function ContentLocaleSelect() {
  const { t } = useTranslation("header");
  const i18nConfig = useDocumentStore((s) => s.site.meta.i18n);
  const editingLocale = useDocumentStore((s) => s.editingLocale);
  const setEditingLocale = useDocumentStore((s) => s.setEditingLocale);

  // Sitio monolingüe (sin i18n o con un solo locale): nada que elegir.
  if (!i18nConfig || i18nConfig.locales.length <= 1) return null;

  const handleChange = (detail: { value: string }) => setEditingLocale(detail.value);

  return (
    <Select defaultValue={editingLocale} onChange={handleChange} className="pbx-content-locale">
      <button
        data-c42-select-trigger
        className="pbx-content-locale__trigger"
        aria-label={t("contentLocale.ariaLabel")}
        title={t("contentLocale.label")}
      >
        <Globe size={13} aria-hidden="true" />
        <span data-c42-select-value>{labelFor(editingLocale)}</span>
        <ChevronDown size={13} className="pbx-content-locale__caret" aria-hidden="true" />
      </button>
      <div data-c42-select-listbox className="pbx-content-locale__listbox">
        {i18nConfig.locales.map((locale) => (
          <div
            key={locale}
            data-c42-select-option
            data-value={locale}
            className="pbx-content-locale__option"
          >
            {labelFor(locale)}
            {locale === i18nConfig.defaultLocale ? " ★" : ""}
          </div>
        ))}
      </div>
    </Select>
  );
}
