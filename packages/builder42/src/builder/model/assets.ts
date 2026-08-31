/**
 * Assets del sitio — helpers puros (P7/P8, docs/07 §4).
 *
 * Un `ImageSource` se resuelve a un `src` real:
 * - En el **canvas** una referencia a asset → su `dataUrl` (preview en vivo).
 * - En el **export** → `/assets/img/<fileName>` (con basePath); el binario se
 *   materializa como archivo del sitio (`assetToBytes`).
 *
 * Guardar el asset como data URL mantiene el sitio como **un solo JSON**
 * autocontenido (docs/06 §8); el export lo desempaqueta a binario.
 */

import type { Asset, AssetId, ImageSource } from "./types";

/** Antepone `basePath` (default "/") a una ruta root-absoluta, sin barras dobles. */
function joinBasePath(basePath: string | undefined, path: string): string {
  const bp = (basePath ?? "/").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${bp}${p}` || "/";
}

/** Genera un id de asset único. */
export function newAssetId(): AssetId {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `asset-${rand}`;
}

/** Ruta (sin basePath) del asset en el sitio exportado. */
export function assetImgPath(asset: Asset): string {
  return `assets/img/${asset.fileName}`;
}

/** Decodifica base64 a bytes (funciona en navegador y Node). */
export function base64ToBytes(base64: string): Uint8Array {
  const binary =
    typeof atob === "function"
      ? atob(base64)
      : Buffer.from(base64, "base64").toString("binary");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Extrae mime + bytes de un data URL (`data:<mime>;base64,<data>`). */
export function dataUrlToBytes(dataUrl: string): { mimeType: string; bytes: Uint8Array } {
  const match = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return { mimeType: "application/octet-stream", bytes: new Uint8Array() };
  const mimeType = match[1] || "application/octet-stream";
  const isBase64 = match[2] === ";base64";
  const data = match[3] ?? "";
  const bytes = isBase64
    ? base64ToBytes(data)
    : new TextEncoder().encode(decodeURIComponent(data));
  return { mimeType, bytes };
}

/** Bytes de un asset (para materializarlo como archivo en export). */
export function assetToBytes(asset: Asset): Uint8Array {
  return dataUrlToBytes(asset.dataUrl).bytes;
}

/** Lee un `ImageSource` desde las props del nodo (con fallback a `src` legacy). */
export function readImageSource(props: Record<string, unknown>): ImageSource | undefined {
  const source = props.source;
  if (typeof source === "object" && source !== null) {
    const kind = (source as { kind?: unknown }).kind;
    if (kind === "url" || kind === "asset") return source as ImageSource;
  }
  if (typeof props.src === "string" && props.src !== "") {
    return { kind: "url", url: props.src };
  }
  return undefined;
}

export interface ResolveImageOptions {
  assets?: Record<AssetId, Asset>;
  /** true → ruta de archivo del export; false → dataUrl para el canvas. */
  forExport: boolean;
  basePath?: string;
}

/** Resuelve un `ImageSource` a un `src` usable (docs/07 §4). "" si no resuelve. */
export function resolveImageSrc(
  source: ImageSource | undefined,
  opts: ResolveImageOptions,
): string {
  if (!source) return "";
  if (source.kind === "url") return source.url;
  const asset = opts.assets?.[source.assetId];
  if (!asset) return ""; // asset borrado → degradado (no rompe)
  return opts.forExport
    ? joinBasePath(opts.basePath, `/${assetImgPath(asset)}`)
    : asset.dataUrl;
}
