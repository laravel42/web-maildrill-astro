/**
 * nodeAction — normalización de la exclusión mutua entre `node.onClick`
 * (acción de click, docs/20 §3) y los campos de props tipo `link` (navegación,
 * `LinkField`/`control: "link"`). Un nodo no debería, a la vez, navegar por
 * `href` Y ejecutar una acción de click (p. ej. abrir un modal): en export
 * ambos atributos (`href` real + `data-pb-modal-target`) terminan en el mismo
 * elemento, lo que es ambiguo para el usuario final y para el runtime.
 *
 * Funciones puras (P7): sin store, sin React. El store las usa en `setProp`
 * (al escribir un link con valor real, limpia `onClick`) y en `setNodeAction`
 * (al setear una acción, limpia los campos `link` con valor real).
 */

import type { BuilderNode, LinkTarget, NodeAction } from "./types";
import type { FieldSchema } from "../registry/types";

/**
 * Todas las acciones de click de un nodo, como lista (docs/44 §8.1 D1). Hoy
 * `node.onClick` es una acción opcional; este helper es el punto único de
 * lectura para que, si el modelo pasa a `NodeAction[]` en el futuro, ningún
 * consumidor (export, `NodeRenderer`, Inspector) necesite cambiar — ya leen a
 * través de aquí. Con el modelo actual: `[]` sin acción, `[action]` con una.
 */
export function nodeActions(node: BuilderNode): NodeAction[] {
  return node.onClick ? [node.onClick] : [];
}

/** `LinkTarget` con contenido real (no un valor "vacío" recién inicializado). */
export function linkTargetHasValue(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const link = value as Partial<LinkTarget> & { kind?: unknown };
  if (link.kind === "external") return typeof link.href === "string" && link.href.trim() !== "";
  if (link.kind === "anchor") return typeof link.nodeId === "string" && link.nodeId.trim() !== "";
  if (link.kind === "internal") return typeof link.pageId === "string" && link.pageId.trim() !== "";
  return false;
}

/** Claves de `propsSchema.fields` cuyo control es `"link"` (navegación). */
export function linkFieldKeys(fields: FieldSchema[]): string[] {
  return fields.filter((f) => f.control === "link").map((f) => f.key);
}

/** Claves de props de un nodo con un `link` que tiene valor real, según su schema. */
export function activeLinkKeys(node: BuilderNode, fields: FieldSchema[]): string[] {
  return linkFieldKeys(fields).filter((key) => linkTargetHasValue(node.props[key]));
}
