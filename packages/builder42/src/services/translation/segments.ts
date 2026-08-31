/**
 * segments — descomposición pura de un `BuilderDocument` en segmentos de
 * texto plano traducibles, y reensamblado de las traducciones de vuelta a
 * props (docs/51 §2.1, F4a).
 *
 * PURO por diseño (docs/51 §4 F4a): sin `fetch`, sin Zustand/`useDocumentStore`,
 * sin mutar los argumentos de entrada. `toSegments`/`applySegments` devuelven
 * datos; el caller (`autoTranslate.ts`, y eventualmente la UI de F5) decide
 * cómo aplicarlos al store real vía `setNodeTranslation` (`store/slices/props.ts`,
 * que este módulo NO importa a propósito).
 */

import {
  collectTextNodes,
  contentToHtml,
  htmlToContent,
  isTiptapDoc,
  isLegacyHtml,
  translateDocWithProvider,
  buildLookupTranslateFn,
  type TiptapDoc,
} from "../../builder/model/richtext";
import { getDefinition } from "../../builder/registry/componentRegistry";
import type { BuilderDocument, BuilderNode, NodeId, NodeTranslations } from "../../builder/model/types";

/**
 * Un segmento de texto plano traducible (docs/51 §2.1). Es la unidad que se
 * muestra en la tabla de F5, se manda a DeepL y se cuenta para el presupuesto.
 */
export interface Segment {
  nodeId: NodeId;
  key: string;
  /** Índice del segmento dentro del campo. 0 para campos de un solo segmento. */
  index: number;
  /** Texto plano a traducir (sin marcado). */
  text: string;
  /** Cómo se reensambla al escribir de vuelta (docs/51 §2.1 tabla). */
  container: "plain" | "tiptap" | "html-legacy" | "html-whole";
  /** Traducción existente en el locale destino para este CAMPO, si hay. */
  existing?: string;
}

/** Nombre del `control` del `propsSchema` que identifica un campo rich text (docs/12 §B.11, TranslationModal.tsx). */
const RICHTEXT_CONTROL = "richtext";

/**
 * Recorre el árbol del documento en PREORDEN real, siguiendo `node.children`
 * en el orden en que aparecen — a propósito NO usa el patrón de
 * `collectSubtree` (`model/tree.ts`), que apila con `stack.push(...children)`
 * seguido de `stack.pop()`: eso visita los hijos en orden INVERSO al que
 * declaran (el último hijo se apila último pero se sacan LIFO). Aquí el
 * orden de documento es observable por el usuario (docs/51 §6 "Orden de la
 * tabla ≠ orden visual"), así que se usa recursión que preserva el orden de
 * `children` tal cual.
 */
function walkInDocumentOrder(document: BuilderDocument): BuilderNode[] {
  const result: BuilderNode[] = [];
  const visit = (nodeId: NodeId) => {
    const node = document.nodes[nodeId];
    if (!node) return; // árbol inconsistente (ref colgante) — se ignora, no se lanza
    result.push(node);
    for (const childId of node.children ?? []) {
      visit(childId);
    }
  };
  visit(document.rootId);
  return result;
}

/** `true` si `raw` no tiene contenido traducible (docs/51 §4 F4a: SKIP sin generar segmento). */
function isBlank(raw: unknown): boolean {
  if (raw == null) return true;
  if (typeof raw === "string" && raw.trim() === "") return true;
  return false;
}

/**
 * Descompone la página en segmentos ordenados (docs/51 §2.1), marcando qué
 * ya tiene traducción en `targetLocale` (`existing`).
 *
 * - Recorre en orden de ÁRBOL (`walkInDocumentOrder`), no en el orden del
 *   `Record` de `document.nodes` (hallazgo real de docs/51 §6).
 * - Solo campos `translatable: true` del `propsSchema` de cada tipo.
 * - Campos vacíos/`null` no generan segmento (nada que traducir).
 * - Campo richtext (`control: "richtext"`): se segmenta en N textos vía
 *   `collectTextNodes`, aceptando tanto JSON Tiptap (`container: "tiptap"`)
 *   como HTML legacy (`container: "html-legacy"`, vía `htmlToContent` primero).
 * - Cualquier otro campo traducible: 1 segmento `container: "plain"`.
 * - Fallback `html-whole` (docs/51 D6): documentado pero NO activado aquí.
 *   El round-trip `HTML → TiptapDoc → HTML` fue medido lossless en F0 para
 *   HTML bien formado con bloque envolvente (`richtext.test.ts`); los dos
 *   casos no-1:1 conocidos (inline suelto sin `<p>`, `href` que gana
 *   `target`/`rel`) son normalización esperada, no pérdida de contenido
 *   (docs/51 §6). Si en el futuro aparece un caso real donde
 *   `collectTextNodes` produce segmentos sin sentido, ese es el punto para
 *   activar `html-whole` — no se anticipa especulativamente.
 */
export function toSegments(args: {
  document: BuilderDocument;
  translations: Record<NodeId, NodeTranslations> | undefined;
  targetLocale: string;
  defaultLocale: string;
}): Segment[] {
  const { document, translations, targetLocale, defaultLocale } = args;

  // docs/51 D7/F4a: autocompletar solo rellena locales que NO son el default;
  // el default vive en `props` directamente, nunca en `translations`. Un
  // caller que pase `targetLocale === defaultLocale` no tiene nada que
  // segmentar contra sí mismo — se documenta con este comentario en vez de
  // lanzar, para no forzar a cada caller (UI de F5, tests) a evitar ese caso
  // con un guard propio; simplemente no habrá `existing` que consultar y el
  // resultado seguirá siendo correcto (aunque inútil) si ocurre por error.
  if (targetLocale === defaultLocale) {
    return [];
  }

  const segments: Segment[] = [];

  for (const node of walkInDocumentOrder(document)) {
    const def = getDefinition(node.type);
    if (!def) continue;

    for (const field of def.propsSchema.fields) {
      if (!field.translatable) continue;

      const raw = node.props[field.key];
      if (isBlank(raw)) continue;

      // docs/51 §2.1: para campos richtext con múltiples segmentos, la
      // traducción existente es UN valor completo (el HTML/JSON ya
      // traducido para ese campo), no por segmento. Si existe traducción
      // completa para (nodeId, key) en targetLocale, TODOS los segmentos de
      // ese campo se marcan con `existing` (no se retraducen — D7; retraducir
      // un campo puntual es una acción explícita de UI, fuera de F4).
      const existingValue = translations?.[node.id]?.[targetLocale]?.[field.key];
      const existing = existingValue == null ? undefined : String(existingValue);

      if (field.control !== RICHTEXT_CONTROL) {
        segments.push({
          nodeId: node.id,
          key: field.key,
          index: 0,
          text: String(raw),
          container: "plain",
          existing,
        });
        continue;
      }

      // Campo richtext: JSON Tiptap o HTML legacy (docs/13, docs/51 D6).
      let doc: TiptapDoc;
      let container: Segment["container"];
      if (isTiptapDoc(raw)) {
        doc = raw;
        container = "tiptap";
      } else if (isLegacyHtml(raw)) {
        doc = htmlToContent(raw);
        container = "html-legacy";
      } else {
        // Forma inesperada (ni string ni TiptapDoc) — no hay nada seguro que
        // segmentar; se omite en vez de lanzar (mismo criterio defensivo que
        // el resto del modelo de i18n, `resolvePropsForLocale`).
        continue;
      }

      const texts = collectTextNodes(doc);
      texts.forEach((text, index) => {
        segments.push({
          nodeId: node.id,
          key: field.key,
          index,
          text,
          container,
          existing,
        });
      });
    }
  }

  return segments;
}

/** Agrupa segmentos por `(nodeId, key)`, preservando el orden de aparición. */
function groupByField(segments: Segment[]): Map<string, Segment[]> {
  const groups = new Map<string, Segment[]>();
  for (const seg of segments) {
    const groupKey = `${seg.nodeId}:${seg.key}`;
    const group = groups.get(groupKey);
    if (group) group.push(seg);
    else groups.set(groupKey, [seg]);
  }
  return groups;
}

/**
 * Reensambla los segmentos traducidos por campo y devuelve las escrituras a
 * aplicar (docs/51 §4 F4a). No escribe nada por sí mismo — el caller aplica
 * cada `{ nodeId, key, value }` vía `setNodeTranslation` (o el store real).
 *
 * Async: el camino `tiptap`/`html-legacy` reutiliza `translateDocWithProvider`
 * (ya `async` desde F0) en vez de reimplementar el recorrido del árbol Tiptap
 * — evita duplicar la lógica que ya recorre `TiptapNode[]` recursivamente.
 *
 * - `container: "plain"`: si el texto original no está en `translated`, el
 *   grupo se SKIPea por completo (un fallo parcial no debe escribir basura).
 * - `container: "tiptap" | "html-legacy"`: relee `document.nodes[nodeId]
 *   .props[key]` para recuperar el doc/HTML ORIGINAL (los segmentos solo
 *   traen texto plano, no el árbol), lo traduce con
 *   `translateDocWithProvider` + `buildLookupTranslateFn(translated)` (que
 *   devuelve el texto original si falta la clave — nunca lanza ni corrompe),
 *   y en `html-legacy` reconvierte con `contentToHtml` antes de escribir
 *   (el campo se guarda como HTML string, igual que estaba — docs/51 D6).
 * - `container: "html-whole"`: no se genera desde `toSegments` (no
 *   implementado activamente hoy); si algún caller lo produjera de todas
 *   formas, el caso trivial (1 segmento) se resuelve con el texto traducido
 *   tal cual, sin reconversión — no se activa en la práctica.
 */
export async function applySegments(args: {
  segments: Segment[];
  translated: Map<string, string>;
  document: BuilderDocument;
}): Promise<Array<{ nodeId: NodeId; key: string; value: unknown }>> {
  const { segments, translated, document } = args;
  const writes: Array<{ nodeId: NodeId; key: string; value: unknown }> = [];

  for (const [, group] of groupByField(segments)) {
    const first = group[0];
    if (!first) continue;
    const { nodeId, key, container } = first;

    if (container === "plain") {
      const translatedText = translated.get(first.text);
      if (translatedText === undefined) continue; // sin traducción disponible: no se escribe basura
      writes.push({ nodeId, key, value: translatedText });
      continue;
    }

    if (container === "html-whole") {
      // No activado hoy (docs/51 D6) — caso trivial documentado por si algún
      // caller futuro lo produce: 1 segmento, se escribe tal cual traducido.
      const translatedText = translated.get(first.text);
      if (translatedText === undefined) continue;
      writes.push({ nodeId, key, value: translatedText });
      continue;
    }

    // container === "tiptap" | "html-legacy": releer el valor original del
    // documento para reconstruir el doc completo (toSegments solo dio texto
    // plano por segmento, no el árbol).
    const rawOriginal = document.nodes[nodeId]?.props[key];
    if (rawOriginal == null) continue;

    let originalDoc: TiptapDoc;
    if (container === "tiptap") {
      if (!isTiptapDoc(rawOriginal)) continue; // desalineado con lo esperado — no se escribe basura
      originalDoc = rawOriginal;
    } else {
      if (!isLegacyHtml(rawOriginal)) continue;
      originalDoc = htmlToContent(rawOriginal);
    }

    const translatedDoc = await translateDocWithProvider(
      originalDoc,
      "", // targetLang no se usa dentro de buildLookupTranslateFn (solo mira el Map)
      buildLookupTranslateFn(translated),
    );

    if (container === "tiptap") {
      writes.push({ nodeId, key, value: translatedDoc });
    } else {
      writes.push({ nodeId, key, value: contentToHtml(translatedDoc) });
    }
  }

  return writes;
}
