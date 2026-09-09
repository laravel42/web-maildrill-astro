/**
 * PricingCard — tarjeta de precio: plan + precio + features + CTA + badge
 * "popular" (docs/16 §12.1 #13).
 *
 * COMPOSITE de componentes base (docs/23, mismo espíritu que `testimonial`/
 * `quote`/`stat`): la raíz sigue siendo un `<article>` atómico (mismo
 * `defaultStyle`, retrocompatible visualmente), pero su contenido son NODOS
 * HIJO reales en vez de sub-elementos con `CSSProperties` fijas:
 *
 *   pricing-card (article, acceptsChildren)
 *   ├── <id>-badge      : text      ("Popular" — nodo normal, el usuario lo
 *   │                     borra si no quiere destacar el plan; no hay prop
 *   │                     `popular`/`popularLabel`, "todo es nodos")
 *   ├── <id>-plan        : text      (nombre del plan, bold)
 *   ├── <id>-price-row   : container (fila precio+periodo, alignItems:baseline)
 *   │   ├── <id>-price   : text      (precio, grande y bold)
 *   │   └── <id>-period  : text      (periodo, color atenuado)
 *   ├── <id>-features    : container (columna de filas de feature)
 *   │   └── <id>-feature-N : container (fila check+texto)
 *   │       └── <id>-feature-N-text : text ("✓ " + feature, un solo nodo)
 *   └── <id>-cta         : button    (REUSA el componente `button` existente)
 *
 * Motivo (mismo bug real que Testimonial/Quote/Stat): el spacing/gap entre
 * badge/plan/precio/features/CTA vivía en `CSSProperties` fijas
 * (`BADGE_STYLE`, `PRICE_ROW_STYLE`, `FEATURES_STYLE`, `FEATURE_STYLE`,
 * `CTA_STYLE`…) no editables desde el Inspector. Al convertir cada
 * sub-elemento en un nodo real, su `spacing`/`appearance` quedan editables de
 * fábrica (mismo `styleSchema` que cualquier `container`/`text`/`button`).
 *
 * Decisión de diseño — features individuales (confirmado por el usuario):
 * cada feature es un nodo propio (no una prop de textarea multi-línea), así
 * que se pueden añadir/quitar/reordenar/editar una por una como cualquier
 * otro nodo del árbol. El check "✓" se mantiene DENTRO del mismo `text` que
 * la feature (un solo nodo por feature, no dos) — más simple de editar (no
 * hay que sincronizar dos nodos hermanos) y evita que el usuario borre el
 * check por accidente al editar solo el texto; ver `featureRowStyle`/
 * `PRICING_FEATURE_TEXT_STYLE`.
 *
 * Decisión de diseño — badge: se elimina la prop `popular`/`popularLabel`.
 * El badge es un nodo `text` más en `defaultChildren`, con estilo de acento
 * (`appearance.background`/`appearance.color` con tokens `colors.primary.*`,
 * ya existentes en `BASE_TOKENS` — ver `model/tokens.ts`). Si el usuario no
 * quiere destacar el plan, simplemente borra el nodo del árbol.
 *
 * Decisión de diseño — CTA: reusa el nodo `button` YA EXISTENTE (en vez de
 * introducir un tipo nuevo) con un override de estilo que reproduce la
 * apariencia visual del `CTA_STYLE` viejo (fondo primary, texto centrado) más
 * `spacing.margin` (antes `marginTop` fijo, ahora editable) — ver
 * `PRICING_CTA_STYLE`. El resto (`fondo`/`color`/`padding`/`radius`) ya lo
 * trae el `defaultStyle` normal de `button`, así que solo se hace override de
 * lo que cambia (`textAlign` centrado + el margin).
 *
 * Retrocompatibilidad: un documento guardado con el `pricing-card` viejo
 * (props `planName/price/period/features/ctaLabel/ctaLink/popular/
 * popularLabel`, sin `children`) se migra automáticamente al cargar — ver
 * `model/migrateSlots.ts` (`migratePricingCardNode`).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import { BUTTON_DEFAULT_STYLE } from "./Button";
import type { ComponentDefinition, DefaultChildSpec, RenderContext } from "../types";

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

/**
 * `text` del badge "Popular" (antes `BADGE_STYLE`). Fondo/color de acento con
 * tokens de paleta ya existentes (`colors.primary.default`/`.on`,
 * `model/tokens.ts#BASE_TOKENS`) en vez de los `var(--colors-primary-…)`
 * crudos del código viejo — mismo resultado visual, ahora vía el sistema de
 * tokens estándar (coherente con cualquier tema, igual criterio que el resto
 * de componentes). Sin `textTransform`/`letterSpacing`: el modelo de estilo
 * no tiene esos campos editables (misma pérdida visual menor ya documentada
 * en `Testimonial.tsx` para `fontStyle`), fuera de alcance de esta
 * recomposición.
 */
export const PRICING_BADGE_STYLE: NodeStyle = {
  base: {
    layout: { display: "inline-block" },
    spacing: { padding: "4px 8px", margin: "0" },
    appearance: {
      background: { token: "colors.primary.default" },
      color: { token: "colors.primary.on" },
      borderRadius: { token: "radii.sm" },
    },
    typography: {
      fontSize: { token: "typography.sizes.sm" },
      fontWeight: { token: "typography.weights.bold" },
    },
  },
};

/** `text` del nombre del plan: bold (antes `PLAN_STYLE`). */
export const PRICING_PLAN_STYLE: NodeStyle = {
  base: {
    typography: { fontSize: { token: "typography.sizes.lg" }, fontWeight: { token: "typography.weights.bold" } },
    spacing: { margin: "0" },
  },
};

/**
 * `container` fila precio+periodo (antes `PRICE_ROW_STYLE`). `padding`/
 * `background` se neutralizan porque `container` trae estilo visual propio
 * por defecto (docs/03 §4) que aquí no queremos (mismo criterio que
 * `TESTIMONIAL_CAPTION_STYLE`) — este nodo es puramente de layout.
 */
export const PRICING_PRICE_ROW_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex", alignItems: "baseline", gap: "4px" },
    spacing: { padding: "0", margin: "0" },
    size: { minHeight: "0" },
    appearance: { background: "transparent" },
  },
};

/** `text` del precio: grande y bold, lineHeight ajustado (antes `PRICE_STYLE`). */
export const PRICING_PRICE_STYLE: NodeStyle = {
  base: {
    typography: {
      fontSize: "2.25em",
      fontWeight: { token: "typography.weights.bold" },
      lineHeight: { token: "typography.lineHeights.tight" },
    },
    spacing: { margin: "0" },
  },
};

/**
 * `text` del periodo (antes `PERIOD_STYLE.opacity`). El modelo no tiene
 * `opacity`; se usa `colors.muted` (mismo criterio ya usado en
 * Testimonial/Stat/Quote) para el mismo efecto visual de texto secundario.
 */
export const PRICING_PERIOD_STYLE: NodeStyle = {
  base: {
    typography: { fontSize: { token: "typography.sizes.base" } },
    appearance: { color: { token: "colors.muted" } },
    spacing: { margin: "0" },
  },
};

/**
 * `container` columna de features (antes `FEATURES_STYLE`). Sin
 * padding/background propio — mismo criterio de neutralizar el `container`
 * que en `PRICING_PRICE_ROW_STYLE`.
 */
export const PRICING_FEATURES_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex", flexDirection: "column", gap: "8px" },
    spacing: { padding: "0", margin: "0" },
    size: { minHeight: "0" },
    appearance: { background: "transparent" },
  },
};

/**
 * `container` fila de UNA feature (antes `FEATURE_STYLE`). Solo layout (sin
 * padding/background propio) — el check "✓" vive dentro del `text` hijo
 * único (ver `PRICING_FEATURE_TEXT_STYLE`), no como un nodo hermano
 * separado.
 */
export const PRICING_FEATURE_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex", alignItems: "flex-start", gap: "0" },
    spacing: { padding: "0", margin: "0" },
    size: { minHeight: "0" },
    appearance: { background: "transparent" },
  },
};

/** `text` de una feature individual: "✓ " + el texto, un solo nodo editable. */
export const PRICING_FEATURE_TEXT_STYLE: NodeStyle = {
  base: { spacing: { margin: "0" } },
};

/**
 * `button` del CTA (antes `CTA_STYLE`). Override sobre el `defaultStyle`
 * normal de `button` (fondo/color/padding/radius ya vienen de
 * `BUTTON_DEFAULT_STYLE`): solo se ajusta `spacing.margin` (antes
 * `marginTop` fijo, ahora editable) y `textAlign` centrado + ancho completo
 * para reproducir la apariencia visual idéntica del CTA viejo dentro de la
 * card.
 */
export const PRICING_CTA_STYLE: NodeStyle = {
  base: {
    ...BUTTON_DEFAULT_STYLE.base,
    layout: { ...BUTTON_DEFAULT_STYLE.base.layout, display: "block" },
    spacing: { ...BUTTON_DEFAULT_STYLE.base.spacing, margin: "8px 0 0 0" },
    typography: { ...BUTTON_DEFAULT_STYLE.base.typography, textAlign: "center" },
  },
};

function featureChild(text: string): DefaultChildSpec {
  return {
    type: "container",
    style: PRICING_FEATURE_STYLE,
    children: [
      {
        type: "text",
        props: { content: `✓ ${text}` },
        style: PRICING_FEATURE_TEXT_STYLE,
      },
    ],
  };
}

/** `defaultChildren` sembrados al crear un `pricing-card` nuevo desde la paleta. */
export const PRICING_DEFAULT_CHILDREN: DefaultChildSpec[] = [
  { type: "text", props: { content: "Popular" }, style: PRICING_BADGE_STYLE },
  { type: "text", props: { content: "Pro" }, style: PRICING_PLAN_STYLE },
  {
    type: "container",
    style: PRICING_PRICE_ROW_STYLE,
    children: [
      { type: "text", props: { content: "$29" }, style: PRICING_PRICE_STYLE },
      { type: "text", props: { content: "/mo" }, style: PRICING_PERIOD_STYLE },
    ],
  },
  {
    type: "container",
    style: PRICING_FEATURES_STYLE,
    children: [
      featureChild("Todo del plan Free"),
      featureChild("Soporte prioritario"),
      featureChild("Proyectos ilimitados"),
    ],
  },
  {
    type: "button",
    props: { label: "Get started", link: { kind: "external", href: "#" } },
    style: PRICING_CTA_STYLE,
  },
];

function PricingCardRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;
  const isEmpty = !node.children || node.children.length === 0;

  return (
    <article
      ref={rootRef as Ref<HTMLElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {children}
      {!exportMode && isEmpty ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Empty pricing card — add the plan, price, and features
        </span>
      ) : null}
    </article>
  );
}

export const pricingCardDefinition: ComponentDefinition = {
  type: "pricing-card",
  label: "Tarjeta de precio",
  category: "content",
  acceptsChildren: true,
  defaultProps: {},
  defaultStyle: structuredClone(PRICING_DEFAULT_STYLE),
  defaultChildren: PRICING_DEFAULT_CHILDREN,
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: PricingCardRender,
};
