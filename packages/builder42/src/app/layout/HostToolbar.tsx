/**
 * Canvas tools that used to live in Builder42's own 57px header, then in
 * the Maildrill document header. In embed they sit in a 50px bar above the
 * canvas (same row as the email editor's `#ee-editor-header`): Edit/Preview
 * and viewport centered, undo/redo on the right, panel toggles on the left.
 */

import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import {
  useCanUndo,
  useCanRedo,
  undo,
  redo,
} from "@/builder/store/useTemporalStore";
import { UndoIcon, RedoIcon } from "@/components";
import { HOST_VIEWS_ID, HOST_HISTORY_ID } from "@/app/EmbeddedChrome";
import { ViewportDropdown } from "./ViewportDropdown";

function HostViews() {
  const { t } = useTranslation("header");
  const view = useDocumentStore((s) => s.view);
  const setView = useDocumentStore((s) => s.setView);

  return (
    <div className="pbx-host-toolbar__views" role="group" aria-label={t("viewMode.label")}>
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

export function HostCanvasToolbar() {
  const { t } = useTranslation("header");

  return (
    <div className="pbx-canvas-toolbar" role="toolbar" aria-label={t("canvasControls.label")}>
      <div id={HOST_VIEWS_ID} className="pbx-canvas-toolbar__center">
        <HostViews />
        <ViewportDropdown />
      </div>
      <div id={HOST_HISTORY_ID} className="pbx-canvas-toolbar__right">
        <HostHistory />
      </div>
    </div>
  );
}
