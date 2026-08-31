/**
 * Self-hosting de Google Fonts para el sitio EXPORTADO (docs/48, decisión D3).
 *
 * Contexto legal (investigado, no solo preferencia de diseño): un `<link>` a
 * `fonts.googleapis.com`/`fonts.gstatic.com` en el HTML de un sitio publicado
 * transmite la IP del visitante a Google en cada carga de página. El
 * Landgericht München I (caso 3 O 17493/20, ene. 2022) falló que eso viola el
 * GDPR sin consentimiento previo — riesgo real para visitantes en la UE/EEE
 * del sitio EXPORTADO (no del editor). La mitigación estándar de la industria
 * es self-hosting: los `.woff2` son de código abierto (OFL/Apache) y se
 * pueden servir desde el propio dominio, eliminando la petición a Google.
 *
 * Decisión de producto: el EDITOR (canvas/preview/miniaturas, `useWebFontLinks`)
 * y el ZIP local siguen usando el `<link>` de Google sin cambios — ahí no hay
 * "visitante" tercero, es quien edita su propio sitio. Solo `/api/publish`
 * (el sitio que de verdad sale a producción para terceros) hace self-host.
 *
 * Este módulo es la mitad PURA (P8: sin red, sin fetch) — recibe los bytes de
 * cada `.woff2` YA DESCARGADOS (por `server/src/services/publish/webfonts.ts`,
 * antes de llamar a `exportSite`, mismo patrón que Unsplash: la red ocurre
 * ANTES de que los datos entren al pipeline de export puro/síncrono) y:
 *
 * 1. Genera la ruta de archivo determinista para cada fuente descargada
 *    (`assets/fonts/<family-slug>-<weight>.woff2`).
 * 2. Emite el CSS `@font-face` correspondiente, para inyectar en el `<head>`
 *    en vez del `<link>` externo a Google (mismo punto de inserción que
 *    `usage.ts` → `fontLinks`, ver `HeadOptions.fontLinks` en `head.ts`, que
 *    ya acepta un array de strings arbitrario — no necesita cambiar su forma).
 */

import type { BuilderPage, BuilderSite } from "../model/types";
import { usedFontFamilyKeys } from "./usage";

/** Bytes de un `.woff2` ya descargado, identificado por familia + peso. */
export interface ResolvedFontFile {
  family: string;
  /** Peso CSS como string (ej. "400", "700"). "400" también cubre "regular". */
  weight: string;
  bytes: Uint8Array;
}

/**
 * Bytes de TODAS las fuentes-web de Google usadas en el sitio, ya descargados.
 * Clave: `"<family>|<weight>"` — mismo criterio de agrupación que
 * `googleFontHref`/`fontLinks` (una entrada por combinación familia+peso).
 */
export type ResolvedFontAssets = ReadonlyMap<string, ResolvedFontFile>;

/** Clave estable `"<family>|<weight>"` para `ResolvedFontAssets`. */
export function fontAssetKey(family: string, weight: string): string {
  return `${family}|${weight}`;
}

/** Nombre de archivo determinista para una fuente self-hosted (sin espacios, minúsculas). */
function fontFileName(family: string, weight: string): string {
  const slug = family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug}-${weight}.woff2`;
}

/** Ruta (sin basePath) del archivo de fuente en el sitio exportado. */
export function fontAssetPath(family: string, weight: string): string {
  return `assets/fonts/${fontFileName(family, weight)}`;
}

/**
 * Familias-token con `webFont` de Google REALMENTE usadas por `page`, con sus
 * pesos (fallback `["400"]` si no se especificaron). Mismo criterio de uso que
 * `fontLinks` — solo familias referenciadas por al menos un nodo (docs/48 §3.3).
 */
export function usedGoogleFontSpecs(
  page: BuilderPage,
  site: BuilderSite,
): { family: string; weights: string[] }[] {
  const families = site.meta.tokens?.typography?.families;
  if (!families) return [];
  const used = usedFontFamilyKeys(page);
  const specs: { family: string; weights: string[] }[] = [];
  for (const [key, fam] of Object.entries(families)) {
    if (!used.has(key)) continue;
    if (!fam.webFont || fam.webFont.provider !== "google" || !fam.webFont.family) continue;
    const weights = fam.webFont.weights?.length ? fam.webFont.weights : ["400"];
    specs.push({ family: fam.webFont.family, weights });
  }
  return specs;
}

/** Ídem, pero para TODAS las páginas del sitio (deduplicado por familia+peso). */
export function usedGoogleFontSpecsForSite(
  site: BuilderSite,
): { family: string; weights: string[] }[] {
  const byFamily = new Map<string, Set<string>>();
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (!page) continue;
    for (const spec of usedGoogleFontSpecs(page, site)) {
      const weights = byFamily.get(spec.family) ?? new Set<string>();
      for (const w of spec.weights) weights.add(w);
      byFamily.set(spec.family, weights);
    }
  }
  return [...byFamily.entries()].map(([family, weights]) => ({ family, weights: [...weights] }));
}

/**
 * `<link>`/`@font-face` para el `<head>` de una página, en modo self-hosted
 * (docs arriba). Reemplaza el `<link rel="stylesheet" href="fonts.googleapis...">`
 * de `usage.ts` → `fontLinks` por reglas `@font-face` inline apuntando a
 * `assets/fonts/*.woff2` — mismo punto de inserción (`HeadOptions.fontLinks`
 * en `head.ts`, que ya acepta strings arbitrarios en el array, sin cambiar su
 * firma). Solo emite `@font-face` para las fuentes que SÍ están en `assets`
 * (una familia sin bytes resueltos se omite en vez de romper el build — grado
 * de degradación igual al de un asset de imagen borrado, docs/07 §4).
 */
export function selfHostedFontLinks(
  page: BuilderPage,
  site: BuilderSite,
  assets: ResolvedFontAssets,
  basePath?: string,
): string[] {
  const specs = usedGoogleFontSpecs(page, site);
  if (specs.length === 0) return [];
  const bp = (basePath ?? "").replace(/\/$/, "");
  const rules: string[] = [];
  for (const { family, weights } of specs) {
    for (const weight of weights) {
      const key = fontAssetKey(family, weight);
      if (!assets.has(key)) continue;
      const href = `${bp}/${fontAssetPath(family, weight)}`;
      rules.push(
        `@font-face{font-family:'${family.replace(/'/g, "\\'")}';font-style:normal;` +
          `font-weight:${weight};font-display:swap;src:url('${href}') format('woff2');}`,
      );
    }
  }
  if (rules.length === 0) return [];
  return [`<style>${rules.join("")}</style>`];
}

/**
 * `ExportedFile[]` de los binarios `.woff2` self-hosted, para TODO el sitio
 * (una sola copia compartida entre páginas — mismo criterio que
 * `assets/img/*` en `export/index.ts`). Solo emite los que SÍ están resueltos.
 */
export function selfHostedFontFiles(
  site: BuilderSite,
  assets: ResolvedFontAssets,
): { path: string; contents: Uint8Array }[] {
  const specs = usedGoogleFontSpecsForSite(site);
  const files: { path: string; contents: Uint8Array }[] = [];
  const seen = new Set<string>();
  for (const { family, weights } of specs) {
    for (const weight of weights) {
      const key = fontAssetKey(family, weight);
      const resolved = assets.get(key);
      if (!resolved) continue;
      const path = fontAssetPath(family, weight);
      if (seen.has(path)) continue;
      seen.add(path);
      files.push({ path, contents: resolved.bytes });
    }
  }
  return files;
}
