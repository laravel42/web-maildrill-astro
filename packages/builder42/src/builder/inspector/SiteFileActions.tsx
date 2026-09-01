/**
 * SiteFileActions — sección Ajustes del panel de configuración de sitio
 * (Fase 19.i / 19.k). Contiene:
 *   1. Configuración del nombre de archivo de salida: prefijo editable
 *      (default "page") + checkbox de marca de tiempo (por defecto activo) →
 *      `page-<timestamp>.json`. Persistido en `useLocalConfig` (docs §5.3).
 *   2. Descargar proyecto: exporta el sitio estático (HTML + CSS + assets)
 *      comprimido en `.zip` — misma funcionalidad que el botón de la vista
 *      Código (`exportSite` + `zipSite`), reutilizando el nombre de salida.
 *
 * Eliminado en este host: guardar/cargar el `BuilderSite` completo como
 * `.json` crudo (existía aquí en `pb-static`) — Maildrill no expone el
 * documento crudo a sus usuarios, igual que la vista JSON del canvas
 * (`Canvas.tsx`); ver docs/landing-pages-builder-integration.md. Cargar un
 * JSON arbitrario reemplazaba el sitio ENTERO sin ninguna validación visible
 * para un usuario no técnico.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDocumentStore } from "@/builder/store/documentStore";
import { exportSite } from "@/builder/export/site";
import { zipSite } from "@/builder/export/zip";
import { downloadBlob, buildOutputFileName } from "@/builder/export/download";
import { useLocalConfig } from "@/hooks/useLocalConfig";
import { Toggle } from "@/components";
import { ExportWarningsBanner } from "@/components/ExportWarningsBanner";
import type { ExportWarning } from "@/builder/export/warnings";

export function SiteFileActions() {
  const { t: ti } = useTranslation("inspector");
  const getFlushedSite = useDocumentStore((s) => s.getFlushedSite);

  const [prefix, setPrefix] = useLocalConfig("outputFilePrefix");
  const [useTimestamp, setUseTimestamp] = useLocalConfig("outputFileTimestamp");
  const [zipPrefix, setZipPrefix] = useLocalConfig("outputZipPrefix");
  const [zipTimestamp, setZipTimestamp] = useLocalConfig("outputZipTimestamp");

  const [exporting, setExporting] = useState(false);
  const [exportWarnings, setExportWarnings] = useState<ExportWarning[]>([]);

  const previewName = buildOutputFileName(prefix, useTimestamp);
  const zipPreviewName = buildOutputFileName(zipPrefix, zipTimestamp, new Date(), "zip");

  const handleDownloadZip = () => {
    setExporting(true);
    setExportWarnings([]);
    setTimeout(() => {
      const site = getFlushedSite();
      const built = exportSite(site, { minify: true });
      setExportWarnings(built.warnings);
      downloadBlob(
        buildOutputFileName(zipPrefix, zipTimestamp, new Date(), "zip"),
        zipSite(built.files),
        "application/zip",
      );
      setExporting(false);
    }, 0);
  };

  return (
    <div className="pbx-file-settings">
      {/* Nombre de archivo de salida */}
      <div className="pbx-output-name">
        <h4 className="pbx-inspector__heading">{ti("siteSettings.output.title")}</h4>
        <div className="pbx-output-name__row">
          <label className="pbx-output-name__field">
            <span className="pbx-control__label">{ti("siteSettings.output.prefixLabel")}</span>
            <input
              className="pbx-control__input"
              value={prefix}
              placeholder={ti("siteSettings.output.prefixPlaceholder")}
              onChange={(e) => setPrefix(e.target.value)}
            />
          </label>
        </div>
        <Toggle checked={useTimestamp} onChange={setUseTimestamp}>
          {ti("siteSettings.output.timestamp")}
        </Toggle>
        <p className="pbx-output-name__preview">
          {ti("siteSettings.output.preview")}: <code>{previewName}</code>
        </p>
      </div>

      {/* Descargar proyecto estático (.zip) */}
      <div className="pbx-file-group">
        <h4 className="pbx-inspector__heading">{ti("siteSettings.download.title")}</h4>
        <p className="pbx-output-name__preview">{ti("siteSettings.download.hint")}</p>
        <div className="pbx-output-name">
          <div className="pbx-output-name__row">
            <label className="pbx-output-name__field">
              <span className="pbx-control__label">{ti("siteSettings.output.prefixLabel")}</span>
              <input
                className="pbx-control__input"
                value={zipPrefix}
                placeholder={ti("siteSettings.output.prefixPlaceholder")}
                onChange={(e) => setZipPrefix(e.target.value)}
              />
            </label>
          </div>
          <Toggle checked={zipTimestamp} onChange={setZipTimestamp}>
            {ti("siteSettings.output.timestamp")}
          </Toggle>
          <p className="pbx-output-name__preview">
            {ti("siteSettings.output.preview")}: <code>{zipPreviewName}</code>
          </p>
        </div>
        <div className="pbx-file">
          <button
            type="button"
            className="pbx-file__btn"
            title={ti("siteSettings.download.title")}
            disabled={exporting}
            onClick={handleDownloadZip}
          >
            {exporting ? ti("siteSettings.download.exporting") : <>⬇ {ti("siteSettings.download.button")}</>}
          </button>
        </div>
        {exportWarnings.length > 0 ? <ExportWarningsBanner warnings={exportWarnings} ns="inspector" /> : null}
      </div>
    </div>
  );
}
