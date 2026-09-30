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

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { NodeActionsRail } from "@/builder/dnd/NodeActionsRail";
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
import { dataTourAttr, BUILDER42_TOUR_ANCHORS } from "@/app/tour/tourAnchors";
import { notifyTourZoneClick } from "@/app/tour/zoneTourTriggers";
import {
  simpleIconsCatalog,
  subscribeSimpleIcons,
  getSimpleIconsVersion,
} from "@/builder/registry/catalogs/simpleIcons.catalog";
import { usedSocialIconSlugs } from "@/builder/export/usage";

export function Canvas() {
  const view = useDocumentStore((s) => s.view);
  const setView = useDocumentStore((s) => s.setView);
  const rootId = useDocumentStore((s) => s.document.rootId);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const activeThemeId = useDocumentStore((s) => s.activeThemeId);
  const select = useDocumentStore((s) => s.select);
  // Disparador angosto (docs/34 §F11a3): antes bastaba con que el documento
  // tuviera ALGÚN nodo `social-links`, sin mirar sus props — y los 17
  // templates publicados traen ese nodo con `props: {}` (sin `links`), así
  // que abrir cualquier template descargaba el catálogo de marcas (~5 MB /
  // 1.78 MB brotli) para pintar CERO iconos. La condición ahora es un OR de
  // dos casos, los únicos en los que el catálogo hace falta de verdad:
  //  a) algún nodo `social-links` tiene al menos un link con `label` no
  //     vacío tras trim() — ese es el único caso en que el canvas tiene un
  //     glifo de marca real que pintar (el slug es el label en minúsculas,
  //     ver `resolveIcon` en SocialLinks.tsx); o
  //  b) el nodo seleccionado es un `social-links` — seleccionarlo es
  //     condición necesaria para abrir el picker de redes del Inspector, que
  //     necesita el catálogo cargado para sus previews aunque el nodo no
  //     tenga labels todavía.
  const needsBrandCatalog = useDocumentStore((s) => {
    const selected = s.selectedId ? s.document.nodes[s.selectedId] : undefined;
    if (selected?.type === "social-links") return true;
    return Object.values(s.document.nodes).some((n) => {
      if (n.type !== "social-links") return false;
      const links = Array.isArray(n.props.links) ? n.props.links : [];
      return links.some(
        (l) => typeof (l as { label?: unknown })?.label === "string" && (l as { label: string }).label.trim() !== "",
      );
    });
  });
  const canvasRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  useAutoScroll(canvasRef);

  // Guarda de navegación en Edit (chain L1): los componentes del registry
  // pintan anchors REALES en el documento vivo (`Button.tsx`, `Navbar`,
  // `NavMenu`, `Breadcrumb`, `LanguageNav`, `SocialLinks` renderizan
  // `<a href>`), y nada los cancelaba en modo Edit — un click activaba la
  // navegación del navegador y se llevaba el documento TOP-LEVEL entero
  // fuera del editor (a diferencia de `PreviewFrame.tsx`, que ya intercepta
  // TODA navegación de su iframe porque corre el export real dentro de un
  // sandbox — ver la cabecera de ese archivo). Este listener es el
  // equivalente para el canvas de Edit: un único handler en CAPTURE phase
  // sobre la raíz del canvas, activo solo en modo Edit (`view === "edit"`,
  // comprobado dentro del efecto porque `interactive` se calcula más abajo
  // en esta función, después de los `return` tempranos), que cancela la
  // activación de cualquier `<a href>` o el `submit` de un formulario ANTES
  // de que el navegador actúe — pero sin `stopPropagation()`, para que el
  // `onClick` de `rootProps` en `NodeRenderer` (que hace la selección) siga
  // corriendo con normalidad. Capture phase es lo que permite ganarle a la
  // acción por defecto del navegador Y al propio handler del componente
  // (que no la cancela).
  // NO borrar este `preventDefault`: no es un descuido de Preview, es la
  // pieza que faltaba en Edit — ver `PreviewFrame.tsx` líneas ~45-60 para el
  // guard equivalente del lado de Preview.
  useEffect(() => {
    const root = canvasRef.current;
    const editModeActive = view === "edit";
    if (!editModeActive || !root) return;

    const cancelLinkActivation = (e: Event) => {
      const target = e.target as Element | null;
      const anchor = target?.closest?.("a[href]") ?? null;
      if (anchor) {
        e.preventDefault();
      }
    };
    const cancelSubmit = (e: Event) => {
      e.preventDefault();
    };

    root.addEventListener("click", cancelLinkActivation, true);
    root.addEventListener("submit", cancelSubmit, true);
    return () => {
      root.removeEventListener("click", cancelLinkActivation, true);
      root.removeEventListener("submit", cancelSubmit, true);
    };
  }, [view]);

  // Suscripción al catálogo lazy de simple-icons (docs/34 §F11a): fuerza un
  // re-render cuando el barrel termina de cargar, para que el canvas y la
  // preview del picker (que leen `simpleIconsCatalog.get()` de forma
  // síncrona) dejen de mostrar el icono genérico en cuanto llegan los datos.
  // Solo importa que el valor cambie, no su contenido.
  useSyncExternalStore(subscribeSimpleIcons, getSimpleIconsVersion, getSimpleIconsVersion);

  // Precalentamiento (docs/34 §F11a, condición angosta en §F11a3): dispara
  // `ensure()` solo cuando `needsBrandCatalog` es true — ver el comentario
  // del selector arriba para las dos ramas del OR. Este efecto vive en
  // `Canvas`, montado solo en el editor interactivo real del browser —
  // nunca corre en export/SSR (`exportToHtml`/`zipSite` no montan React; esos
  // caminos siguen llamando `ensure()` sin condición, ver `downloadZip` en
  // `CodeView` más abajo).
  useEffect(() => {
    if (!needsBrandCatalog) return;
    void simpleIconsCatalog.ensure([]);
  }, [needsBrandCatalog]);

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
      onClickCapture={() => notifyTourZoneClick("canvas")}
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
        {...dataTourAttr(BUILDER42_TOUR_ANCHORS.canvasFrame)}
      >
        <ErrorBoundary key={view} nodeId={rootId}>
          <NodeRenderer id={rootId} interactive={interactive} />
        </ErrorBoundary>
        {interactive ? <CanvasEmptyStart /> : null}
        {interactive ? <SelectionHandle frameRef={frameRef} /> : null}
        {interactive ? <NodeActionsRail frameRef={frameRef} /> : null}
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

  // Misma suscripción que en `Canvas`: la vista Código lee `simpleIconsCatalog`
  // de forma síncrona dentro del `useMemo` de abajo, así que necesita
  // re-renderizar cuando el catálogo llega (docs/34 §F11a).
  useSyncExternalStore(subscribeSimpleIcons, getSimpleIconsVersion, getSimpleIconsVersion);

  const { html, css, site } = useMemo(() => {
    const flushed = writeDocIntoSite(site0, activePageId, activeDoc);
    const page = flushed.pages[activePageId]!;
    const out = exportPage(page, flushed);
    return { html: out.html, css: out.css, site: flushed };
  }, [site0, activePageId, activeDoc]);

  const downloadZip = async () => {
    setExporting(true);
    setExportWarnings([]);
    // `ensure()` antes de exportar (decisión 5d): sin esto, un .zip generado
    // antes de que el barrel termine de cargar saldría con los iconos de
    // marca vacíos (el fallback genérico) aunque el canvas ya los mostrara
    // bien — precisamente el escenario a evitar. Si la carga falla, no
    // bloqueamos la descarga: los glifos de marca caen al icono genérico
    // (el mismo fallback que ya usa cualquier marca no reconocida).
    try {
      await simpleIconsCatalog.ensure(usedSocialIconSlugs(site));
    } catch (err) {
      console.warn("simple-icons: no se pudo cargar el catálogo de marcas, se usa el icono genérico", err);
    }
    // El bloque de export es síncrono y pesado (exportSite + zipSite). Lo
    // diferimos a una MACROtask con setTimeout(…, 0) para que el navegador
    // pinte antes el botón deshabilitado y el label "Exporting…": el
    // `.then`/`await` de arriba corre como MICROtask, que se ejecuta ANTES
    // del siguiente paint, así que sin este setTimeout el hilo principal se
    // bloquearía sin que el usuario llegue a ver el estado "exporting".
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
