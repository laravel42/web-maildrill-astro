/**
 * PageManager — gestor de páginas CRUD completo (docs/06 §7, panel de
 * configuración de sitio). Lista todas las páginas con preview de su ruta
 * resuelta (`pageRoute`), permite crear/duplicar/borrar/reordenar/marcar home
 * y editar el título/slug inline.
 *
 * Creación de página (T1): los inputs empiezan vacíos. El slug se genera
 * automáticamente desde el nombre (slugify). Solo se crea la página al
 * confirmar (Enter o botón), con validación (nombre no vacío, slug válido,
 * sin duplicados). Cancelar descarta sin crear.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IconButton, ArrowUp, ArrowDown, House, Copy, CloseIcon } from "@/components";
import { useDocumentStore } from "@/builder/store/documentStore";
import { pageRoute } from "@/builder/export/links";
import { normalizeSlug, uniqueSlug } from "@/builder/model/site";
import { CommittableInput } from "./controls/CommittableInput";

export function PageManager() {
  const { t } = useTranslation("inspector");
  const pageOrder = useDocumentStore((s) => s.site.pageOrder);
  const pages = useDocumentStore((s) => s.site.pages);
  const homePageId = useDocumentStore((s) => s.site.homePageId);
  const activePageId = useDocumentStore((s) => s.activePageId);
  const setActivePage = useDocumentStore((s) => s.setActivePage);
  const addPage = useDocumentStore((s) => s.addPage);
  const duplicatePage = useDocumentStore((s) => s.duplicatePage);
  const removePage = useDocumentStore((s) => s.removePage);
  const updatePageMeta = useDocumentStore((s) => s.updatePageMeta);
  const reorderPages = useDocumentStore((s) => s.reorderPages);
  const setHomePage = useDocumentStore((s) => s.setHomePage);
  const themes = useDocumentStore((s) => s.site.meta.themes);
  const setPageTheme = useDocumentStore((s) => s.setPageTheme);
  const site = useDocumentStore((s) => s.site);

  const canRemove = pageOrder.length > 1;

  // --- Estado del formulario de creación (T1) ---
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [error, setError] = useState("");

  /** Valida el formulario de creación. Devuelve string de error o "" si OK. */
  function validate(name: string, slug: string): string {
    if (!name.trim()) {
      return t("pageManager.errorNameEmpty");
    }
    const normalized = normalizeSlug(slug || name);
    if (!normalized) {
      return t("pageManager.errorSlugInvalid");
    }
    // Comprobar duplicados de slug
    const existingSlugs = new Set(
      pageOrder.map((id) => pages[id]?.meta.slug).filter((s) => s !== undefined),
    );
    if (existingSlugs.has(normalized)) {
      return t("pageManager.errorSlugDuplicate");
    }
    return "";
  }

  function handleStartCreating() {
    setCreating(true);
    setNewName("");
    setNewSlug("");
    setError("");
  }

  function handleNameChange(value: string) {
    setNewName(value);
    // Auto-slugify desde el nombre
    setNewSlug(normalizeSlug(value));
    // Limpiar error anterior al escribir
    if (error) setError("");
  }

  function handleConfirmCreate() {
    const validationError = validate(newName, newSlug);
    if (validationError) {
      setError(validationError);
      return;
    }
    const slug = uniqueSlug(site, newSlug || normalizeSlug(newName));
    const id = addPage({ title: newName.trim(), slug });
    setActivePage(id);
    setCreating(false);
    setNewName("");
    setNewSlug("");
    setError("");
  }

  function handleCancelCreate() {
    setCreating(false);
    setNewName("");
    setNewSlug("");
    setError("");
  }

  return (
    <section className="pbx-site-settings__section">
      <h4 className="pbx-inspector__heading">{t("pageManager.title")}</h4>
      <ul className="pbx-page-manager__list">
        {pageOrder.map((id, index) => {
          const page = pages[id];
          if (!page) return null;
          const isHome = id === homePageId;
          const isActive = id === activePageId;
          return (
            <li
              key={id}
              className={
                "pbx-page-manager__item" + (isActive ? " pbx-page-manager__item--active" : "")
              }
            >
              <div className="pbx-page-manager__row">
                <button
                  type="button"
                  className="pbx-page-manager__select"
                  aria-current={isActive}
                  title={t("pageManager.selectPage")}
                  onClick={() => setActivePage(id)}
                >
                  {isHome ? (
                    <span className="pbx-page-manager__home-badge" aria-hidden="true">
                      <House size={12} strokeWidth={2} />
                    </span>
                  ) : null}
                  {page.meta.title || t("pageManager.untitled")}
                </button>
                <div className="pbx-page-manager__actions">
                  <IconButton
                    icon={ArrowUp}
                    label={t("pageManager.moveUp")}
                    disabled={index === 0}
                    onClick={() => reorderPages(index, index - 1)}
                  />
                  <IconButton
                    icon={ArrowDown}
                    label={t("pageManager.moveDown")}
                    disabled={index === pageOrder.length - 1}
                    onClick={() => reorderPages(index, index + 1)}
                  />
                  <IconButton
                    icon={House}
                    label={t("pageManager.setHome")}
                    disabled={isHome}
                    onClick={() => setHomePage(id)}
                  />
                  <IconButton
                    icon={Copy}
                    label={t("pageManager.duplicate")}
                    onClick={() => duplicatePage(id)}
                  />
                  <IconButton
                    icon={CloseIcon}
                    label={t("pageManager.delete")}
                    intent="danger"
                    disabled={!canRemove}
                    onClick={() => removePage(id)}
                  />
                </div>
              </div>

              <div className="pbx-page-manager__meta">
                <CommittableInput
                  value={page.meta.title}
                  placeholder={t("pageManager.titlePlaceholder")}
                  onCommit={(v) => updatePageMeta(id, { title: v })}
                />
                <div className="pbx-page-manager__route">
                  <span className="pbx-page-manager__route-preview">{pageRoute(page.meta.slug)}</span>
                  {!isHome ? (
                    <CommittableInput
                      value={page.meta.slug}
                      placeholder={t("pageManager.slugPlaceholder")}
                      onCommit={(v) => updatePageMeta(id, { slug: v })}
                    />
                  ) : null}
                </div>
                {themes && Object.keys(themes).length > 0 ? (
                  <label className="pbx-page-manager__theme">
                    <span>{t("pageManager.theme")}</span>
                    <select
                      className="pbx-control__input"
                      value={page.meta.themeId ?? ""}
                      onChange={(e) => setPageTheme(id, e.target.value || undefined)}
                    >
                      <option value="">{t("pageManager.themeDefault")}</option>
                      {Object.keys(themes).map((themeId) => (
                        <option key={themeId} value={themeId}>
                          {themes[themeId]!.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {/* --- Formulario de creación (T1) --- */}
      {creating ? (
        <div className="pbx-page-manager__create-form" role="form" aria-label={t("pageManager.newPage")}>
          <input
            className="pbx-control__input"
            type="text"
            placeholder={t("pageManager.namePlaceholder")}
            value={newName}
            autoFocus
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleConfirmCreate();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                handleCancelCreate();
              }
            }}
          />
          <div className="pbx-page-manager__slug-preview">
            <span className="pbx-page-manager__slug-label">{t("pageManager.slugLabel")}:</span>{" "}
            <code>{newSlug ? `/${newSlug}/` : "—"}</code>
          </div>
          {error && (
            <p className="pbx-page-manager__error" role="alert">
              {error}
            </p>
          )}
          <div className="pbx-page-manager__create-actions">
            <button
              type="button"
              className="pbx-page-manager__confirm"
              onClick={handleConfirmCreate}
            >
              {t("pageManager.create")}
            </button>
            <button
              type="button"
              className="pbx-page-manager__cancel"
              onClick={handleCancelCreate}
            >
              {t("pageManager.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="pbx-page-manager__new"
          onClick={handleStartCreating}
        >
          + {t("pageManager.newPage")}
        </button>
      )}
    </section>
  );
}
