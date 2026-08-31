/**
 * Migración composite-slots (docs/23 §7) — retrocompat P1.
 *
 * Convierte los `tabs`/`accordion` en el formato VIEJO (props-driven:
 * `props.items: [{ label, value }]`, `value` = string plano) al modelo nuevo
 * children-based: cada ítem pasa a ser un nodo de slot (`tab`/`accordion-item`)
 * con `props.label` y un hijo `text` con el `value` como HTML. Puro y
 * determinista (P7): ids derivados del id del composite → estables para tests y
 * sin colisiones (los ids originales son únicos). Idempotente: solo migra nodos
 * que aún tienen `items` y no tienen `children` (los ya migrados se ignoran).
 */

import type { BuilderNode, BuilderSite, NodeId, NodeStyle } from "./types";
import { TAB_DEFAULT_STYLE } from "../registry/components/Tab";
import { ACCORDION_ITEM_DEFAULT_STYLE } from "../registry/components/AccordionItem";

interface OldItem {
  label?: unknown;
  value?: unknown;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** ¿Este nodo es un composite en formato viejo que hay que migrar? */
function needsMigration(node: BuilderNode): boolean {
  return (
    (node.type === "tabs" || node.type === "accordion") &&
    Array.isArray((node.props as { items?: unknown }).items) &&
    (!node.children || node.children.length === 0)
  );
}

/** Crea un nodo con id/props deterministas y el estilo por defecto del tipo. */
function seededNode(
  type: string,
  id: NodeId,
  props: Record<string, unknown>,
  style: NodeStyle,
  children?: NodeId[],
): BuilderNode {
  const n: BuilderNode = { id, type, props, style: structuredClone(style) };
  if (children) n.children = children;
  return n;
}

const TEXT_STYLE: NodeStyle = { base: {} };

/** `value` plano → HTML de párrafo; si ya parece HTML, se respeta. */
function valueToHtml(value: unknown): string {
  const s = typeof value === "string" ? value : "";
  const trimmed = s.trim();
  if (trimmed.startsWith("<")) return s; // ya es HTML
  return `<p>${escapeHtml(s)}</p>`;
}

/**
 * Migra un nodo composite viejo in-place-sobre-clon: setea `children` a nuevas
 * slots, borra `props.items`/`openFirst`, y AÑADE las slots + su `text` a
 * `nodes`. `node` ya debe ser un clon con `props` clonado.
 */
function migrateCompositeNode(node: BuilderNode, nodes: Record<NodeId, BuilderNode>): void {
  const itemType = node.type === "tabs" ? "tab" : "accordion-item";
  const items = ((node.props as { items?: OldItem[] }).items ?? []) as OldItem[];
  const openFirst = (node.props as { openFirst?: unknown }).openFirst !== false; // default true

  const slotIds: NodeId[] = items.map((item, i) => {
    const slotId = `${node.id}-slot-${i}`;
    const textId = `${slotId}-c`;
    const label = typeof item?.label === "string" ? item.label : String(item?.label ?? "");
    nodes[textId] = seededNode("text", textId, { content: valueToHtml(item?.value) }, TEXT_STYLE);

    const slotProps: Record<string, unknown> = { label };
    const slotStyle = node.type === "tabs" ? TAB_DEFAULT_STYLE : ACCORDION_ITEM_DEFAULT_STYLE;
    if (node.type === "accordion") slotProps.openByDefault = openFirst && i === 0;
    nodes[slotId] = seededNode(itemType, slotId, slotProps, slotStyle, [textId]);
    return slotId;
  });

  node.children = slotIds;
  delete (node.props as { items?: unknown }).items;
  delete (node.props as { openFirst?: unknown }).openFirst;
}

/**
 * Migra TODOS los `tabs`/`accordion` viejos de un sitio al modelo de slots.
 * Devuelve el mismo `site` si no había nada que migrar (referencia estable).
 */
export function migrateSiteCompositeSlots(site: BuilderSite): BuilderSite {
  let siteChanged = false;
  const pages = { ...site.pages };

  for (const [pageId, page] of Object.entries(site.pages)) {
    const oldNodes = page.document.nodes;
    const toMigrate = Object.values(oldNodes).filter(needsMigration);
    if (toMigrate.length === 0) continue;

    const nodes: Record<NodeId, BuilderNode> = { ...oldNodes };
    for (const node of toMigrate) {
      const clone: BuilderNode = { ...node, props: { ...node.props } };
      nodes[clone.id] = clone;
      migrateCompositeNode(clone, nodes);
    }
    pages[pageId] = { ...page, document: { ...page.document, nodes } };
    siteChanged = true;
  }

  return siteChanged ? { ...site, pages } : site;
}
