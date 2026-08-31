/**
 * LocaleQuickAccess — acceso rápido al idioma de CONTENIDO (docs/12 §B, Fase
 * 19.g). Atajo por-campo para cambiar el `editingLocale` global sin ir al
 * selector central del panel de configuración.
 *
 * UX (19.g): un SOLO click sobre el botón (icono `Globe` + código) abre
 * directamente un dropdown sobrio (c42 `Dropdown`, P10) con las opciones de
 * idioma; elegir una fija el `editingLocale` y cierra el menú. Antes había un
 * paso extra (botón → `<select>` nativo → abrir → elegir); ahora es 1 click +
 * 1 elección.
 *
 * Se auto-oculta si el sitio no es multilingüe. El estado activo (locale ≠
 * default) reutiliza la capa de acento.
 */

import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { Dropdown, Globe, Check } from "@/components";

export function LocaleQuickAccess() {
  const { t } = useTranslation("inspector");
  const editingLocale = useDocumentStore((s) => s.editingLocale);
  const setEditingLocale = useDocumentStore((s) => s.setEditingLocale);
  const defaultLang = useDocumentStore((s) => s.site.meta.defaultLang);
  const i18n = useDocumentStore((s) => s.site.meta.i18n);

  if (!i18n || i18n.locales.length <= 1) return null;

  const active = editingLocale !== defaultLang;

  return (
    <Dropdown placement="bottom-end" className="pbx-locale-quick-wrap">
      <button
        type="button"
        data-c42-dropdown-trigger
        className={`pbx-locale-quick${active ? " pbx-locale-quick--active" : ""}`}
        title={t("translation.quickLocale", { locale: editingLocale })}
        aria-label={t("translation.quickLocale", { locale: editingLocale })}
      >
        <Globe size={13} aria-hidden="true" />
        <span className="pbx-locale-quick__code">{editingLocale.toUpperCase()}</span>
      </button>

      <div
        data-c42-dropdown-menu
        className="pbx-locale-quick__menu"
        aria-label={t("translation.quickLocaleSelect")}
      >
        {i18n.locales.map((locale) => {
          const isActive = locale === editingLocale;
          const isDefault = locale === i18n.defaultLocale;
          return (
            <button
              key={locale}
              type="button"
              data-c42-dropdown-item
              className={"pbx-locale-quick__opt" + (isActive ? " pbx-locale-quick__opt--active" : "")}
              aria-current={isActive || undefined}
              aria-label={locale.toUpperCase()}
              onClick={() => setEditingLocale(locale)}
            >
              <span className="pbx-locale-quick__opt-code">{locale.toUpperCase()}</span>
              {isDefault ? (
                <span className="pbx-locale-quick__opt-tag">
                  {t("translation.defaultTag", { defaultValue: "default" })}
                </span>
              ) : null}
              {isActive ? (
                <Check size={13} aria-hidden="true" className="pbx-locale-quick__opt-check" />
              ) : null}
            </button>
          );
        })}
      </div>
    </Dropdown>
  );
}
