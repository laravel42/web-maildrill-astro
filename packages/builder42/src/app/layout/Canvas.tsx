/**
 * Canvas — renderer recursivo del árbol (PLAN §6). El ancho lo fija el viewport
 * activo (docs/01 §3), lo que cambia el estilo resuelto vía `resolveStyle`
 * (criterio §8.7). Modos:
 *  - edit    → NodeRenderer interactivo (selección + DnD).
 *  - preview → NodeRenderer sin chrome (estilos en vivo).
 *  - code    → salida de exportToHtml (HTML + CSS, solo lectura).
 *  - json    → BuilderDocument crudo (solo lectura).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { NodeRenderer } from "@/builder/canvas/NodeRenderer";
import { KeyboardReorder } from "@/builder/canvas/KeyboardReorder";
import { exportPage, exportSite, type ExportedFile } from "@/builder/export/site";
import { zipSite } from "@/builder/export/zip";
import { downloadBlob, buildOutputFileName } from "@/builder/export/download";
import { writeDocIntoSite } from "@/builder/model/site";
import { parseSiteJson } from "@/builder/model/persist";
import { useLocalConfig } from "@/hooks/useLocalConfig";
import { useExperienceLevel } from "@/hooks/useExperienceLevel";
import { useAutoScroll } from "@/builder/dnd/useAutoScroll";
import { SelectionHandle } from "@/builder/dnd/SelectionHandle";
import { HoverHandle } from "@/builder/dnd/HoverHandle";
import { TextToolbar } from "@/builder/canvas/TextToolbar";
import { ModalEditorOverlay } from "@/builder/canvas/ModalEditorOverlay";
import { PickInsertBar } from "@/builder/canvas/PickInsertBar";
import { InvisibleElementsBubble } from "@/builder/canvas/InvisibleElementsBubble";
import { PreviewFrame } from "@/builder/canvas/PreviewFrame";
import { viewportWidth } from "@/builder/canvas/devicePresets";
import { ErrorBoundary } from "@/components";
import { ExportWarningsBanner } from "@/components/ExportWarningsBanner";
import type { ExportWarning } from "@/builder/export/warnings";

export function Canvas() {
  const view = useDocumentStore((s) => s.view);
  const setView = useDocumentStore((s) => s.setView);
  const rootId = useDocumentStore((s) => s.document.rootId);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const activeThemeId = useDocumentStore((s) => s.activeThemeId);
  const select = useDocumentStore((s) => s.select);
  const { isSimple } = useExperienceLevel();
  const canvasRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  useAutoScroll(canvasRef);

  // D1 (docs/46 §2): la vista JSON es el techo de tecnicidad del editor —
  // oculta en modo simple. Borde crítico (docs/46 §6): si el usuario estaba
  // en JSON y cambia a modo simple, la vista activa queda oculta y el canvas
  // no debe quedar en blanco — cae a "edit", igual que `SiteSettingsPanel`
  // cae a "pages" cuando su tab activa se oculta.
  useEffect(() => {
    if (isSimple && view === "json") {
      setView("edit");
    }
  }, [isSimple, view, setView]);

  if (view === "code") {
    return <CodeView />;
  }

  const interactive = view === "edit";

  if (view === "json" && !isSimple) {
    return <JsonView />;
  }

  // Preview de alta fidelidad (docs/21): iframe con el export real dentro de un
  // marco de dispositivo. Sustituye al antiguo Preview de "NodeRenderer sin
  // chrome" (que era básicamente el div de Edit sin selección). El runtime JS
  // opt-in corre DENTRO del iframe (export real), así que los hooks
  // `usePreviewBehaviors`/`usePreviewUIRuntime` del NodeRenderer ya no hidratan
  // nada en este modo — quedan comentados como fallback reversible (docs/21 §6.1).
  if (view === "preview") {
    return (
      <main className="pbx-canvas pbx-canvas--preview" ref={canvasRef}>
        <PreviewFrame />
      </main>
    );
  }

  return (
    <main
      className="pbx-canvas"
      ref={canvasRef}
      onClick={() => {
        if (interactive) select(null);
      }}
    >
      <div
        className="pbx-canvas__frame"
        ref={frameRef}
        style={{ width: viewportWidth(activeBreakpoint) }}
        data-breakpoint={activeBreakpoint}
        data-theme={activeThemeId ?? undefined}
      >
        <ErrorBoundary key={view} nodeId={rootId}>
          <NodeRenderer id={rootId} interactive={interactive} />
        </ErrorBoundary>
        {interactive ? <SelectionHandle frameRef={frameRef} /> : null}
        {interactive ? <HoverHandle frameRef={frameRef} /> : null}
        {interactive ? <TextToolbar frameRef={frameRef} /> : null}
        {interactive ? <ModalEditorOverlay /> : null}
      </div>
      {interactive ? <KeyboardReorder /> : null}
      {interactive ? <InvisibleElementsBubble /> : null}
      {interactive ? <PickInsertBar /> : null}
    </main>
  );
}

/**
 * Vista Código (docs/07 §1): la página activa como el **`index.html` real** del
 * export (imágenes y CSS como enlaces `/assets/…`, sin base64 que infle el
 * código) más su CSS de página, y la descarga del **sitio completo** en un
 * `.zip` comprimido con una previsualización del árbol.
 */
function CodeView() {
  const { t } = useTranslation("canvas");
  const site0 = useDocumentStore((s) => s.site);
  const activePageId = useDocumentStore((s) => s.activePageId);
  const activeDoc = useDocumentStore((s) => s.document);
  const [files, setFiles] = useState<ExportedFile[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportWarnings, setExportWarnings] = useState<ExportWarning[]>([]);
  const [prefix] = useLocalConfig("outputZipPrefix");
  const [useTimestamp] = useLocalConfig("outputZipTimestamp");

  const { html, css, site } = useMemo(() => {
    const flushed = writeDocIntoSite(site0, activePageId, activeDoc);
    const page = flushed.pages[activePageId]!;
    const out = exportPage(page, flushed);
    return { html: out.html, css: out.css, site: flushed };
  }, [site0, activePageId, activeDoc]);

  const downloadZip = () => {
    setExporting(true);
    setExportWarnings([]);
    setTimeout(() => {
      const built = exportSite(site, { minify: true });
      setFiles(built.files);
      setExportWarnings(built.warnings);
      const zipName = buildOutputFileName(prefix, useTimestamp, new Date(), "zip");
      downloadBlob(zipName, zipSite(built.files), "application/zip");
      setExporting(false);
    }, 0);
  };

  return (
    <main className="pbx-canvas pbx-canvas--code">
      <section className="pbx-code">
        <div className="pbx-code__toolbar">
          <h3>{t("code.pageTitle")}</h3>
          <button type="button" className="pbx-code__btn" disabled={exporting} onClick={downloadZip}>
            {exporting ? t("code.exporting") : <>⬇ {t("code.downloadZip", { count: site.pageOrder.length })}</>}
          </button>
        </div>
        {exportWarnings.length > 0 ? <ExportWarningsBanner warnings={exportWarnings} ns="canvas" /> : null}
        <pre className="pbx-code__block">{html}</pre>

        <h3>{t("code.pageCss")}</h3>
        <pre className="pbx-code__block">{css}</pre>

        {files ? (
          <div className="pbx-export">
            <h3>{t("code.zipContents", { count: files.length })}</h3>
            {files.map((f) => (
              <details key={f.path} className="pbx-export__file">
                <summary>
                  <code>{f.path}</code>
                </summary>
                <pre className="pbx-code__block pbx-code__block--sm">
                  {typeof f.contents === "string"
                    ? f.contents
                    : t("code.binary", { bytes: f.contents.length })}
                </pre>
              </details>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

/**
 * Vista JSON EDITABLE con validación (Fase 4, docs/04 §Fase 4). Muestra el
 * `BuilderSite` completo (copia de trabajo volcada) en un textarea. "Aplicar"
 * parsea + migra v1→v2 + valida vía `parseSiteJson`; si es válido reemplaza el
 * sitio (`loadSite`), si no lista los errores sin tocar el estado. La edición
 * reemplaza el sitio ENTERO (P1: el JSON es la fuente de verdad).
 */
function JsonView() {
  const { t } = useTranslation("canvas");
  const site = useDocumentStore((s) => s.site);
  const activePageId = useDocumentStore((s) => s.activePageId);
  const activeDoc = useDocumentStore((s) => s.document);
  const loadSite = useDocumentStore((s) => s.loadSite);

  const currentJson = useMemo(
    () => JSON.stringify(writeDocIntoSite(site, activePageId, activeDoc), null, 2),
    [site, activePageId, activeDoc],
  );

  const [draft, setDraft] = useState(currentJson);
  const [errors, setErrors] = useState<string[]>([]);
  const [applied, setApplied] = useState(false);
  const dirty = draft !== currentJson;

  const apply = () => {
    const res = parseSiteJson(draft);
    if (res.ok) {
      loadSite(res.value);
      setErrors([]);
      setApplied(true);
    } else {
      setErrors(res.errors);
      setApplied(false);
    }
  };

  const reset = () => {
    setDraft(currentJson);
    setErrors([]);
    setApplied(false);
  };

  return (
    <main className="pbx-canvas pbx-canvas--code">
      <section className="pbx-json">
        <div className="pbx-json__toolbar">
          <h3>{t("json.title")}</h3>
          <div className="pbx-json__actions">
            {applied && !dirty ? (
              <span className="pbx-json__ok" role="status">
                {t("json.applied")}
              </span>
            ) : null}
            <button
              type="button"
              className="pbx-json__btn"
              onClick={reset}
              disabled={!dirty}
            >
              {t("json.reset")}
            </button>
            <button
              type="button"
              className="pbx-json__btn pbx-json__btn--primary"
              onClick={apply}
              disabled={!dirty}
            >
              {t("json.apply")}
            </button>
          </div>
        </div>

        <textarea
          className="pbx-json__area"
          aria-label={t("json.ariaLabel")}
          spellCheck={false}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setApplied(false);
          }}
        />

        {errors.length > 0 ? (
          <div className="pbx-json__errors" role="alert">
            <strong>{t("json.validationErrors", { count: errors.length })}</strong>
            <ul>
              {errors.slice(0, 20).map((err, i) => (
                <li key={i}>
                  <code>{err}</code>
                </li>
              ))}
            </ul>
            {errors.length > 20 ? <p>{t("json.andMore", { count: errors.length - 20 })}</p> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
