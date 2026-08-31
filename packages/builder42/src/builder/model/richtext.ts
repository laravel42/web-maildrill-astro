/**
 * richtext — modelo y conversiones puras para `props.content` del componente
 * `text` (docs/13). Migración de HTML string a JSON Tiptap, retrocompatible:
 * `props.content` sigue siendo `unknown` en el schema (`types.ts` no cambia,
 * docs/13 §5) y acepta AMBOS formatos indefinidamente — no hay migración
 * obligatoria de documentos existentes.
 *
 * **Por qué este módulo es puro (P7) y server-safe (P8):** usa `@tiptap/html`
 * (no `@tiptap/core`), que internamente usa un DOM virtual (`linkedom`,
 * bundlado por el propio paquete) en vez de requerir un navegador real — a
 * diferencia de `@tiptap/core`, que solo funciona en browser. Esto es lo que
 * permite que `contentToHtml` se llame desde `export/exportToHtml.ts` (que
 * corre también en Node vía `/server/`, docs/33) sin jsdom externo ni acceso
 * a `document`. Ningún componente de `registry/components/**` importa este
 * módulo directamente en su rama `exportMode` de forma que rompa P8: la única
 * dependencia de Tiptap que viaja al bundle de export es esta conversión
 * puro-JS, nunca el editor interactivo (`@tiptap/react`, `TiptapEditor.tsx`).
 *
 * **Extensions compartidas:** la misma lista (`RICHTEXT_EXTENSIONS`) la usan
 * el editor interactivo (`src/components/TiptapEditor.tsx`) y este conversor,
 * para que `generateHTML`/`generateJSON` entiendan exactamente el mismo
 * schema de nodos/marks que el usuario pudo haber creado en el canvas (si
 * difieren, un nodo desconocido se pierde silenciosamente al convertir).
 */

import { generateHTML, generateJSON } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { AnyExtension } from "@tiptap/core";

// ---------------------------------------------------------------------------
// Tipos del documento Tiptap (subconjunto de ProseMirror JSON que nos importa)
// ---------------------------------------------------------------------------

export interface TiptapMark {
  type: string; // "bold", "italic", "link", …
  attrs?: Record<string, unknown>; // { href: "…" } para link
}

export interface TiptapNode {
  type: string; // "doc", "heading", "paragraph", "text", "bulletList", …
  attrs?: Record<string, unknown>; // { level: 2 } para heading
  content?: TiptapNode[]; // hijos
  text?: string; // solo presente en nodos type:"text"
  marks?: TiptapMark[];
}

export interface TiptapDoc extends TiptapNode {
  type: "doc";
  content: TiptapNode[];
}

/** Forma que puede tener `props.content` del componente `text` hoy. */
export type RichTextContent = string | TiptapDoc;

// ---------------------------------------------------------------------------
// Extensions compartidas (editor interactivo + conversión server-safe)
// ---------------------------------------------------------------------------

/**
 * Mismo criterio que `TiptapEditor.tsx`: StarterKit sin su Link propio (se
 * desactiva `link: false`) para usar la extensión `Link` configurada aparte.
 * `openOnClick: false` no afecta el HTML generado por `generateHTML` (solo
 * el comportamiento interactivo en el editor), pero se replica la MISMA
 * configuración que usa el editor para que ambos consumidores de la
 * extensión queden inequívocamente sincronizados si en el futuro cambia
 * alguna opción que sí afecte el output (p. ej. `HTMLAttributes`).
 */
export const RICHTEXT_EXTENSIONS: AnyExtension[] = [
  StarterKit.configure({ link: false }),
  Link.configure({ openOnClick: false }),
];

// ---------------------------------------------------------------------------
// Detección de formato
// ---------------------------------------------------------------------------

/** `true` si `value` es el formato legacy: HTML string plano. */
export function isLegacyHtml(value: unknown): value is string {
  return typeof value === "string";
}

/** `true` si `value` tiene la forma de un documento Tiptap (`{ type: "doc", content: [...] }`). */
export function isTiptapDoc(value: unknown): value is TiptapDoc {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).type === "doc" &&
    Array.isArray((value as Record<string, unknown>).content)
  );
}

// ---------------------------------------------------------------------------
// Conversión (ambos sentidos), pura y server-safe
// ---------------------------------------------------------------------------

/**
 * Convierte `content` (JSON Tiptap o HTML legacy) a HTML string. Server-safe
 * (P8): la usan tanto `Text.stub.tsx` (rama `exportMode`) como
 * `export/exportToHtml.ts`. Si ya es string (legacy), se devuelve tal cual
 * — cero costo de conversión para documentos no migrados.
 */
export function contentToHtml(content: RichTextContent): string {
  if (isLegacyHtml(content)) return content;
  return generateHTML(content, RICHTEXT_EXTENSIONS);
}

/**
 * Convierte HTML string a JSON Tiptap. Server-safe (misma garantía que
 * `contentToHtml`). Se usa para migrar un documento legacy a JSON bajo
 * demanda (lazy, docs/13 §4.5) — nunca de forma obligatoria/automática.
 */
export function htmlToContent(html: string): TiptapDoc {
  return generateJSON(html, RICHTEXT_EXTENSIONS) as TiptapDoc;
}

// ---------------------------------------------------------------------------
// Detección de nodos sin traducir (docs/13 §3.2)
// ---------------------------------------------------------------------------

/**
 * Compara los nodos de nivel 1 (hijos directos de `doc` — párrafos,
 * headings, listas…) entre el documento base y su traducción, por posición.
 * Devuelve los índices de los nodos IDÉNTICOS al base — candidatos a "sin
 * traducir" (nadie los tocó tras copiarse desde el base).
 *
 * Deliberadamente posicional y no semántico: no intenta emparejar nodos que
 * cambiaron de posición (reordenar párrafos no es "traducir"), coherente con
 * el resto del modelo de traducciones (`i18nContent.ts`), que resuelve campo
 * a campo sin diffing profundo.
 *
 * Si `translation` tiene MENOS nodos de nivel 1 que `base` (aún no se copió
 * la estructura), los índices faltantes también cuentan como "sin traducir"
 * — evita falsos negativos cuando una traducción quedó incompleta.
 */
export function untranslatedNodes(base: TiptapDoc, translation: TiptapDoc): number[] {
  const result: number[] = [];
  for (let i = 0; i < base.content.length; i++) {
    const baseNode = base.content[i];
    const translatedNode = translation.content[i];
    if (translatedNode === undefined || deepEqualNode(baseNode, translatedNode)) {
      result.push(i);
    }
  }
  return result;
}

function deepEqualNode(a: TiptapNode | undefined, b: TiptapNode | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ---------------------------------------------------------------------------
// Merge inteligente de estructura al traducir (docs/13 §3.3)
// ---------------------------------------------------------------------------

/**
 * Placeholder insertado en una traducción cuando el idioma base ganó un nodo
 * nuevo de nivel 1 que la traducción todavía no tiene. Reutiliza el propio
 * nodo del base (misma estructura/marks) — así el contenido no traducido
 * sigue siendo legible en vez de quedar vacío, y `untranslatedNodes` lo
 * detecta como pendiente en la próxima pasada (es idéntico al base).
 */
function placeholderFrom(baseNode: TiptapNode): TiptapNode {
  return baseNode;
}

/**
 * Sincroniza la ESTRUCTURA de `translation` con la de `base` cuando el
 * usuario agrega contenido nuevo al idioma base (docs/13 §3.3): inserta un
 * placeholder (copia del nodo base) en cada posición de nivel 1 que existe
 * en `base` pero no en `translation`, preservando el resto de la traducción
 * intacta (nunca sobreescribe un nodo ya traducido).
 *
 * Pura: no muta ninguno de los dos documentos de entrada, devuelve un
 * `TiptapDoc` nuevo. El caller decide cuándo invocarla (p. ej. al detectar,
 * vía `untranslatedNodes` o un diff de longitud, que el base creció).
 */
export function mergeTranslationStructure(base: TiptapDoc, translation: TiptapDoc): TiptapDoc {
  const mergedContent: TiptapNode[] = base.content.map((baseNode, i) => {
    const existing = translation.content[i];
    return existing !== undefined ? existing : placeholderFrom(baseNode);
  });
  return { ...translation, content: mergedContent };
}

// ---------------------------------------------------------------------------
// Hook de traducción por nodo — SIN proveedor real conectado (docs/13 §3.1)
// ---------------------------------------------------------------------------

/**
 * Función de traducción inyectable: recibe el texto plano de un nodo
 * `type:"text"` y el idioma destino, devuelve el texto traducido (o una
 * Promise, para acomodar proveedores async como una API de LLM/DeepL).
 *
 * **Sin implementación real en esta sesión** (petición explícita del
 * usuario, T2 fase 3 de `AGENTS.md`): conectar un proveedor real (DeepL, un
 * LLM vía el backend de `/server/`, docs/33) queda para una sesión futura.
 * Este tipo es el contrato que ese proveedor deberá cumplir.
 */
export type TranslateFn = (text: string, targetLang: string) => string | Promise<string>;

/**
 * Recorre `doc` y aplica `translateFn` únicamente a los nodos `type:"text"`
 * con `text` no vacío, preservando 1:1 el resto de la estructura (headings
 * siguen headings, listas siguen listas, marks intactos — docs/13 §3.1). No
 * traduce `attrs` (p. ej. `href` de un link) — fuera de alcance por diseño.
 *
 * Async porque `translateFn` puede ser async (proveedor real de traducción);
 * con la implementación por defecto (identidad, ver `identityTranslateFn`)
 * se resuelve igual de síncrono en la práctica.
 */
export async function translateDocWithProvider(
  doc: TiptapDoc,
  targetLang: string,
  translateFn: TranslateFn,
): Promise<TiptapDoc> {
  const translatedContent = await translateNodes(doc.content, targetLang, translateFn);
  return { ...doc, content: translatedContent };
}

async function translateNodes(
  nodes: TiptapNode[],
  targetLang: string,
  translateFn: TranslateFn,
): Promise<TiptapNode[]> {
  return Promise.all(
    nodes.map(async (node) => {
      if (node.type === "text" && node.text) {
        return { ...node, text: await translateFn(node.text, targetLang) };
      }
      if (node.content) {
        return { ...node, content: await translateNodes(node.content, targetLang, translateFn) };
      }
      return node;
    }),
  );
}

/**
 * `TranslateFn` de referencia que NO traduce (identidad) — útil como default
 * seguro en tests o mientras no hay proveedor real conectado (evita que un
 * caller olvide pasar `translateFn` y rompa en runtime).
 */
export const identityTranslateFn: TranslateFn = (text) => text;

// ---------------------------------------------------------------------------
// Recolección de segmentos de texto plano (docs/51 F0/D5/D6)
// ---------------------------------------------------------------------------

/**
 * Recorre `doc` y devuelve el texto de cada nodo `type:"text"` no vacío, EN
 * EL MISMO ORDEN que `translateDocWithProvider` los visita y traduce
 * (invariante que protege docs/51 §2.1: la tabla de segmentos y el envío al
 * proveedor deben coincidir en orden con el árbol Tiptap real).
 *
 * Pura, sin dependencias de red — es el primer paso de la segmentación
 * (docs/51 D5): un campo `text.content` en JSON se descompone en N
 * segmentos vía esta función; el HTML legacy pasa primero por
 * `htmlToContent` y luego por esta misma función (D6).
 */
export function collectTextNodes(doc: TiptapDoc): string[] {
  return collectFromNodes(doc.content);
}

function collectFromNodes(nodes: TiptapNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    if (node.type === "text" && node.text) {
      result.push(node.text);
    } else if (node.content) {
      result.push(...collectFromNodes(node.content));
    }
  }
  return result;
}

/**
 * Construye una `TranslateFn` que resuelve desde un `Map` en memoria
 * (texto original → texto traducido) en vez de llamar a un proveedor async
 * por nodo (docs/51 D4: una sola request por lote, no N por segmento).
 *
 * Si el texto no está en `map` (no se envió a traducir, p. ej. porque ya
 * tenía traducción existente y D7 lo excluyó del lote), devuelve el texto
 * original sin lanzar — mismo criterio de seguridad que
 * `identityTranslateFn`, para que un desalineamiento entre lo recolectado y
 * lo traducido nunca corrompa el documento, solo deje ese fragmento sin
 * traducir.
 */
export function buildLookupTranslateFn(map: Map<string, string>): TranslateFn {
  return (text: string) => map.get(text) ?? text;
}
