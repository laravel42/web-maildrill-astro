/**
 * PricingCard — tarjeta de precio: plan + precio + features + CTA + badge
 * "popular" (docs/16 §12.1 #13).
 *
 * Componente `content` atómico. Raíz `<article>` themeable por tokens; dentro,
 * nombre de plan, precio + periodo, lista de features (una por línea en la prop)
 * y un CTA `<a>`. `popular` (toggle) muestra un badge de acento.
 *
 * **Colores de sub-elementos por token sin romper el export:** el CTA y el badge
 * usan `var(--colors-primary-default)` / `var(--colors-primary-on)` inline. Esas
 * custom properties las define el sistema de tokens tanto en el canvas (scopeadas
 * al frame por `TokensStyle`) como en el export (`:root`), así que el color es
 * coherente con el tema en AMBOS modos — a diferencia de un color en el `style`
 * de la raíz, que no se emite en `exportMode` (AGENTS.md §5). Los tokens base
 * están garantizados (`BASE_TOKENS`), así que las vars siempre resuelven.
 *
 * Render puro (P3): raíz con `rootRef`/`rootProps`; HTML puro sin runtime (P8).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type LinkTarget, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

function readLink(value: unknown): LinkTarget | null {
  if (typeof value !== "object" || value === null) return null;
  const kind = (value as { kind?: unknown }).kind;
  if (kind === "internal" || kind === "external" || kind === "anchor") return value as LinkTarget;
  return null;
}
function localResolve(link: LinkTarget): string {
  if (link.kind === "external") return link.href;
  if (link.kind === "anchor") return `#${link.nodeId}`;
  return "#";
}

export const PRICING_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex", flexDirection: "column", gap: "12px", alignItems: "stretch" },
    spacing: { padding: "24px" },
    size: { minHeight: "64px", maxWidth: "360px" },
    typography: { fontFamily: { token: "typography.families.sans" } },
    appearance: {
      background: { token: "colors.surface.default" },
      color: { token: "colors.text" },
      borderColor: { token: "colors.border" },
      borderWidth: "1px",
      borderStyle: "solid",
      borderRadius: { token: "radii.md" },
      boxShadow: { token: "shadows.sm" },
    },
  },
};

const BADGE_STYLE: CSSProperties = {
  alignSelf: "flex-start",
  padding: "var(--spacing-xs, 4px) var(--spacing-sm, 8px)",
  borderRadius: "var(--radii-sm, 4px)",
  background: "var(--colors-primary-default)",
  color: "var(--colors-primary-on)",
  fontSize: "var(--typography-sizes-sm, 0.75em)",
  fontWeight: "var(--typography-weights-bold, 700)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};
const PLAN_STYLE: CSSProperties = {
  fontSize: "var(--typography-sizes-lg, 1.1em)",
  fontWeight: "var(--typography-weights-bold, 700)",
};
const PRICE_ROW_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "var(--spacing-xs, 4px)",
};
const PRICE_STYLE: CSSProperties = {
  fontSize: "2.25em",
  fontWeight: "var(--typography-weights-bold, 700)",
  lineHeight: 1,
};
const PERIOD_STYLE: CSSProperties = {
  fontSize: "var(--typography-sizes-base, 0.9em)",
  opacity: 0.6,
};
const FEATURES_STYLE: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "var(--spacing-xs, 8px)",
};
const FEATURE_STYLE: CSSProperties = {
  display: "flex",
  gap: "var(--spacing-xs, 8px)",
  alignItems: "flex-start",
};
const CTA_STYLE: CSSProperties = {
  marginTop: "var(--spacing-xs, 8px)",
  display: "inline-block",
  padding: "var(--spacing-sm, 10px) var(--spacing-md, 16px)",
  borderRadius: "var(--radii-md, 8px)",
  background: "var(--colors-primary-default)",
  color: "var(--colors-primary-on)",
  textDecoration: "none",
  textAlign: "center",
  fontWeight: "var(--typography-weights-bold, 600)",
};

function PricingCardRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps, resolveLink } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const planName = typeof node.props.planName === "string" ? node.props.planName : "";
  const price = typeof node.props.price === "string" ? node.props.price : "";
  const period = typeof node.props.period === "string" ? node.props.period : "";
  const featuresRaw = typeof node.props.features === "string" ? node.props.features : "";
  const features = featuresRaw.split("\n").map((f) => f.trim()).filter((f) => f !== "");
  const ctaLabel = typeof node.props.ctaLabel === "string" ? node.props.ctaLabel : "";
  const popular = node.props.popular === true;
  const popularLabel = typeof node.props.popularLabel === "string" && node.props.popularLabel !== "" ? node.props.popularLabel : "Popular";

  const link = readLink(node.props.ctaLink);
  const href = link ? (resolveLink?.(link) ?? localResolve(link)) : "#";

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <article
      ref={rootRef as Ref<HTMLElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {popular ? <span style={BADGE_STYLE}>{popularLabel}</span> : null}
      {planName !== "" ? <span style={PLAN_STYLE}>{planName}</span> : null}
      <span style={PRICE_ROW_STYLE}>
        <span style={PRICE_STYLE}>{price !== "" ? price : "$0"}</span>
        {period !== "" ? <span style={PERIOD_STYLE}>{period}</span> : null}
      </span>
      {features.length > 0 ? (
        <ul style={FEATURES_STYLE}>
          {features.map((f, i) => (
            <li key={i} style={FEATURE_STYLE}>
              <span aria-hidden="true">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {ctaLabel !== "" ? (
        <a href={href} style={CTA_STYLE}>
          {ctaLabel}
        </a>
      ) : null}
    </article>
  );
}

export const pricingCardDefinition: ComponentDefinition = {
  type: "pricing-card",
  label: "Tarjeta de precio",
  category: "content",
  acceptsChildren: false,
  defaultProps: {
    planName: "Pro",
    price: "$29",
    period: "/mes",
    features: "Todo del plan Free\nSoporte prioritario\nProyectos ilimitados",
    ctaLabel: "Empezar",
    ctaLink: { kind: "external", href: "#" },
    popular: false,
    popularLabel: "Popular",
  },
  defaultStyle: structuredClone(PRICING_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      { key: "planName", label: "Nombre del plan", control: "text", group: "Contenido", translatable: true },
      { key: "price", label: "Precio", control: "text", group: "Contenido", translatable: true },
      { key: "period", label: "Periodo", control: "text", group: "Contenido", translatable: true },
      { key: "features", label: "Features (una por línea)", control: "string-list", group: "Contenido", translatable: true },
      { key: "ctaLabel", label: "Texto del CTA", control: "text", group: "Acción", translatable: true },
      { key: "ctaLink", label: "Enlace del CTA", control: "link", group: "Acción" },
      { key: "popular", label: "Destacar como popular", control: "toggle", group: "Estado" },
      { key: "popularLabel", label: "Texto del badge popular", control: "text", group: "Estado", translatable: true },
    ],
  },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: PricingCardRender,
};
