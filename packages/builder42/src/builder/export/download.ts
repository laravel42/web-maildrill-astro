/**
 * Descarga de archivos en el navegador (chrome del editor, no toca el output).
 * Compartido por la vista Código (`.zip`/HTML) y la persistencia del sitio
 * (`.json`, Fase 4). Crea un Blob y dispara un click sobre un ancla temporal.
 */
export function downloadBlob(
  filename: string,
  data: Uint8Array | string,
  type: string,
): void {
  const part: BlobPart = typeof data === "string" ? data : new Uint8Array(data);
  const blob = new Blob([part], { type });
  const url = URL.createObjectURL(blob);
  const a = window.document.createElement("a");
  a.href = url;
  a.download = filename;
  window.document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Normaliza el nombre del sitio a un nombre de archivo seguro (sin extensión). */
export function siteFileBaseName(siteName: string): string {
  return (
    siteName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "site"
  );
}

/**
 * Marca de tiempo compacta y segura para nombres de archivo: `YYYYMMDD-HHmmss`
 * (hora local). Determinista dada una fecha (testeable).
 */
export function timestampSlug(date: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}` +
    `-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
  );
}

/**
 * Construye el nombre del archivo de salida a partir de un prefijo configurable
 * y un flag de timestamp (Fase 19.i). La extensión es parametrizable para
 * reutilizarlo con `.json` (guardar sitio) y `.zip` (descargar proyecto).
 * Ejemplos:
 *   buildOutputFileName("page", true)         → "page-20260713-144955.json"
 *   buildOutputFileName("page", false)        → "page.json"
 *   buildOutputFileName("page", true, d, "zip") → "page-20260713-144955.zip"
 * El prefijo se normaliza igual que el nombre de sitio; vacío cae a "page".
 */
export function buildOutputFileName(
  prefix: string,
  withTimestamp: boolean,
  date: Date = new Date(),
  ext: string = "json",
): string {
  const normalized = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const base = normalized || "page";
  const stem = withTimestamp ? `${base}-${timestampSlug(date)}` : base;
  return `${stem}.${ext}`;
}
