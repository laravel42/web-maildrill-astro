/**
 * metaSegments — plan + ejecución de autocompletado de metadata SEO por
 * idioma (docs/51 §4 F6b). Extiende el mismo mecanismo de `segments.ts`/
 * `autoTranslate.ts` (F4) a `page.meta` en vez de `node.props`.
 *
 * **Por qué NO reusa el tipo `Segment`/`toSegments`/`planTranslation`/
 * `runTranslation` de F4 tal cual (docs/51 §4 F6b, decisión documentada):**
 * `Segment.nodeId: NodeId` es un alias de `string` a nivel de tipo, así que
 * un `pageId` cabría sin forzar un cast — pero `applySegments` (F4a) no es
 * solo el tipo: su lógica de reensamblado relee `document.nodes[nodeId]
 * .props[key]` para reconstruir docs Tiptap/HTML (`container: "tiptap" |
 * "html-legacy"`), y `runTranslation` firma `write: (nodeId, key, value) =>
 * void` pensado para `setNodeTranslation(nodeId, locale, key, value)` — la
 * metadata SEO no tiene nodos, no tiene richtext (todos los 6 campos de la
 * lista blanca son `container: "plain"`, prosa simple) y se escribe con
 * `setPageMetaTranslation(pageId, field, value)`, una firma distinta
 * (`field: MetaFieldPath`, no `key: string` arbitrario). Forzar el tipo
 * `Segment` completo aquí significaría rellenar `container`/`index` sin
 * sentido real y pasar por un `applySegments` que nunca ejercita sus ramas
 * richtext — abstracción que no encaja (criterio explícito del plan:
 * "prioriza corrección sobre forzar una abstracción que no encaja").
 * En cambio, SÍ se reutiliza `estimateBilledChars` (F0) para el estimado de
 * caracteres — ese es un cálculo puro sobre `string[]`, sin acoplarse a
 * nodos ni a metadata, y encaja perfecto sin adaptar nada.
 */

import { estimateBilledChars } from "../../../shared/estimateBilledChars";
import type { translateTexts } from "../apiClient";
import type { MetaFieldPath } from "../../builder/store/documentStore";

/**
 * Los 6 `MetaFieldPath` de prosa que SÍ se traducen (docs/51 §4 F6b, D13).
 * Lista blanca EXPLÍCITA — los otros 6 de la unión de 12 (`seo.canonical`,
 * `seo.robots`, `seo.openGraph.image`, `seo.openGraph.type`,
 * `seo.twitter.card`, `seo.twitter.image`) son URLs/directivas/enums y NUNCA
 * se traducen. El `slug` de la página ni siquiera es un `MetaFieldPath`
 * (nunca se traduce, docs/12 §B.9) y no aparece aquí.
 *
 * Cambiar este array es una decisión de producto, no un detalle de
 * implementación — está cubierto por un test de guarda dedicado
 * (`SeoSettings.test.tsx`) que falla si `MetaFieldPath` gana un valor nuevo
 * sin que alguien decida explícitamente si entra aquí o no.
 */
export const TRANSLATABLE_META_FIELDS: readonly MetaFieldPath[] = [
  "title",
  "description",
  "seo.openGraph.title",
  "seo.openGraph.description",
  "seo.twitter.title",
  "seo.twitter.description",
] as const;

/** Un segmento de metadata SEO pendiente de traducir (análogo simplificado a `Segment`, sin richtext). */
export interface MetaSegment {
  field: MetaFieldPath;
  /** Texto default (idioma base) a traducir. */
  text: string;
}

/** Plan de traducción de metadata: qué se manda y su costo estimado (docs/51 §4 F6b). */
export interface MetaTranslationPlan {
  /** Campos candidatos (sin traducción existente y con default no vacío). */
  segments: MetaSegment[];
  /** Textos únicos a traducir, deduplicados. */
  uniqueTexts: string[];
  estimatedChars: number;
}

/**
 * Construye el plan a partir de los valores default/traducidos ya leídos
 * por el caller (`SeoSettings.tsx`, vía `readDefault`/`readTranslation`).
 * Puro: no toca el store, no hace red.
 *
 * - Solo considera los campos de `TRANSLATABLE_META_FIELDS` (lista blanca).
 * - Un campo es candidato si el default no está vacío Y no hay traducción
 *   existente para ese campo en el locale activo (D7: no se sobreescribe).
 * - Deduplica por texto igual que `planTranslation` (F4b): dos campos con el
 *   mismo texto default se traducen una sola vez.
 */
export function planMetaTranslation(args: {
  readDefault: (field: MetaFieldPath) => string;
  readTranslation: (field: MetaFieldPath) => string | undefined;
}): MetaTranslationPlan {
  const { readDefault, readTranslation } = args;

  const segments: MetaSegment[] = [];
  for (const field of TRANSLATABLE_META_FIELDS) {
    const defaultValue = readDefault(field);
    if (defaultValue.trim() === "") continue; // nada que traducir
    const existing = readTranslation(field);
    if (existing !== undefined) continue; // D7: no se sobreescribe lo que ya existe
    segments.push({ field, text: defaultValue });
  }

  const uniqueTexts: string[] = [];
  const seen = new Set<string>();
  for (const seg of segments) {
    if (!seen.has(seg.text)) {
      seen.add(seg.text);
      uniqueTexts.push(seg.text);
    }
  }

  return { segments, uniqueTexts, estimatedChars: estimateBilledChars(uniqueTexts) };
}

/** Resultado de ejecutar la traducción de metadata (docs/51 §4 F6b). */
export interface MetaTranslationOutcome {
  /** Cantidad de campos escritos. */
  written: number;
  /** Campos que no se pudieron traducir (fallo de proveedor o ausentes de la respuesta). */
  failedSegments: MetaSegment[];
  /** Caracteres realmente facturados por el proveedor (0 si la request falló). */
  billedCharacters: number;
}

/**
 * Ejecuta la traducción de metadata: UNA request con los textos únicos del
 * plan (D4), y escribe cada campo con `write(field, value)` — el caller
 * (`SeoSettings.tsx`) la parcializa a `setPageMetaTranslation(pageId, field,
 * value)`, mismo patrón que `runTranslation` con `setNodeTranslation`.
 *
 * Manejo de fallos, mismo criterio que `runTranslation` (F4b, docs/51 #6):
 * - Fallo TOTAL de la request (la promesa de `translate` rechaza): NINGÚN
 *   campo se escribe, todos los pendientes quedan en `failedSegments`.
 * - Fallo PARCIAL (la request tuvo éxito pero algún texto no aparece en la
 *   respuesta, ej. índice fuera de rango): se escribe lo que sí llegó y el
 *   resto se marca como fallido — nunca se escribe basura.
 */
export async function runMetaTranslation(args: {
  plan: MetaTranslationPlan;
  targetLocale: string;
  sourceLocale?: string;
  translate: typeof translateTexts;
  write: (field: MetaFieldPath, value: string) => void;
}): Promise<MetaTranslationOutcome> {
  const { plan, targetLocale, sourceLocale, translate, write } = args;

  if (plan.uniqueTexts.length === 0) {
    return { written: 0, failedSegments: [], billedCharacters: 0 };
  }

  let response;
  try {
    response = await translate({
      texts: plan.uniqueTexts,
      targetLocale,
      sourceLocale,
      format: "text",
    });
  } catch {
    return { written: 0, failedSegments: plan.segments, billedCharacters: 0 };
  }

  const translatedMap = new Map<string, string>();
  plan.uniqueTexts.forEach((original, i) => {
    const result = response.translations[i];
    if (result) translatedMap.set(original, result.text);
  });

  const failedSegments: MetaSegment[] = [];
  let written = 0;
  for (const seg of plan.segments) {
    const translated = translatedMap.get(seg.text);
    if (translated === undefined) {
      failedSegments.push(seg);
      continue;
    }
    write(seg.field, translated);
    written += 1;
  }

  return { written, failedSegments, billedCharacters: response.billedCharacters };
}
