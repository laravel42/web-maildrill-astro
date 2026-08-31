/**
 * Mapeo puro entre los locales del sitio (`site.meta.i18n.locales`, ej.
 * `["es", "en", "it"]` en `REAL_WORLD_LOCALES`) y los códigos de idioma que
 * acepta el SDK `deepl-node` (docs/51 D9).
 *
 * **Por qué existe este módulo:** el tipo `TargetLanguageCode` del SDK
 * EXCLUYE `'en'` y `'pt'` a secas — solo admite variantes regionales
 * (`'en-GB' | 'en-US'`, `'pt-BR' | 'pt-PT'`) para esos dos idiomas. Nuestros
 * locales de sitio son códigos simples (`en`, no `en-US`), así que hace
 * falta esta capa de traducción antes de llamar al proveedor. Vive en
 * `shared/` (no en `server/` ni en `src/`) porque tanto el editor (para
 * deshabilitar el botón de autocompletar en un locale no soportado, sin
 * llamar al servidor) como el servidor (para construir el `targetLang` real
 * de la request a DeepL) necesitan EXACTAMENTE la misma lógica.
 *
 * Puro: sin red, sin dependencias de `deepl-node` (evita que el bundle del
 * editor arrastre el SDK completo solo por este mapeo — el SDK real solo se
 * importa en `server/src/services/translate/deepl.ts`, docs/51 F1).
 */

/** Variante regional de inglés a usar como destino (D11, configurable por env). */
export type EnglishVariant = "en-US" | "en-GB";

/** Variante regional de portugués a usar como destino (configurable por env). */
export type PortugueseVariant = "pt-BR" | "pt-PT";

export interface DeeplLangVariants {
  en?: EnglishVariant;
  pt?: PortugueseVariant;
}

const DEFAULT_VARIANTS: Required<DeeplLangVariants> = {
  en: "en-US",
  pt: "pt-BR",
};

/**
 * Locales de sitio (código simple, minúsculas) que DeepL admite como
 * ORIGEN o DESTINO, antes de aplicar el mapeo de variante regional.
 * Verificado contra `CommonLanguageCode` + los casos especiales `en`/`pt`
 * de `deepl-node/src/types.ts` (docs/51 §1.5). Lista deliberadamente acotada
 * a los idiomas que de verdad importan hoy al proyecto (`REAL_WORLD_LOCALES`
 * + candidatos cercanos) — se amplía cuando haga falta, no especulativamente.
 */
const SUPPORTED_BASE_LOCALES = new Set([
  "es",
  "en",
  "it",
  "pt",
  "fr",
  "de",
  "nl",
  "pl",
  "ru",
  "ja",
  "zh",
]);

/** Locales cuyo destino requiere una variante regional explícita (no son destino válido "a secas"). */
const LOCALES_REQUIRING_TARGET_VARIANT = new Set(["en", "pt"]);

function normalizeLocale(locale: string): string {
  return locale.trim().toLowerCase();
}

/**
 * `true` si `locale` es un locale de sitio que DeepL admite como destino de
 * traducción (con o sin variante). La UI usa esto para deshabilitar el botón
 * de autocompletar en un locale no soportado, sin llamar al servidor
 * (docs/51 criterio de aceptación #9).
 */
export function isTranslatableTarget(locale: string): boolean {
  return SUPPORTED_BASE_LOCALES.has(normalizeLocale(locale));
}

/**
 * Lista de locales de sitio soportados como destino, en el mismo formato
 * simple que usa `site.meta.i18n.locales` (para exponer en
 * `HealthResponse.translate.supportedTargets`, docs/51 §3).
 */
export function listSupportedTargetLocales(): string[] {
  return Array.from(SUPPORTED_BASE_LOCALES).sort();
}

/**
 * Convierte un locale de sitio (`"es"`, `"en"`, `"pt"`…) al código de
 * DESTINO que acepta `deepl-node`. Devuelve `null` si el locale no es un
 * destino válido (el caller debe deshabilitar la acción, no llamar al
 * proveedor con un valor inválido).
 */
export function toDeeplTarget(locale: string, variants: DeeplLangVariants = {}): string | null {
  const normalized = normalizeLocale(locale);
  if (!SUPPORTED_BASE_LOCALES.has(normalized)) return null;

  if (normalized === "en") return variants.en ?? DEFAULT_VARIANTS.en;
  if (normalized === "pt") return variants.pt ?? DEFAULT_VARIANTS.pt;
  if (normalized === "zh") return "zh-HANS";

  return normalized;
}

/**
 * Convierte un locale de sitio al código de ORIGEN que acepta `deepl-node`.
 * A diferencia del destino, `en` y `pt` **sí** son códigos de origen válidos
 * "a secas" (§1.5) — no necesitan variante. Devuelve `null` si el locale no
 * es un origen soportado; el caller puede omitir `sourceLang` para que
 * DeepL autodetecte en ese caso.
 */
export function toDeeplSource(locale: string): string | null {
  const normalized = normalizeLocale(locale);
  return SUPPORTED_BASE_LOCALES.has(normalized) ? normalized : null;
}

/** `true` si `locale`, tal cual, requiere mapeo de variante para ser destino (informativo/debug). */
export function requiresTargetVariant(locale: string): boolean {
  return LOCALES_REQUIRING_TARGET_VARIANT.has(normalizeLocale(locale));
}
