/**
 * Canvas tools that used to live in Builder42's own 57px header, then in
 * the Maildrill document header. In embed they sit in a 50px bar above the
 * canvas (same row as the email editor's `#ee-editor-header`): Edit/Preview
 * and viewport centered, undo/redo on the right.
 *
 * D-F22.1: this bar IS the builder's own header in embedded mode (the host's
 * document header is a different header entirely), so when no host slot is
 * lent for `PageBreadcrumb` (`pagesSlotId`, see `Builder42Editor.tsx`), it
 * belongs here instead — a `__left` slot, added by this task.
 * `showPageBreadcrumb` keeps the portal seam (`HostPagesPortal`) and this
 * in-bar placement from ever coexisting: see D-F22.2.
 */

import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import {
  useCanUndo,
  useCanRedo,
  undo,
  redo,
} from "@/builder/store/useTemporalStore";
import { UndoIcon, RedoIcon, HelpCircle } from "@/components";
import { HOST_VIEWS_ID, HOST_HISTORY_ID } from "@/app/EmbeddedChrome";
import { ViewportDropdown } from "./ViewportDropdown";
import { dataTourAttr, BUILDER42_TOUR_ANCHORS } from "@/app/tour/tourAnchors";
import { requestBuilder42TourRestart } from "@/app/tour/useBuilder42Tour";
import { PageBreadcrumb } from "./PageBreadcrumb";

function HostViews() {
  const { t } = useTranslation("header");
  const view = useDocumentStore((s) => s.view);
  const setView = useDocumentStore((s) => s.setView);

  return (
    <div
      className="pbx-host-toolbar__views"
      role="group"
      aria-label={t("viewMode.label")}
      {...dataTourAttr(BUILDER42_TOUR_ANCHORS.toolbarViews)}
    >
      <button
        type="button"
        className={
          "pbx-host-toolbar__view" + (view === "edit" ? " pbx-host-toolbar__view--active" : "")
        }
        aria-pressed={view === "edit"}
        onClick={() => setView("edit")}
      >
        {t("views.edit")}
      </button>
      <button
        type="button"
        className={
          "pbx-host-toolbar__view" + (view === "preview" ? " pbx-host-toolbar__view--active" : "")
        }
        aria-pressed={view === "preview"}
        onClick={() => setView("preview")}
      >
        {t("views.preview")}
      </button>
    </div>
  );
}

function HostHistory() {
  const { t } = useTranslation("header");
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  return (
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
  );
}

function HostTourRestart() {
  const { t } = useTranslation("header");

  return (
    <div className="pbx-history">
      <button
        type="button"
        className="pbx-history__btn"
        title={t("restartTour.label")}
        aria-label={t("restartTour.label")}
        onClick={() => requestBuilder42TourRestart()}
      >
        <HelpCircle size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function HostCanvasToolbar({
  showPageBreadcrumb = false,
}: {
  /**
   * D-F22.2: pinta `PageBreadcrumb` aquí solo cuando el host NO le prestó su
   * slot al portal (`pagesSlotId` en `Builder42Editor.tsx`) — así nunca
   * coexisten las dos ubicaciones. `Builder42EditorInner` es quien decide el
   * valor (`!pagesSlotId`); este componente no conoce esa prop.
   */
  showPageBreadcrumb?: boolean;
}) {
  const { t } = useTranslation("header");

  return (
    <div className="pbx-canvas-toolbar" role="toolbar" aria-label={t("canvasControls.label")}>
      {showPageBreadcrumb && (
        <div className="pbx-canvas-toolbar__left">
          <PageBreadcrumb />
        </div>
      )}
      <div id={HOST_VIEWS_ID} className="pbx-canvas-toolbar__center">
        <HostViews />
        <ViewportDropdown />
      </div>
      <div id={HOST_HISTORY_ID} className="pbx-canvas-toolbar__right">
        <div {...dataTourAttr(BUILDER42_TOUR_ANCHORS.toolbarHistory)}>
          <HostHistory />
        </div>
        <HostTourRestart />
      </div>
    </div>
  );
}
