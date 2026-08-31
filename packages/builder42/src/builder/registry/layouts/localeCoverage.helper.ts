/**
 * Helper de TEST (no productivo, docs/42) para las plantillas de página con
 * contenido real: comprueba que un `NodeFragment` trae traducidas TODAS las
 * props marcadas `translatable: true` en el `propsSchema` de su componente,
 * para cada locale declarado por la plantilla.
 *
 * No lo importa nada del bundle productivo — solo archivos `*.test.ts`. Vive
 * fuera de un `*.test.ts` a propósito: varias plantillas comparten estas
 * aserciones y duplicarlas por archivo sería copiar-pegar puro.
 */

import type { NodeFragment } from "../../model/tree";
import { getDefinition } from "../componentRegistry";

/** Props traducibles con valor no vacío de un nodo, según su `propsSchema`. */
function translatableKeysWithValue(type: string, props: Record<string, unknown>): string[] {
  const def = getDefinition(type);
  if (!def) return [];
  return (def.propsSchema.fields ?? [])
    .filter((f) => f.translatable === true)
    .map((f) => f.key)
    .filter((key) => {
      const value = props[key];
      return typeof value === "string" && value.trim() !== "";
    });
}

/**
 * Rutas `nodeId.locale.propKey` que faltan en `fragment.translations`.
 * Vacío = cobertura total de contenido traducible para esos locales.
 */
export function missingTranslations(fragment: NodeFragment, locales: string[]): string[] {
  const missing: string[] = [];
  const translations = fragment.translations ?? {};
  for (const node of Object.values(fragment.nodes)) {
    const keys = translatableKeysWithValue(node.type, node.props);
    if (keys.length === 0) continue;
    for (const locale of locales) {
      for (const key of keys) {
        const value = translations[node.id]?.[locale]?.[key];
        if (typeof value !== "string" || value.trim() === "") {
          missing.push(`${node.id}.${locale}.${key}`);
        }
      }
    }
  }
  return missing;
}

/** Ids de nodo con un color/fondo hardcodeado en `style` (deben ser tokens). */
export function hardcodedColorNodes(fragment: NodeFragment): string[] {
  return Object.values(fragment.nodes)
    .filter((node) => {
      const json = JSON.stringify(node.style);
      return (
        /"(color|background|borderColor)"\s*:\s*"#[0-9a-fA-F]{3,8}"/.test(json) ||
        /"(color|background|borderColor)"\s*:\s*"(rgb|hsl)a?\(/.test(json)
      );
    })
    .map((node) => node.id);
}

/** Ids de nodo huérfanos (no alcanzables desde `rootId` por `children`). */
export function unreachableNodes(fragment: NodeFragment): string[] {
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    for (const child of fragment.nodes[id]?.children ?? []) walk(child);
  };
  walk(fragment.rootId);
  return Object.keys(fragment.nodes).filter((id) => !seen.has(id));
}
