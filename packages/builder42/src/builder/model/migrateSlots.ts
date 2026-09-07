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
import { STAT_LABEL_STYLE, STAT_VALUE_STYLE } from "../registry/components/Stat";
import { QUOTE_ATTRIBUTION_STYLE, QUOTE_CONTENT_STYLE } from "../registry/components/Quote";
import { NAVBAR_BRAND_STYLE } from "../registry/components/Navbar";
import {
  PRICING_BADGE_STYLE,
  PRICING_CTA_STYLE,
  PRICING_FEATURE_STYLE,
  PRICING_FEATURE_TEXT_STYLE,
  PRICING_FEATURES_STYLE,
  PRICING_PERIOD_STYLE,
  PRICING_PLAN_STYLE,
  PRICING_PRICE_ROW_STYLE,
  PRICING_PRICE_STYLE,
} from "../registry/components/PricingCard";

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
 * ¿Este nodo es un `quote` en formato VIEJO (props-driven: `content`,
 * `attribution` planos) que hay que migrar al árbol de hijos (docs,
 * recomposición de Quote en componentes base)? Idempotente: solo migra nodos
 * sin `children` — un `quote` ya migrado los tiene.
 */
function needsQuoteMigration(node: BuilderNode): boolean {
  return node.type === "quote" && (!node.children || node.children.length === 0);
}

/**
 * Migra un `quote` viejo in-place-sobre-clon: genera el árbol
 * `content`/`attribution` a partir de sus `props` actuales (`content`,
 * `attribution`), setea `children`, borra las props ya migradas, y AÑADE los
 * nodos generados a `nodes`. Mismos ids deterministas que
 * `migrateTestimonialNode` (`${node.id}-<slot>`), estables para tests y sin
 * colisiones.
 */
function migrateQuoteNode(node: BuilderNode, nodes: Record<NodeId, BuilderNode>): void {
  const props = node.props as { content?: unknown; attribution?: unknown };
  const content = typeof props.content === "string" && props.content !== "" ? props.content : "Cita de ejemplo";
  const attribution = typeof props.attribution === "string" ? props.attribution : "";

  const contentId = `${node.id}-content`;
  const attributionId = `${node.id}-attribution`;

  nodes[contentId] = seededNode("text", contentId, { content: textToHtml(content, "p") }, QUOTE_CONTENT_STYLE);
  node.children = [contentId];

  if (attribution !== "") {
    nodes[attributionId] = seededNode(
      "text",
      attributionId,
      { content: `<cite>— ${escapeHtml(attribution)}</cite>` },
      QUOTE_ATTRIBUTION_STYLE,
    );
    node.children.push(attributionId);
  }

  delete (node.props as { content?: unknown }).content;
  delete (node.props as { attribution?: unknown }).attribution;
}

/**
 * ¿Este nodo es un `stat` en formato VIEJO (props-driven: `value`, `label`
 * planos) que hay que migrar al árbol de hijos (docs, recomposición de Stat
 * en componentes base)? Idempotente: solo migra nodos sin `children`.
 */
function needsStatMigration(node: BuilderNode): boolean {
  return node.type === "stat" && (!node.children || node.children.length === 0);
}

/**
 * Migra un `stat` viejo in-place-sobre-clon: genera el árbol
 * `stat-value`/`text(label)` a partir de sus `props` actuales, setea
 * `children`, borra las props ya migradas, y AÑADE los nodos generados a
 * `nodes`. Mismos ids deterministas que `migrateTestimonialNode`
 * (`${node.id}-<slot>`).
 */
function migrateStatNode(node: BuilderNode, nodes: Record<NodeId, BuilderNode>): void {
  const props = node.props as { value?: unknown; label?: unknown };
  const value = typeof props.value === "string" && props.value !== "" ? props.value : "0";
  const label = typeof props.label === "string" ? props.label : "";

  const valueId = `${node.id}-value`;
  const labelId = `${node.id}-label`;

  nodes[valueId] = seededNode("stat-value", valueId, { value }, STAT_VALUE_STYLE);
  nodes[labelId] = seededNode("text", labelId, { content: label }, STAT_LABEL_STYLE);

  node.children = [valueId, labelId];
  delete (node.props as { value?: unknown }).value;
  delete (node.props as { label?: unknown }).label;
}

/**
 * ¿Este nodo es un `navbar` en formato VIEJO cuyos `children` NO son
 * exactamente `[un container]` (el nuevo wrapper del brand, ver
 * `NAVBAR_BRAND_STYLE` en `registry/components/Navbar.tsx`)? Cubre dos
 * casos: (a) `children` vacío/ausente (navbar sin logo aún), que NO necesita
 * envoltura — se deja tal cual, el usuario arrastra su `container` cuando
 * quiera; (b) `children` con contenido pero NO envuelto (logo suelto directo,
 * formato viejo pre-rework) — ESE es el caso que hay que envolver. Idempotente:
 * si ya hay exactamente un hijo de tipo `container`, se asume ya migrado.
 */
function needsNavbarWrapMigration(node: BuilderNode, nodes: Record<NodeId, BuilderNode>): boolean {
  if (node.type !== "navbar") return false;
  const children = node.children ?? [];
  if (children.length === 0) return false;
  if (children.length === 1) {
    const only = nodes[children[0] as NodeId];
    if (only?.type === "container") return false; // ya envuelto
  }
  return true;
}

/**
 * Envuelve los `children` actuales de un `navbar` legacy (logo suelto) en un
 * nuevo `container` (mismo `NAVBAR_BRAND_STYLE` que usa `defaultChildren` de
 * un navbar nuevo), preservando el contenido y el orden. `node`/`nodes` ya
 * deben ser un clon (mismo contrato que las demás `migrate*Node`).
 */
function migrateNavbarWrapNode(node: BuilderNode, nodes: Record<NodeId, BuilderNode>): void {
  const brandId = `${node.id}-brand`;
  const existingChildren = node.children ?? [];
  nodes[brandId] = seededNode("container", brandId, {}, NAVBAR_BRAND_STYLE, existingChildren);
  node.children = [brandId];
}

/**
 * ¿Este nodo es un `pricing-card` en formato VIEJO (props-driven: `planName`,
 * `price`, `period`, `features` (string multi-línea), `ctaLabel`, `ctaLink`,
 * `popular`, `popularLabel`) que hay que migrar al árbol de hijos (docs,
 * recomposición de PricingCard en componentes base)? Idempotente: solo migra
 * nodos sin `children` — un `pricing-card` ya migrado los tiene.
 */
function needsPricingCardMigration(node: BuilderNode): boolean {
  return node.type === "pricing-card" && (!node.children || node.children.length === 0);
}

/** `props.features` (string multi-línea, una feature por línea) → lista de strings no vacíos. */
function parseFeaturesList(value: unknown): string[] {
  const s = typeof value === "string" ? value : "";
  return s
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f !== "");
}

/**
 * Migra un `pricing-card` viejo in-place-sobre-clon: genera el árbol
 * `badge?`/`plan`/`price-row(price,period)`/`features(feature-N…)`/`cta` a
 * partir de sus `props` actuales, setea `children`, borra las props ya
 * migradas, y AÑADE los nodos generados a `nodes`. Mismos ids deterministas
 * que `migrateTestimonialNode` (`${node.id}-<slot>`), estables para tests y
 * sin colisiones.
 *
 * `popular`/`popularLabel`: si `popular` era `false` (o ausente), el
 * `pricing-card` legacy NO tenía badge visible — al migrar, NO se genera el
 * nodo badge en absoluto, para no introducir un elemento visual que antes no
 * existía. Si era `true`, se genera el badge con `popularLabel` (o "Popular"
 * si estaba vacío).
 */
function migratePricingCardNode(node: BuilderNode, nodes: Record<NodeId, BuilderNode>): void {
  const props = node.props as {
    planName?: unknown;
    price?: unknown;
    period?: unknown;
    features?: unknown;
    ctaLabel?: unknown;
    ctaLink?: unknown;
    popular?: unknown;
    popularLabel?: unknown;
  };
  const planName = typeof props.planName === "string" ? props.planName : "";
  const price = typeof props.price === "string" && props.price !== "" ? props.price : "$0";
  const period = typeof props.period === "string" ? props.period : "";
  const features = parseFeaturesList(props.features);
  const ctaLabel = typeof props.ctaLabel === "string" && props.ctaLabel !== "" ? props.ctaLabel : "Empezar";
  const ctaLink = typeof props.ctaLink === "object" && props.ctaLink !== null ? props.ctaLink : { kind: "external", href: "#" };
  const popular = props.popular === true;
  const popularLabel = typeof props.popularLabel === "string" && props.popularLabel !== "" ? props.popularLabel : "Popular";

  const badgeId = `${node.id}-badge`;
  const planId = `${node.id}-plan`;
  const priceRowId = `${node.id}-price-row`;
  const priceId = `${node.id}-price`;
  const periodId = `${node.id}-period`;
  const featuresId = `${node.id}-features`;
  const ctaId = `${node.id}-cta`;

  const children: NodeId[] = [];

  if (popular) {
    nodes[badgeId] = seededNode("text", badgeId, { content: popularLabel }, PRICING_BADGE_STYLE);
    children.push(badgeId);
  }

  nodes[planId] = seededNode("text", planId, { content: planName }, PRICING_PLAN_STYLE);
  children.push(planId);

  nodes[priceId] = seededNode("text", priceId, { content: price }, PRICING_PRICE_STYLE);
  nodes[periodId] = seededNode("text", periodId, { content: period }, PRICING_PERIOD_STYLE);
  nodes[priceRowId] = seededNode("container", priceRowId, {}, PRICING_PRICE_ROW_STYLE, [priceId, periodId]);
  children.push(priceRowId);

  const featureIds: NodeId[] = features.map((feature, i) => {
    const featureId = `${node.id}-feature-${i}`;
    const featureTextId = `${featureId}-text`;
    nodes[featureTextId] = seededNode("text", featureTextId, { content: `✓ ${feature}` }, PRICING_FEATURE_TEXT_STYLE);
    nodes[featureId] = seededNode("container", featureId, {}, PRICING_FEATURE_STYLE, [featureTextId]);
    return featureId;
  });
  nodes[featuresId] = seededNode("container", featuresId, {}, PRICING_FEATURES_STYLE, featureIds);
  children.push(featuresId);

  nodes[ctaId] = seededNode("button", ctaId, { label: ctaLabel, link: ctaLink }, PRICING_CTA_STYLE);
  children.push(ctaId);

  node.children = children;
  delete (node.props as { planName?: unknown }).planName;
  delete (node.props as { price?: unknown }).price;
  delete (node.props as { period?: unknown }).period;
  delete (node.props as { features?: unknown }).features;
  delete (node.props as { ctaLabel?: unknown }).ctaLabel;
  delete (node.props as { ctaLink?: unknown }).ctaLink;
  delete (node.props as { popular?: unknown }).popular;
  delete (node.props as { popularLabel?: unknown }).popularLabel;
}

/**
 * Migra TODOS los `tabs`/`accordion`/`testimonial`/`quote`/`stat`/`navbar`/
 * `pricing-card` viejos de un sitio al modelo children-based. Devuelve el
 * mismo `site` si no había nada que migrar (referencia estable).
 */
export function migrateSiteCompositeSlots(site: BuilderSite): BuilderSite {
  let siteChanged = false;
  const pages = { ...site.pages };

  for (const [pageId, page] of Object.entries(site.pages)) {
    const oldNodes = page.document.nodes;
    const toMigrateSlots = Object.values(oldNodes).filter(needsMigration);
    const toMigrateTestimonials = Object.values(oldNodes).filter(needsTestimonialMigration);
    const toMigrateQuotes = Object.values(oldNodes).filter(needsQuoteMigration);
    const toMigrateStats = Object.values(oldNodes).filter(needsStatMigration);
    const toMigrateNavbars = Object.values(oldNodes).filter((n) => needsNavbarWrapMigration(n, oldNodes));
    const toMigratePricingCards = Object.values(oldNodes).filter(needsPricingCardMigration);
    if (
      toMigrateSlots.length === 0 &&
      toMigrateTestimonials.length === 0 &&
      toMigrateQuotes.length === 0 &&
      toMigrateStats.length === 0 &&
      toMigrateNavbars.length === 0 &&
      toMigratePricingCards.length === 0
    ) {
      continue;
    }

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
    for (const node of toMigrateQuotes) {
      const clone: BuilderNode = { ...node, props: { ...node.props } };
      nodes[clone.id] = clone;
      migrateQuoteNode(clone, nodes);
    }
    for (const node of toMigrateStats) {
      const clone: BuilderNode = { ...node, props: { ...node.props } };
      nodes[clone.id] = clone;
      migrateStatNode(clone, nodes);
    }
    for (const node of toMigrateNavbars) {
      const clone: BuilderNode = { ...node, children: node.children ? [...node.children] : undefined };
      nodes[clone.id] = clone;
      migrateNavbarWrapNode(clone, nodes);
    }
    for (const node of toMigratePricingCards) {
      const clone: BuilderNode = { ...node, props: { ...node.props } };
      nodes[clone.id] = clone;
      migratePricingCardNode(clone, nodes);
    }
    pages[pageId] = { ...page, document: { ...page.document, nodes } };
    siteChanged = true;
  }

  return siteChanged ? { ...site, pages } : site;
}
