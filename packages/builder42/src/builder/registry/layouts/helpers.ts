import type { BuilderDocument, BuilderNode, LinkTarget, NodeId, NodeStyle, PageMeta } from "../../model/types";
import type { NodeFragment } from "../../model/tree";
import type { NodeTranslations } from "../../model/types";
import { defaultStyleFor } from "../../store/exampleSite/styleFor";
import {
  TESTIMONIAL_AUTHOR_STYLE,
  TESTIMONIAL_AVATAR_STYLE,
  TESTIMONIAL_CAPTION_STYLE,
  TESTIMONIAL_NAME_STYLE,
  TESTIMONIAL_QUOTE_STYLE,
  TESTIMONIAL_ROLE_STYLE,
} from "../components/Testimonial";
import { STAT_LABEL_STYLE, STAT_VALUE_STYLE } from "../components/Stat";
import { QUOTE_ATTRIBUTION_STYLE, QUOTE_CONTENT_STYLE } from "../components/Quote";
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
} from "../components/PricingCard";

/**
 * Metadata SEO que una plantilla de página propone para la página donde se
 * aplica (docs/42 §2.8). `slug`, `lang` y `themeId` NO se tocan: son del sitio
 * del usuario, no de la plantilla. `metaTranslations` sigue el mismo modelo que
 * el resto del contenido multilingüe (docs/12 §B.9).
 */
export interface LayoutPageMeta {
  title: string;
  description?: string;
  seo?: PageMeta["seo"];
  metaTranslations?: PageMeta["metaTranslations"];
}

/**
 * `defaultStyleFor(type)` con el color de texto forzado a un token de "encima de
 * banda oscura", para componentes que caen dentro de una **banda enfática**
 * (docs/43 §3, convención actualizada en docs/48 §3.2). Sin esto, un
 * `social-links`/`nav-menu` hereda `colors.text` de su `defaultStyle` y sus
 * glifos quedan casi invisibles sobre el footer oscuro (bug real detectado por
 * la guarda `lowContrastOnDarkBands`).
 *
 * El default es `colors.band.on`, el par semántico de `colors.band.dark`: un
 * tema los remapea juntos, así que el contraste se mantiene en cualquier tema
 * (con `colors.surface.default` no: un tema oscuro lo vuelve casi negro).
 */
export function darkBandStyleFor(type: string, colorToken = "colors.band.on"): NodeStyle {
  const style = defaultStyleFor(type);
  return {
    ...style,
    base: {
      ...style.base,
      appearance: { ...style.base.appearance, color: { token: colorToken } },
    },
  };
}

/** Convierte un documento completo en fragmento portable (plantillas de página). */
export function documentToFragment(
  doc: BuilderDocument,
  translations?: Record<NodeId, NodeTranslations>,
): NodeFragment {
  return {
    rootId: doc.rootId,
    nodes: structuredClone(doc.nodes),
    translations: translations ? structuredClone(translations) : undefined,
  };
}

/**
 * Subárbol de nodos de un `testimonial` (docs, recomposición de Testimonial en
 * componentes base — corrige el margin no editable de la fila avatar+autor).
 * Genera el mismo árbol que `TESTIMONIAL_DEFAULT_CHILDREN`/la migración de
 * `migrateSlots.ts`, con ids deterministas `${id}-quote`/`${id}-caption`/
 * `${id}-avatar`/`${id}-author`/`${id}-name`/`${id}-role` — así una plantilla
 * de página puede referenciar estos ids en `translations` igual que cualquier
 * otro nodo. `rootStyle` permite el mismo override que antes recibía el nodo
 * `testimonial` plano (p. ej. padding de card + `overrides.md`).
 */
export interface TestimonialContent {
  quote: string;
  name: string;
  role: string;
  initials: string;
}

export function testimonialFragment(
  id: NodeId,
  content: TestimonialContent,
  rootStyle?: NodeStyle,
): Record<NodeId, BuilderNode> {
  const quoteId = `${id}-quote`;
  const captionId = `${id}-caption`;
  const avatarId = `${id}-avatar`;
  const authorId = `${id}-author`;
  const nameId = `${id}-name`;
  const roleId = `${id}-role`;

  return {
    [id]: {
      id,
      type: "testimonial",
      props: {},
      style: rootStyle ?? defaultStyleFor("testimonial"),
      children: [quoteId, captionId],
    },
    [quoteId]: {
      id: quoteId,
      type: "text",
      props: { content: `<p>${content.quote}</p>` },
      style: structuredClone(TESTIMONIAL_QUOTE_STYLE),
    },
    [captionId]: {
      id: captionId,
      type: "container",
      props: {},
      style: structuredClone(TESTIMONIAL_CAPTION_STYLE),
      children: [avatarId, authorId],
    },
    [avatarId]: {
      id: avatarId,
      type: "avatar",
      props: { initials: content.initials },
      style: structuredClone(TESTIMONIAL_AVATAR_STYLE),
    },
    [authorId]: {
      id: authorId,
      type: "container",
      props: {},
      style: structuredClone(TESTIMONIAL_AUTHOR_STYLE),
      children: [nameId, roleId],
    },
    [nameId]: {
      id: nameId,
      type: "text",
      props: { content: `<strong>${content.name}</strong>` },
      style: structuredClone(TESTIMONIAL_NAME_STYLE),
    },
    [roleId]: {
      id: roleId,
      type: "text",
      props: { content: content.role },
      style: structuredClone(TESTIMONIAL_ROLE_STYLE),
    },
  };
}

/**
 * Subárbol de nodos de un `stat` (docs, recomposición de Stat en componentes
 * base — corrige el margin/typography fijos y no editables del label, y
 * expone typography completo en el valor). Genera el mismo árbol que
 * `STAT_DEFAULT_CHILDREN`/la migración de `migrateSlots.ts`, con ids
 * deterministas `${id}-value`/`${id}-label`. `rootStyle` permite el mismo
 * override que antes recibía el nodo `stat` plano.
 */
export function statFragment(
  id: NodeId,
  content: { value: string; label: string },
  rootStyle?: NodeStyle,
): Record<NodeId, BuilderNode> {
  const valueId = `${id}-value`;
  const labelId = `${id}-label`;

  return {
    [id]: {
      id,
      type: "stat",
      props: {},
      style: rootStyle ?? defaultStyleFor("stat"),
      children: [valueId, labelId],
    },
    [valueId]: {
      id: valueId,
      type: "stat-value",
      props: { value: content.value },
      style: structuredClone(STAT_VALUE_STYLE),
    },
    [labelId]: {
      id: labelId,
      type: "text",
      props: { content: content.label },
      style: structuredClone(STAT_LABEL_STYLE),
    },
  };
}

/**
 * Subárbol de nodos de un `quote` (docs, recomposición de Quote en
 * componentes base — corrige el margin no editable de la atribución). Genera
 * el mismo árbol que `QUOTE_DEFAULT_CHILDREN`/la migración de
 * `migrateSlots.ts`, con ids deterministas `${id}-content`/`${id}-attribution`
 * — así una plantilla de página puede referenciar estos ids en `translations`
 * igual que cualquier otro nodo. `rootStyle` permite el mismo override que
 * antes recibía el nodo `quote` plano (p. ej. tipografía fluida + banda
 * oscura).
 */
export function quoteFragment(
  id: NodeId,
  content: { content: string; attribution: string },
  rootStyle?: NodeStyle,
): Record<NodeId, BuilderNode> {
  const contentId = `${id}-content`;
  const attributionId = `${id}-attribution`;

  return {
    [id]: {
      id,
      type: "quote",
      props: {},
      style: rootStyle ?? defaultStyleFor("quote"),
      children: [contentId, attributionId],
    },
    [contentId]: {
      id: contentId,
      type: "text",
      props: { content: `<p>${content.content}</p>` },
      style: structuredClone(QUOTE_CONTENT_STYLE),
    },
    [attributionId]: {
      id: attributionId,
      type: "text",
      props: { content: `<cite>— ${content.attribution}</cite>` },
      style: structuredClone(QUOTE_ATTRIBUTION_STYLE),
    },
  };
}

/**
 * Subárbol de nodos de un `pricing-card` (docs, recomposición de PricingCard
 * en componentes base — corrige el spacing/gap fijo y no editable de badge,
 * precio, features y CTA). Genera el mismo árbol que
 * `PRICING_DEFAULT_CHILDREN`/la migración de `migrateSlots.ts`, con ids
 * deterministas `${id}-badge`/`${id}-plan`/`${id}-price-row`/`${id}-price`/
 * `${id}-period`/`${id}-features`/`${id}-feature-N`/`${id}-feature-N-text`/
 * `${id}-cta` — así una plantilla de página puede referenciar estos ids en
 * `translations` igual que cualquier otro nodo. `rootStyle` permite el mismo
 * override que antes recibía el nodo `pricing-card` plano (p. ej. borde
 * destacado + sombra en el plan "popular").
 *
 * `popular`/`popularLabel`: si `popular` es falsy, NO se genera el nodo
 * badge (mismo criterio que `migratePricingCardNode`, para no introducir un
 * elemento visual que la plantilla no pedía).
 */
export interface PricingCardContent {
  planName: string;
  price: string;
  period: string;
  features: string[];
  ctaLabel: string;
  ctaLink: LinkTarget;
  popular?: boolean;
  popularLabel?: string;
}

export function pricingCardFragment(
  id: NodeId,
  content: PricingCardContent,
  rootStyle?: NodeStyle,
): Record<NodeId, BuilderNode> {
  const badgeId = `${id}-badge`;
  const planId = `${id}-plan`;
  const priceRowId = `${id}-price-row`;
  const priceId = `${id}-price`;
  const periodId = `${id}-period`;
  const featuresId = `${id}-features`;
  const ctaId = `${id}-cta`;

  const children: NodeId[] = [];
  const nodes: Record<NodeId, BuilderNode> = {};

  if (content.popular) {
    nodes[badgeId] = {
      id: badgeId,
      type: "text",
      props: { content: content.popularLabel && content.popularLabel !== "" ? content.popularLabel : "Popular" },
      style: structuredClone(PRICING_BADGE_STYLE),
    };
    children.push(badgeId);
  }

  nodes[planId] = {
    id: planId,
    type: "text",
    props: { content: content.planName },
    style: structuredClone(PRICING_PLAN_STYLE),
  };
  children.push(planId);

  nodes[priceId] = {
    id: priceId,
    type: "text",
    props: { content: content.price },
    style: structuredClone(PRICING_PRICE_STYLE),
  };
  nodes[periodId] = {
    id: periodId,
    type: "text",
    props: { content: content.period },
    style: structuredClone(PRICING_PERIOD_STYLE),
  };
  nodes[priceRowId] = {
    id: priceRowId,
    type: "container",
    props: {},
    style: structuredClone(PRICING_PRICE_ROW_STYLE),
    children: [priceId, periodId],
  };
  children.push(priceRowId);

  const featureIds: NodeId[] = content.features.map((feature, i) => {
    const featureId = `${id}-feature-${i}`;
    const featureTextId = `${featureId}-text`;
    nodes[featureTextId] = {
      id: featureTextId,
      type: "text",
      props: { content: `✓ ${feature}` },
      style: structuredClone(PRICING_FEATURE_TEXT_STYLE),
    };
    nodes[featureId] = {
      id: featureId,
      type: "container",
      props: {},
      style: structuredClone(PRICING_FEATURE_STYLE),
      children: [featureTextId],
    };
    return featureId;
  });
  nodes[featuresId] = {
    id: featuresId,
    type: "container",
    props: {},
    style: structuredClone(PRICING_FEATURES_STYLE),
    children: featureIds,
  };
  children.push(featuresId);

  nodes[ctaId] = {
    id: ctaId,
    type: "button",
    props: { label: content.ctaLabel, link: content.ctaLink },
    style: structuredClone(PRICING_CTA_STYLE),
  };
  children.push(ctaId);

  nodes[id] = {
    id,
    type: "pricing-card",
    props: {},
    style: rootStyle ?? defaultStyleFor("pricing-card"),
    children,
  };

  return nodes;
}

