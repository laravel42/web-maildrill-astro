/**
 * I18nSettings — activación y gestión de idiomas del sitio (docs/12 §B.4,
 * panel de configuración). Por defecto el sitio es monolingüe; un toggle
 * activa `site.meta.i18n` y expone el CRUD de locales habilitados + el idioma
 * por defecto. El idioma de contenido activo (`editingLocale`, para editar
 * los campos traducibles) vive en `ContentLocaleSelect`.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { IconButton, ContentLocaleSelect, LocaleCombobox, Toggle, CloseIcon } from "@/components";
import { TranslationModal } from "./TranslationModal";
import { isKnownLocaleCode } from "./localeCatalog";

export function I18nSettings() {
  const { t, i18n: i18next } = useTranslation("inspector");
  const i18n = useDocumentStore((s) => s.site.meta.i18n);
  const enableSiteI18n = useDocumentStore((s) => s.enableSiteI18n);
  const disableSiteI18n = useDocumentStore((s) => s.disableSiteI18n);
  const addSiteLocale = useDocumentStore((s) => s.addSiteLocale);
  const removeSiteLocale = useDocumentStore((s) => s.removeSiteLocale);
  const setDefaultLocale = useDocumentStore((s) => s.setDefaultLocale);

  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const handleAdd = (code: string) => {
    const normalized = code.trim().toLowerCase();
    if (!isKnownLocaleCode(normalized)) {
      setError(t("i18nSettings.invalidCode"));
      return;
    }
    addSiteLocale(normalized);
    setDraft("");
    setError(null);
  };

  return (
    <section className="pbx-site-settings__section">
      <h4 className="pbx-inspector__heading">{t("i18nSettings.title")}</h4>

      <div className="pbx-i18n-settings__toggle">
        <Toggle
          checked={!!i18n}
          onChange={(c) => (c ? enableSiteI18n() : disableSiteI18n())}
        >
          {t("i18nSettings.enable")}
        </Toggle>
      </div>

      {i18n ? (
        <>
          <div className="pbx-i18n-settings__editing pbx-i18n-settings__editing--lead">
            <span className="pbx-control__label">{t("i18nSettings.editingLabel")}</span>
            <ContentLocaleSelect />
          </div>

          <p className="pbx-i18n-settings__hint">{t("i18nSettings.hint")}</p>

          <ul className="pbx-i18n-settings__list">
            {i18n.locales.map((locale) => {
              const isDefault = locale === i18n.defaultLocale;
              return (
                <li key={locale} className="pbx-i18n-settings__item">
                  <span className="pbx-i18n-settings__code">{locale}</span>
                  {isDefault ? (
                    <span className="pbx-badge pbx-badge--override">
                      {t("i18nSettings.default")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="pbx-i18n-settings__btn"
                      onClick={() => setDefaultLocale(locale)}
                    >
                      {t("i18nSettings.makeDefault")}
                    </button>
                  )}
                  <IconButton
                    icon={CloseIcon}
                    label={t("i18nSettings.remove")}
                    intent="danger"
                    disabled={isDefault}
                    onClick={() => removeSiteLocale(locale)}
                  />
                </li>
              );
            })}
          </ul>

          <div className="pbx-i18n-settings__add">
            <LocaleCombobox
              value={draft}
              onChange={(code) => {
                setDraft(code);
                setError(null);
                handleAdd(code);
              }}
              displayLocale={i18next.language}
              excludeCodes={i18n.locales}
              ariaLabel={t("i18nSettings.addPlaceholder")}
              placeholder={t("i18nSettings.addPlaceholder")}
              noResultsLabel={t("i18nSettings.comboboxNoResults")}
            />
          </div>
          {error ? (
            <span className="pbx-i18n-settings__error" role="alert">
              {error}
            </span>
          ) : null}

          <button
            type="button"
            className="pbx-i18n-settings__table-btn"
            onClick={() => setShowTable(true)}
          >
            {t("translationTable.open")}
          </button>

          {showTable ? <TranslationModal onClose={() => setShowTable(false)} /> : null}
        </>
      ) : null}
    </section>
  );
}
