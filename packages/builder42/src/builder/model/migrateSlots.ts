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
import {
  TESTIMONIAL_AUTHOR_STYLE,
  TESTIMONIAL_AVATAR_STYLE,
  TESTIMONIAL_CAPTION_STYLE,
  TESTIMONIAL_NAME_STYLE,
  TESTIMONIAL_QUOTE_STYLE,
  TESTIMONIAL_ROLE_STYLE,
} from "../registry/components/Testimonial";

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
 * ¿Este nodo es un `testimonial` en formato VIEJO (props-driven: `quote`,
 * `name`, `role`, `initials` planos) que hay que migrar al árbol de hijos
 * (docs, recomposición de Testimonial en componentes base)? Idempotente:
 * solo migra nodos sin `children` — un `testimonial` ya migrado los tiene.
 */
function needsTestimonialMigration(node: BuilderNode): boolean {
  return node.type === "testimonial" && (!node.children || node.children.length === 0);
}

/** Envuelve `text` en `<p>` si no ya parece HTML (mismo criterio que `valueToHtml`). */
function textToHtml(value: unknown, wrapTag: "p" | "strong" | null): string {
  const s = typeof value === "string" ? value : "";
  const trimmed = s.trim();
  if (trimmed.startsWith("<")) return s;
  if (wrapTag === null) return escapeHtml(s);
  return `<${wrapTag}>${escapeHtml(s)}</${wrapTag}>`;
}

/**
 * Migra un `testimonial` viejo in-place-sobre-clon: genera el árbol
 * `quote`/`caption(avatar+author(name,role))` a partir de sus `props`
 * actuales (`quote`, `name`, `role`, `initials`), setea `children`, borra las
 * props ya migradas, y AÑADE los nodos generados a `nodes`. Mismos ids
 * deterministas que `migrateCompositeNode` (`${node.id}-<slot>`), estables
 * para tests y sin colisiones.
 */
function migrateTestimonialNode(node: BuilderNode, nodes: Record<NodeId, BuilderNode>): void {
  const props = node.props as { quote?: unknown; name?: unknown; role?: unknown; initials?: unknown };
  const quote = typeof props.quote === "string" && props.quote !== "" ? props.quote : "Testimonio";
  const name = typeof props.name === "string" ? props.name : "";
  const role = typeof props.role === "string" ? props.role : "";
  const initials = typeof props.initials === "string" && props.initials !== "" ? props.initials : "?";

  const quoteId = `${node.id}-quote`;
  const captionId = `${node.id}-caption`;
  const avatarId = `${node.id}-avatar`;
  const authorId = `${node.id}-author`;
  const nameId = `${node.id}-name`;
  const roleId = `${node.id}-role`;

  nodes[quoteId] = seededNode("text", quoteId, { content: textToHtml(quote, "p") }, TESTIMONIAL_QUOTE_STYLE);
  nodes[nameId] = seededNode("text", nameId, { content: textToHtml(name, "strong") }, TESTIMONIAL_NAME_STYLE);
  nodes[roleId] = seededNode("text", roleId, { content: textToHtml(role, null) }, TESTIMONIAL_ROLE_STYLE);
  nodes[authorId] = seededNode("container", authorId, {}, TESTIMONIAL_AUTHOR_STYLE, [nameId, roleId]);
  nodes[avatarId] = seededNode("avatar", avatarId, { initials }, TESTIMONIAL_AVATAR_STYLE);
  nodes[captionId] = seededNode("container", captionId, {}, TESTIMONIAL_CAPTION_STYLE, [avatarId, authorId]);

  node.children = [quoteId, captionId];
  delete (node.props as { quote?: unknown }).quote;
  delete (node.props as { name?: unknown }).name;
  delete (node.props as { role?: unknown }).role;
  delete (node.props as { initials?: unknown }).initials;
}

/**
 * Migra TODOS los `tabs`/`accordion`/`testimonial` viejos de un sitio al
 * modelo children-based. Devuelve el mismo `site` si no había nada que migrar
 * (referencia estable).
 */
export function migrateSiteCompositeSlots(site: BuilderSite): BuilderSite {
  let siteChanged = false;
  const pages = { ...site.pages };

  for (const [pageId, page] of Object.entries(site.pages)) {
    const oldNodes = page.document.nodes;
    const toMigrateSlots = Object.values(oldNodes).filter(needsMigration);
    const toMigrateTestimonials = Object.values(oldNodes).filter(needsTestimonialMigration);
    if (toMigrateSlots.length === 0 && toMigrateTestimonials.length === 0) continue;

    const nodes: Record<NodeId, BuilderNode> = { ...oldNodes };
    for (const node of toMigrateSlots) {
      const clone: BuilderNode = { ...node, props: { ...node.props } };
      nodes[clone.id] = clone;
      migrateCompositeNode(clone, nodes);
    }
    for (const node of toMigrateTestimonials) {
      const clone: BuilderNode = { ...node, props: { ...node.props } };
      nodes[clone.id] = clone;
      migrateTestimonialNode(clone, nodes);
    }
    pages[pageId] = { ...page, document: { ...page.document, nodes } };
    siteChanged = true;
  }

  return siteChanged ? { ...site, pages } : site;
}
