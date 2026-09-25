/**
 * PageBreadcrumb — breadcrumb central del Header con la ruta de la página
 * activa como texto plano `locale/slug` (p. ej. `es/about`). Cada segmento es
 * un texto clicable que abre un popover:
 *
 * - Segmento de idioma (solo si el sitio es multilingüe, `site.meta.i18n` con
 *   >1 locale): el código del `editingLocale`; el popover lista los locales del
 *   sitio y lo cambia (`setEditingLocale`). Es el idioma de CONTENIDO.
 * - Segmento de página: el slug de la página activa; el popover lista todas las
 *   páginas y salta a la elegida (`setActivePage`).
 *
 * Chrome del editor (P8/P10): usa el controlador `Select` de c42 vía
 * `@/components` estilizado como texto plano. El `key` en cada `Select` fuerza
 * el remount cuando el valor cambia por fuera (p. ej. desde el `PageManager`),
 * ya que el `Select` de c42 es no controlado (usa `defaultValue`).
 */

import { useTranslation } from "react-i18next";
import { Select } from "@/components";
import { useDocumentStore } from "@/builder/store/documentStore";
import type { BuilderPage } from "@/builder/model/types";
import { dataTourAttr, BUILDER42_TOUR_ANCHORS } from "@/app/tour/tourAnchors";

/** Etiqueta de página: el slug, o el título si es la home (slug vacío). */
function pageLabel(page: BuilderPage): string {
  return page.meta.slug || page.meta.title;
}

export function PageBreadcrumb() {
  const { t } = useTranslation("header");

  const pageOrder = useDocumentStore((s) => s.site.pageOrder);
  const pages = useDocumentStore((s) => s.site.pages);
  const activePageId = useDocumentStore((s) => s.activePageId);
  const setActivePage = useDocumentStore((s) => s.setActivePage);

  const i18nConfig = useDocumentStore((s) => s.site.meta.i18n);
  const editingLocale = useDocumentStore((s) => s.editingLocale);
  const setEditingLocale = useDocumentStore((s) => s.setEditingLocale);

  const activePage = pages[activePageId];
  const activeLabel = activePage ? pageLabel(activePage) : "";

  // Solo mostramos el segmento de idioma cuando hay algo que elegir. El narrow
  // sobre `localeConfig` (no sobre un booleano derivado) mantiene el tipo.
  const localeConfig = i18nConfig && i18nConfig.locales.length > 1 ? i18nConfig : null;

  return (
    <nav
      className="pbx-breadcrumb"
      aria-label={t("breadcrumb.label")}
      {...dataTourAttr(BUILDER42_TOUR_ANCHORS.pagesBreadcrumb)}
    >
      {localeConfig && (
        <span className="pbx-breadcrumb__locale">
          <Select
            key={editingLocale}
            defaultValue={editingLocale}
            onChange={(detail) => setEditingLocale(detail.value)}
            className="pbx-breadcrumb__segment"
          >
            <button
              data-c42-select-trigger
              className="pbx-breadcrumb__link"
              title={t("contentLocale.label")}
              aria-label={t("contentLocale.ariaLabel")}
            >
              <span data-c42-select-value>{editingLocale}</span>
            </button>
            <div data-c42-select-listbox className="pbx-breadcrumb__listbox">
              {localeConfig.locales.map((locale) => (
                <div
                  key={locale}
                  data-c42-select-option
                  data-value={locale}
                  className="pbx-breadcrumb__option"
                >
                  {locale}
                </div>
              ))}
            </div>
          </Select>
          <span className="pbx-breadcrumb__sep" aria-hidden="true">/</span>
        </span>
      )}

      <Select
        key={activePageId}
        defaultValue={activePageId}
        onChange={(detail) => setActivePage(detail.value)}
        className="pbx-breadcrumb__segment"
      >
        <button
          data-c42-select-trigger
          className="pbx-breadcrumb__link"
          title={t("breadcrumb.pageLabel")}
          aria-label={t("breadcrumb.pageLabel")}
        >
          <span data-c42-select-value>{activeLabel}</span>
        </button>
        <div data-c42-select-listbox className="pbx-breadcrumb__listbox">
          {pageOrder.map((id) => {
            const page = pages[id];
            if (!page) return null;
            return (
              <div
                key={id}
                data-c42-select-option
                data-value={id}
                className="pbx-breadcrumb__option"
              >
                {pageLabel(page)}
              </div>
            );
          })}
        </div>
      </Select>
    </nav>
  );
}
