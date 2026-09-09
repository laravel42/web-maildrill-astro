/**
 * Quote — cita destacada `<blockquote>` con atribución (docs/16 §12.1 #6).
 *
 * COMPOSITE de componentes base (docs/23, mismo espíritu que `testimonial`):
 * la raíz sigue siendo un `<blockquote>` atómico (mismo `defaultStyle`, retro-
 * compatible visualmente), pero su contenido son NODOS HIJO reales en vez de
 * sub-elementos con `CSSProperties` fijas:
 *
 *   quote (blockquote, acceptsChildren)
 *   ├── <id>-content     : text (la cita, editable inline)
 *   └── <id>-attribution : text (el `<cite>` del autor; spacing.margin AQUÍ es
 *       editable desde el Inspector — antes era CITE_STYLE.marginTop fija)
 *
 * Motivo (bug real, mismo patrón que Testimonial): el espaciado entre la cita
 * y la atribución vivía en un `marginTop` fijo no editable (`CITE_STYLE`), así
 * que el Inspector no ofrecía ningún control para ese margin. Al convertir la
 * atribución en un nodo `text` real, su `spacing`/`typography`/`appearance`
 * quedan editables de fábrica (mismo `styleSchema` que cualquier `text`), sin
 * tocar el Inspector ni el parser de spacing.
 *
 * Retrocompatibilidad: un documento guardado con el `quote` viejo (props
 * `content/attribution`, sin `children`) se migra automáticamente al cargar —
 * ver `model/migrateSlots.ts` (`migrateQuoteNode`).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, DefaultChildSpec, RenderContext } from "../types";

export const QUOTE_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    spacing: { padding: "16px 24px", margin: "0" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.lg" },
      lineHeight: { token: "typography.lineHeights.normal" },
    },
    appearance: {
      background: { token: "colors.surface.alt" },
      color: { token: "colors.text" },
      borderRadius: { token: "radii.md" },
    },
  },
};

/**
 * `text` de la cita: sin margin propio (antes `QUOTE_TEXT_STYLE`). El modelo
 * de estilo no tiene `fontStyle` (itálica) como campo editable — se mantiene
 * sin ese énfasis tipográfico; es una pérdida visual menor y fuera del
 * alcance del bug de margin que motivó esta recomposición (no se introduce un
 * campo nuevo al modelo de estilo por esto).
 */
export const QUOTE_CONTENT_STYLE: NodeStyle = {
  base: { spacing: { margin: "0" } },
};

/**
 * `text` de la atribución (antes `CITE_STYLE`). `spacing.margin` (shorthand
 * top-only vía "12px 0 0 0") reemplaza al `marginTop` fijo — ahora editable
 * como cualquier `spacing.margin` normal desde el Inspector (`SidesGrid`).
 * El modelo de estilo no tiene campo `opacity`; se usa el token
 * `colors.muted` (mismo criterio ya usado en `TESTIMONIAL_ROLE_STYLE`) para
 * lograr el mismo efecto visual de atenuación sin introducir un campo nuevo.
 */
export const QUOTE_ATTRIBUTION_STYLE: NodeStyle = {
  base: {
    spacing: { margin: "12px 0 0 0" },
    typography: {
      fontSize: { token: "typography.sizes.sm" },
      fontWeight: { token: "typography.weights.bold" },
    },
    appearance: { color: { token: "colors.muted" } },
  },
};

/** `defaultChildren` sembrados al crear un `quote` nuevo desde la paleta. */
export const QUOTE_DEFAULT_CHILDREN: DefaultChildSpec[] = [
  {
    type: "text",
    props: { content: "<p>Design is not just how it looks, but how it works.</p>" },
    style: QUOTE_CONTENT_STYLE,
  },
  {
    type: "text",
    // `text` renderiza HTML crudo vía `dangerouslySetInnerHTML`, así se
    // preserva la semántica `<cite>` sin necesitar un tipo de nodo especial.
    props: { content: "<cite>— Steve Jobs</cite>" },
    style: QUOTE_ATTRIBUTION_STYLE,
  },
];

function QuoteRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;
  const isEmpty = !node.children || node.children.length === 0;

  return (
    <blockquote
      ref={rootRef as Ref<HTMLQuoteElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {children}
      {!exportMode && isEmpty ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Empty quote — add the text and author
        </span>
      ) : null}
    </blockquote>
  );
}

export const quoteDefinition: ComponentDefinition = {
  type: "quote",
  label: "Cita",
  category: "content",
  acceptsChildren: true,
  defaultProps: {},
  defaultStyle: structuredClone(QUOTE_DEFAULT_STYLE),
  defaultChildren: QUOTE_DEFAULT_CHILDREN,
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: QuoteRender,
};
