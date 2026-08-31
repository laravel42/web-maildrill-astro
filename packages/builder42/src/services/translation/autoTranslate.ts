/**
 * autoTranslate — orquesta la traducción automática de segmentos (docs/51
 * §4 F4b). Única parte de F4 con red saliente, vía `translateTexts`
 * (`services/apiClient.ts`, F3) — inyectada como dependencia, nunca
 * importada directo, para poder testear el flujo completo sin red real.
 */

import { applySegments, type Segment } from "./segments";
import { estimateBilledChars } from "../../../shared/estimateBilledChars";
import type { translateTexts } from "../apiClient";
import type { BuilderDocument, NodeId } from "../../builder/model/types";

/** Plan de traducción: qué se va a mandar y su costo estimado (docs/51 §4 F4b). */
export interface TranslationPlan {
  /** Textos únicos a traducir, deduplicados (D7 ya excluye los que tienen `existing`). */
  uniqueTexts: string[];
  /** Cantidad de segmentos que este plan cubre (antes de deduplicar). */
  segmentCount: number;
  /** Estimado local de caracteres facturables (`estimateBilledChars`, code points). */
  estimatedChars: number;
}

/**
 * Construye el plan de traducción a partir de los segmentos pendientes.
 *
 * - Filtra los segmentos que YA tienen `existing` (D7: no se re-traducen;
 *   retraducir un segmento puntual es una acción explícita de UI, fuera de
 *   F4).
 * - Deduplica el resto por `text` (2 botones "Enviar" → 1 texto único en la
 *   request — el dedup es a nivel de texto, no de segmento).
 * - `estimatedChars` se calcula sobre los textos ÚNICOS (lo que de verdad se
 *   manda a DeepL), no sobre todos los segmentos.
 *
 * Nota sobre formato de lote (docs/51 §3/§4 F4b): hoy `container` solo puede
 * ser `"plain" | "tiptap" | "html-legacy"` en la práctica (F4a no activa
 * `html-whole`), y los tres viajan como texto plano a DeepL (`format:
 * "text"`) — la segmentación en memoria ya extrajo el texto sin marcado. El
 * `format: "html"` del contrato de `TranslateRequest` solo aplicaría a un
 * futuro lote de segmentos `html-whole`; como ese contenedor no se genera
 * hoy, `planTranslation` no necesita agrupar por `container` todavía y
 * produce un único lote. Si `html-whole` se activa en el futuro, este es el
 * punto a extender (agrupar `uniqueTexts` por formato en vez de una sola
 * lista).
 */
export function planTranslation(segments: Segment[]): TranslationPlan {
  const pending = segments.filter((seg) => seg.existing === undefined);

  const uniqueTexts: string[] = [];
  const seen = new Set<string>();
  for (const seg of pending) {
    if (!seen.has(seg.text)) {
      seen.add(seg.text);
      uniqueTexts.push(seg.text);
    }
  }

  return {
    uniqueTexts,
    segmentCount: pending.length,
    estimatedChars: estimateBilledChars(uniqueTexts),
  };
}

/** Resultado de ejecutar la traducción (docs/51 §4 F4b). */
export interface TranslationOutcome {
  /** Cantidad de escrituras aplicadas (una por campo agrupado, no por segmento). */
  written: number;
  /** Segmentos que no se pudieron traducir (fallo de proveedor o sin traducción disponible). */
  failedSegments: Segment[];
  /** Caracteres realmente facturados por el proveedor (0 si la request falló). */
  billedCharacters: number;
}

/**
 * Ejecuta la traducción: llama al proveedor UNA vez con los textos únicos del
 * plan (D4), reensambla con `applySegments` y aplica cada escritura vía
 * `write` (normalmente `setNodeTranslation` parcialmente aplicado por el
 * caller, para mantener este módulo sin importar el store — docs/51 F4).
 *
 * Manejo de fallos (docs/51 criterio de aceptación #6): si `translate()`
 * lanza (p. ej. `ApiError` de rate limit/cuota/proveedor), NINGÚN segmento
 * pendiente se escribe — se capturan todos como `failedSegments` con
 * `written: 0` y `billedCharacters: 0`. Es el caso mínimo requerido ("un
 * fallo de red no rompe nada"); no se intenta reintento parcial por
 * segmento dentro de la misma request, porque `translateTexts` es una única
 * llamada HTTP atómica (todo o nada a nivel transporte) — no hay forma de
 * que la mitad de una request HTTP fallida haya "tenido éxito". Un fallo
 * PARCIAL real (algunos segmentos sin traducción utilizable) solo puede
 * ocurrir DESPUÉS de una respuesta exitosa, y ya está cubierto: `applySegments`
 * hace `SKIP` por grupo cuando el texto no aparece en el `Map` traducido, sin
 * escribir basura — ver el filtro de `failedSegments` más abajo tras un éxito.
 */
export async function runTranslation(args: {
  plan: TranslationPlan;
  segments: Segment[];
  targetLocale: string;
  sourceLocale?: string;
  translate: typeof translateTexts;
  write: (nodeId: NodeId, key: string, value: unknown) => void;
  document: BuilderDocument;
}): Promise<TranslationOutcome> {
  const { plan, segments, targetLocale, sourceLocale, translate, write, document } = args;

  const pendingSegments = segments.filter((seg) => seg.existing === undefined);

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
    // Fallo total de la request: nada se escribe, todos los pendientes
    // quedan como fallidos. Nunca se propaga la excepción (docs/51 #6).
    return { written: 0, failedSegments: pendingSegments, billedCharacters: 0 };
  }

  // El contrato (F1/F2) preserva el orden: `response.translations[i]`
  // corresponde a `plan.uniqueTexts[i]`.
  const translatedMap = new Map<string, string>();
  plan.uniqueTexts.forEach((original, i) => {
    const result = response.translations[i];
    if (result) translatedMap.set(original, result.text);
  });

  const writes = await applySegments({
    segments: pendingSegments,
    translated: translatedMap,
    document,
  });

  for (const w of writes) {
    write(w.nodeId, w.key, w.value);
  }

  // Segmentos fallidos tras una respuesta exitosa: los que no formaron parte
  // de ninguna escritura aplicada (su `(nodeId, key)` no aparece en `writes`).
  const writtenFields = new Set(writes.map((w) => `${w.nodeId}:${w.key}`));
  const failedSegments = pendingSegments.filter(
    (seg) => !writtenFields.has(`${seg.nodeId}:${seg.key}`),
  );

  return {
    written: writes.length,
    failedSegments,
    billedCharacters: response.billedCharacters,
  };
}
