/**
 * Empaquetado del sitio exportado en un único `.zip` comprimido (docs/07).
 *
 * Puro: convierte los `ExportedFile[]` de `exportSite` en un ZIP (DEFLATE) con
 * la estructura de carpetas intacta (`assets/css/…`, `about/index.html`, …).
 * La descarga en el navegador (Blob) la hace la UI; esto solo produce los bytes,
 * así que es testeable sin DOM.
 */

import { zipSync, strToU8 } from "fflate";
import type { ExportedFile } from "./site";

/** Devuelve los bytes de un ZIP con todos los archivos del sitio (nivel 9). */
export function zipSite(files: ExportedFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    entries[f.path] = typeof f.contents === "string" ? strToU8(f.contents) : f.contents;
  }
  return zipSync(entries, { level: 9 });
}
