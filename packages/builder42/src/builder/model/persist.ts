/**
 * Persistencia del sitio (Fase 4, docs/06 §8): un JSON = un `BuilderSite`.
 *
 * Funciones PURAS (P7): serializan/parsean sin tocar el store ni el DOM.
 *  - `serializeSite`  → JSON estable e indentado del sitio completo.
 *  - `parseSiteJson`  → parsea texto, MIGRA v1→v2 si hace falta y VALIDA.
 *
 * El flujo de carga es tolerante hacia atrás: un `BuilderDocument` v1 (single
 * doc, sin `pages`) se envuelve en un sitio de una página con `migrateDocToSite`
 * antes de validar (docs/06 §8). Cualquier fallo se reporta como lista de
 * errores; nunca se lanza.
 */

import type { BreakpointConfig, BuilderDocument, BuilderSite } from "./types";
import { DEFAULT_BREAKPOINTS } from "./types";
import { migrateDocToSite } from "./site";
import { migrateSiteCompositeSlots } from "./migrateSlots";
import { looksLikeDocumentV1, validateSite, type ValidationResult } from "./validate";

/** Serializa el sitio completo a JSON indentado (2 espacios). */
export function serializeSite(site: BuilderSite): string {
  return JSON.stringify(site, null, 2);
}

/**
 * Parsea un valor ya deserializado (objeto) a `BuilderSite`, migrando v1→v2 si
 * corresponde y validando el resultado. Separada de `parseSiteJson` para poder
 * testear la migración sin pasar por `JSON.parse`.
 */
export function loadSiteFromValue(
  value: unknown,
  breakpoints: BreakpointConfig = DEFAULT_BREAKPOINTS,
): ValidationResult<BuilderSite> {
  const candidate = looksLikeDocumentV1(value)
    ? migrateDocToSite(value as BuilderDocument, breakpoints)
    : value;
  const result = validateSite(candidate);
  // Migración composite-slots (docs/23 §7): sobre el sitio ya validado y
  // bien-formado, convierte los `tabs`/`accordion` props-driven viejos a slots.
  if (!result.ok) return result;
  return { ok: true, value: migrateSiteCompositeSlots(result.value) };
}

/**
 * Parsea texto JSON a `BuilderSite`. Devuelve errores en vez de lanzar:
 *  - JSON malformado → un único error de sintaxis.
 *  - Estructura inválida → los errores de `validateSite`.
 *  - Documento v1 → se migra transparentemente y se valida.
 */
export function parseSiteJson(
  text: string,
  breakpoints: BreakpointConfig = DEFAULT_BREAKPOINTS,
): ValidationResult<BuilderSite> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [`Invalid JSON: ${message}`] };
  }
  return loadSiteFromValue(parsed, breakpoints);
}
