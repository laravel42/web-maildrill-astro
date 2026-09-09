/**
 * Header — selector de vista (Edit/Preview/Code/JSON) + selector de viewport
 * (PLAN §6, docs/05 §2). Las vistas usan el controlador `Tabs` de c42 (chrome
 * del editor); el viewport usa botones nativos porque su estado vive en el store
 * (fuente de verdad) y c42 0.1.0 no expone un segmented "Choice".
 *
 * El gestor de páginas, Guardar/Cargar y el selector de idioma de contenido
 * viven en `SiteSettingsPanel` (Inspector, sin nodo seleccionado) — panel de
 * configuración de sitio centralizado. El Header solo conserva lo que opera
 * sobre el canvas en todo momento (vista, viewport, undo/redo) + el idioma de
 * la UI del editor.
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Tabs } from "@josecortez1/c42-react";
import { useDocumentStore, type ViewMode } from "@/builder/store/documentStore";
import {
  useCanUndo,
  useCanRedo,
  undo,
  redo,
} from "@/builder/store/useTemporalStore";
import { UndoIcon, RedoIcon, Rocket } from "@/components";
import { fetchHealth } from "@/services/apiClient";
import { LayersPanel } from "./LayersPanel";
import { PageBreadcrumb } from "./PageBreadcrumb";
import { ProfileMenu } from "./ProfileMenu";
import { PanelToggleButtons } from "./PanelToggleButtons";
import { ViewModeDropdown } from "./ViewModeDropdown";
import { ViewportDropdown } from "./ViewportDropdown";
import { PublishModal } from "./PublishModal";

const VIEW_KEYS: ViewMode[] = ["edit", "preview", "code", "json"];

export function Header() {
  const { t } = useTranslation("header");
  const view = useDocumentStore((s) => s.view);
  const setView = useDocumentStore((s) => s.setView);
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  // Third entry point into the publish flow, gated the same as the
  // "publish" tab (`SiteSettingsPanel`) and the profile menu's "Published
  // sites" item — all three must agree on whether the host has it on.
  const [publishEnabled, setPublishEnabled] = useState(false);

  useEffect(() => {
    fetchHealth()
      .then((h) => setPublishEnabled(h.publish.enabled))
      .catch(() => setPublishEnabled(false));
  }, []);

  // D1 (docs/46 §2): la vista JSON es el techo de tecnicidad del editor —
  // oculta siempre (Maildrill no expone el documento crudo a sus usuarios,
  // ver docs/landing-pages-builder-integration.md), no solo en modo simple.
  const viewKeys = VIEW_KEYS.filter((v) => v !== "json");

  return (
    <header className="pbx-header">
      <div className="pbx-header__section pbx-header__section--left">
        {/* Brand: icono SVG + nombre del producto */}
        <span className="pbx-header__brand">
          <svg className="pbx-header__brand-icon" viewBox="0 0 22 22" fill="none" aria-hidden="true">
            <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.9"/>
            <rect x="13" y="2" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5"/>
            <rect x="2" y="13" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.5"/>
            <rect x="13" y="13" width="7" height="7" rx="1.5" fill="currentColor" opacity="0.75"/>
          </svg>
          <span className="pbx-header__brand-text">{t("brand")}</span>
        </span>

        <span className="pbx-header__divider" aria-hidden="true" />

        <Tabs
          defaultValue={view}
          onChange={(detail) => setView(detail.value as ViewMode)}
          className="pbx-viewtabs"
        >
          <div data-c42-tabs-list className="pbx-viewtabs__list">
            {viewKeys.map((v) => (
              <button
                key={v}
                data-c42-tabs-trigger
                data-value={v}
                className="pbx-viewtabs__trigger"
              >
                {t(`views.${v}`)}
              </button>
            ))}
          </div>
          {viewKeys.map((v) => (
            <div
              key={v}
              data-c42-tabs-panel
              data-value={v}
              className="pbx-viewtabs__panel"
              aria-hidden="true"
            />
          ))}
        </Tabs>

        <ViewModeDropdown />
      </div>

      <div className="pbx-header__section pbx-header__section--center">
        <PageBreadcrumb />
      </div>

      <div className="pbx-header__section pbx-header__section--right">
        <ViewportDropdown />

        <span className="pbx-header__divider pbx-header__divider--hide-narrow" aria-hidden="true" />

        <div className="pbx-history" role="group" aria-label={t("history.label")}>
          <button
            type="button"
            className="pbx-history__btn"
            title={t("history.undo")}
            aria-label={t("history.undo")}
            disabled={!canUndo}
            onClick={() => undo()}
          >
            <UndoIcon size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="pbx-history__btn"
            title={t("history.redo")}
            aria-label={t("history.redo")}
            disabled={!canRedo}
            onClick={() => redo()}
          >
            <RedoIcon size={16} aria-hidden="true" />
          </button>
        </div>

        <span className="pbx-header__divider" aria-hidden="true" />

        {/* Grupo "vista del canvas" (docs/46 §3 Fase 6, H6): paneles laterales
            y capas son ambos controles sobre cómo se organiza la vista de
            edición, no acciones independientes — agruparlos resuelve la causa
            del desborde (demasiados grupos sueltos) en vez de solo esconderlo
            con flex-wrap. */}
        <div className="pbx-header__canvas-controls" role="group" aria-label={t("canvasControls.label")}>
          <PanelToggleButtons />
          <LayersPanel />
        </div>

        <span className="pbx-header__divider" aria-hidden="true" />

        {publishEnabled && (
          <button
            type="button"
            className="pbx-publish-panel__btn pbx-publish-panel__btn--primary pbx-header__publish-btn"
            onClick={() => setPublishModalOpen(true)}
          >
            <Rocket size={16} aria-hidden="true" />
            {t("publish.button")}
          </button>
        )}

        {publishModalOpen ? (
          <PublishModal onClose={() => setPublishModalOpen(false)} />
        ) : null}

        <ProfileMenu />
      </div>
    </header>
  );
}
