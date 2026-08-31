/**
 * PreviewFrame — vista previa de alta fidelidad (docs/21 §3.2). Renderiza el
 * HTML+CSS+JS **exportado** de la página activa dentro de un `<iframe srcdoc>`
 * autocontenido, envuelto en un marco de dispositivo acorde al breakpoint
 * activo. El iframe ejecuta el runtime real (carousel/modal/tabs/navbar/ui.js),
 * así que el Preview es WYSIWYG del sitio publicado (P8/P3).
 *
 * Aislamiento (chrome del editor):
 * - El `srcdoc` se genera con `exportPagePreview` (función PURA de `export/`),
 *   la misma fuente que el ZIP publicable — cero divergencia con el output.
 * - El marco de dispositivo, el skeleton, el badge de dimensiones y el router
 *   de enlaces viven FUERA del HTML publicado; nunca entran al export a disco.
 * - `sandbox="allow-scripts allow-popups"` (docs/21 §6.2): scripts sí (runtime
 *   real), popups para enlaces externos (`target=_blank`); SIN `allow-same-origin`.
 *
 * Router de enlaces (docs/21 §3.3). Un iframe `srcdoc` resuelve las URLs
 * relativas contra la URL del documento PADRE (no tiene URL propia), así que un
 * enlace interno (`/`, `/en/about/`) o incluso un ancla (`#…`) navegaría el
 * iframe a `http://<host>/…` — en dev eso carga el `index.html` de Vite y
 * rompe bajo el sandbox (origin opaco). Por eso el script inyectado intercepta
 * y CANCELA toda navegación del iframe:
 * - interno (ruta root-relativa `/…`) → `postMessage` al padre → navegación
 *   LOCAL del preview (estado local, sin tocar el store — docs/21 §6.3);
 * - ancla (`#id`) → scroll DENTRO del iframe;
 * - externo (con esquema `http:`/`mailto:`…) → abrir en pestaña nueva;
 * - submit de formularios → cancelado (no navega el frame).
 * El padre mapea la ruta (localizada) → `{ pageId, locale }` y actualiza el
 * preview; los enlaces del `language-nav` (rutas por idioma) cambian el locale
 * de contenido del preview sin afectar el `editingLocale` del editor.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { writeDocIntoSite } from "@/builder/model/site";
import { exportPagePreview } from "@/builder/export/site";
import { buildPathMap, buildPathMapForLocale, withBasePath } from "@/builder/export/links";
import { DEVICE_PRESETS } from "@/builder/canvas/devicePresets";
import type { BuilderSite, PageId } from "@/builder/model/types";

const NAV_MESSAGE = "pbx-preview-navigate";

/**
 * Script inyectado DENTRO del iframe (chrome-only, nunca en el export a disco):
 * cancela TODA navegación del iframe y la reencamina. Ver la nota de cabecera
 * del componente. Se escribe en una línea (sin plantillas anidadas) para poder
 * incrustarlo tal cual en el HTML.
 */
const PREVIEW_NAV_SCRIPT =
  '<script>(function(){' +
  'document.addEventListener("click",function(e){' +
  'var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;' +
  'var href=a.getAttribute("href");if(!href)return;' +
  'if(href.charAt(0)==="#"){e.preventDefault();var el=href.length>1?document.getElementById(href.slice(1)):null;if(el){el.scrollIntoView({behavior:"smooth"});}return;}' +
  'if(/^[a-z][a-z0-9+.-]*:/i.test(href)){e.preventDefault();window.open(href,"_blank","noopener");return;}' +
  'e.preventDefault();parent.postMessage({type:"' + NAV_MESSAGE + '",href:href},"*");' +
  '},true);' +
  'document.addEventListener("submit",function(e){e.preventDefault();},true);' +
  '})();</script>';

/** Inyecta el script de navegación del preview antes de `</body>`. */
function withNavScript(html: string): string {
  const idx = html.lastIndexOf("</body>");
  if (idx === -1) return html + PREVIEW_NAV_SCRIPT;
  return html.slice(0, idx) + PREVIEW_NAV_SCRIPT + html.slice(idx);
}

interface RouteTarget {
  pageId: PageId;
  locale: string;
}

/**
 * Índice `ruta (con basePath) → { pageId, locale }`. En sitios multilingües
 * cubre las rutas de TODOS los locales (docs/12 §B.7), para resolver también
 * los enlaces del `language-nav`. Monolingüe → una sola entrada por página con
 * el locale por defecto.
 */
function buildRouteIndex(site: BuilderSite): Record<string, RouteTarget> {
  const out: Record<string, RouteTarget> = {};
  const i18n = site.meta.i18n;
  const locales = i18n ? i18n.locales : [site.meta.defaultLang];
  for (const locale of locales) {
    const pathMap = i18n ? buildPathMapForLocale(site, locale) : buildPathMap(site);
    for (const [pageId, route] of Object.entries(pathMap)) {
      out[withBasePath(site.meta.basePath, route)] = { pageId, locale };
    }
  }
  return out;
}

export function PreviewFrame() {
  const { t } = useTranslation("canvas");
  const site0 = useDocumentStore((s) => s.site);
  const activePageId = useDocumentStore((s) => s.activePageId);
  const activeDoc = useDocumentStore((s) => s.document);
  const activeBreakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const editingLocale = useDocumentStore((s) => s.editingLocale);

  const preset = DEVICE_PRESETS[activeBreakpoint];
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Navegación LOCAL del preview (docs/21 §6.3): página y locale mostrados, sin
  // tocar el store. Arrancan en la página/locale activos del editor y se
  // resincronizan si el editor los cambia (breadcrumb, selector de contenido).
  const [previewPageId, setPreviewPageId] = useState<PageId>(activePageId);
  const [previewLocale, setPreviewLocale] = useState<string>(editingLocale);
  useEffect(() => {
    setPreviewPageId(activePageId);
  }, [activePageId]);
  useEffect(() => {
    setPreviewLocale(editingLocale);
  }, [editingLocale]);

  // Volcado de la copia de trabajo al sitio (como la vista Código), para que el
  // preview refleje el estado en vivo del editor (P1). La página ACTIVA usa
  // `activeDoc`; las demás usan su documento ya guardado en el sitio.
  const flushed = useMemo(
    () => writeDocIntoSite(site0, activePageId, activeDoc),
    [site0, activePageId, activeDoc],
  );

  const srcDoc = useMemo(() => {
    const page = flushed.pages[previewPageId] ?? flushed.pages[activePageId];
    if (!page) return "";
    return withNavScript(exportPagePreview(page, flushed, previewLocale).html);
  }, [flushed, previewPageId, activePageId, previewLocale]);

  // Router: escucha los `postMessage` del script inyectado y navega dentro del
  // preview. Verifica el origen por `source` (el sandbox sin same-origin da un
  // origin opaco "null", así que no se puede filtrar por `e.origin`).
  const routeIndex = useMemo(() => buildRouteIndex(flushed), [flushed]);
  const onMessage = useCallback(
    (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as { type?: string; href?: string } | null;
      if (!data || data.type !== NAV_MESSAGE || typeof data.href !== "string") return;
      const clean = data.href.replace(/[?#].*$/, "");
      const target = routeIndex[data.href] ?? routeIndex[clean] ?? routeIndex[clean.replace(/\/?$/, "/")];
      if (!target) return;
      setPreviewPageId(target.pageId);
      setPreviewLocale(target.locale);
    },
    [routeIndex],
  );
  useEffect(() => {
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onMessage]);

  // Skeleton hasta que el iframe cargue. Se reinicia cuando cambia el srcdoc.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
  }, [srcDoc]);

  return (
    <div className="pbx-device" data-frame={preset.frame}>
      <div className="pbx-device__bar">
        <span className="pbx-device__dims" aria-label={t("preview.dimensions")}>
          {preset.width} × {preset.height}
        </span>
      </div>
      <div
        className="pbx-device__screen"
        style={{ width: `${preset.width}px`, height: `${preset.height}px` }}
      >
        {!loaded ? (
          <div className="pbx-device__skeleton" role="status" aria-live="polite">
            <span className="pbx-device__skeleton-bar" />
            <span className="pbx-device__skeleton-bar" />
            <span className="pbx-device__skeleton-bar" />
            <span className="pbx-sr-only">{t("preview.loading")}</span>
          </div>
        ) : null}
        <iframe
          ref={iframeRef}
          className="pbx-device__iframe"
          title={t("preview.frameTitle")}
          sandbox="allow-scripts allow-popups"
          srcDoc={srcDoc}
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
      </div>
    </div>
  );
}
