/**
 * Canvas — renderer recursivo del árbol (PLAN §6). El ancho lo fija el viewport
 * activo (docs/01 §3), lo que cambia el estilo resuelto vía `resolveStyle`
 * (criterio §8.7). Modos:
 *  - edit    → NodeRenderer interactivo (selección + DnD).
 *  - preview → NodeRenderer sin chrome (estilos en vivo).
 *  - code    → salida de exportToHtml (HTML + CSS, solo lectura).
 *
 * La vista "json" (edición cruda del `BuilderSite`) existe en el tipo
 * `ViewMode` pero fue eliminada de este host — ver el guard más abajo.
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
import { useLocalConfig } from "@/hooks/useLocalConfig";
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
import { CanvasEmptyStart } from "./CanvasEmptyStart";

export function Canvas() {
  const view = useDocumentStore((s) => s.view);
  const setView = useDocumentStore((s) => s.setView);
  const rootId = useDocumentStore((s) => s.document.rootId);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const activeThemeId = useDocumentStore((s) => s.activeThemeId);
  const select = useDocumentStore((s) => s.select);
  const canvasRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  useAutoScroll(canvasRef);

  // La vista JSON queda eliminada en este host (Maildrill no expone el
  // documento crudo a sus usuarios, ver
  // docs/landing-pages-builder-integration.md) — incondicional, no solo en
  // modo simple: ambos botones que la seleccionaban (`Header`,
  // `ViewModeDropdown`) ya la excluyen de su lista, pero `view` puede seguir
  // siendo "json" desde una sesión anterior (persistido) o modo avanzado
  // previo a este cambio. Cae a "edit", igual que `SiteSettingsPanel` cae a
  // "pages" cuando su tab activa se oculta.
  useEffect(() => {
    if (view === "json") {
      setView("edit");
    }
  }, [view, setView]);

  if (view === "code") {
    return <CodeView />;
  }

  const interactive = view === "edit";

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
        {interactive ? <CanvasEmptyStart /> : null}
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
 * Vista JSON EDITABLE (Fase 4, docs/04 §Fase 4) — eliminada en este host
 * (Maildrill no expone el documento crudo a sus usuarios ni permite
 * reemplazar el sitio entero pegando JSON; ver
 * docs/landing-pages-builder-integration.md). Los botones que la
 * seleccionaban (`Header`, `ViewModeDropdown`) ya no la ofrecen, y el guard
 * de arriba redirige a "edit" si `view` llegara a ser "json" por cualquier
 * otra vía (sesión persistida de antes de este cambio).
 */
