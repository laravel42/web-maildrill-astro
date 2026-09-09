/**
 * Testimonial — prueba social: cita + avatar (iniciales) + nombre/cargo
 * (docs/16 §12.1 #12).
 *
 * COMPOSITE de componentes base (docs/23, mismo espíritu que `accordion`):
 * la raíz sigue siendo un `<figure>` atómico (mismo `defaultStyle`, retro-
 * compatible visualmente), pero su contenido son NODOS HIJO reales en vez de
 * sub-elementos con `CSSProperties` fijas:
 *
 *   testimonial (figure, acceptsChildren)
 *   ├── <id>-quote   : text   (la cita, editable inline, itálica por su propio defaultStyle)
 *   └── <id>-caption : container (fila avatar+autor; spacing.marginTop AQUÍ es
 *       │             editable desde el Inspector — antes era CAPTION_STYLE fija)
 *       ├── <id>-avatar : avatar (iniciales, 40×40)
 *       └── <id>-author : container (columna)
 *           ├── <id>-name : text (nombre, bold)
 *           └── <id>-role : text (cargo, opacity 0.7)
 *
 * Motivo (bug real, feedback de usuario): el espaciado entre la cita y el
 * bloque de autor vivía en un `marginTop` fijo no editable (`CAPTION_STYLE`),
 * así que el Inspector mostraba correctamente `margin: 0` en la raíz mientras
 * el usuario veía un espacio real que no podía tocar. Al convertir cada
 * sub-elemento en un nodo real, su `spacing`/`appearance` quedan editables de
 * fábrica (mismo `styleSchema` que cualquier `container`/`text`/`avatar`), sin
 * tocar el Inspector ni el parser de spacing.
 *
 * Retrocompatibilidad: un documento guardado con el `testimonial` viejo
 * (props `quote/name/role/initials`, sin `children`) se migra automáticamente
 * al cargar — ver `model/migrateSlots.ts` (`migrateSiteTestimonials`).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, DefaultChildSpec, RenderContext } from "../types";

export const TESTIMONIAL_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "block" },
    spacing: { padding: "24px", margin: "0" },
    size: { maxWidth: "520px" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
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
 * `text` de la cita: sin margin propio (antes `QUOTE_STYLE`). El modelo de
 * estilo no tiene `fontStyle` (itálica) como campo editable — se mantiene sin
 * ese énfasis tipográfico; es una pérdida visual menor y fuera del alcance del
 * bug de margin que motivó esta recomposición (no se introduce un campo nuevo
 * al modelo de estilo por esto).
 */
export const TESTIMONIAL_QUOTE_STYLE: NodeStyle = {
  base: { spacing: { margin: "0" } },
};

/**
 * `container` fila avatar+autor. `spacing.margin` (shorthand top-only vía "16px
 * 0 0 0") reemplaza al `CAPTION_STYLE.marginTop` fijo — ahora editable como
 * cualquier `spacing.margin` normal desde el Inspector (`SidesGrid`).
 * `padding`/`background` se neutralizan porque `container` trae estilo visual
 * propio por defecto (docs/03 §4) que aquí no queremos (este nodo es
 * puramente de layout).
 */
export const TESTIMONIAL_CAPTION_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex", alignItems: "center", gap: "12px" },
    spacing: { padding: "0", margin: "16px 0 0 0" },
    size: { minHeight: "0" },
    appearance: { background: "transparent" },
  },
};

/** `avatar` de iniciales, 40×40 (override del tamaño default 48×48). */
export const TESTIMONIAL_AVATAR_STYLE: NodeStyle = {
  base: { size: { width: "40px", height: "40px" }, typography: { fontSize: { token: "typography.sizes.sm" } } },
};

/** `container` columna nombre+cargo, sin estilo visual propio (solo layout). */
export const TESTIMONIAL_AUTHOR_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex", flexDirection: "column", gap: "0" },
    spacing: { padding: "0", margin: "0" },
    size: { minHeight: "0" },
    appearance: { background: "transparent" },
  },
};

/** `text` del nombre: bold (antes `NAME_STYLE`). */
export const TESTIMONIAL_NAME_STYLE: NodeStyle = {
  base: { typography: { fontWeight: { token: "typography.weights.bold" } }, spacing: { margin: "0" } },
};

/**
 * `text` del cargo: tamaño sm + color atenuado (antes `ROLE_STYLE.opacity`).
 * El modelo de estilo no tiene campo `opacity`; se usa el token `colors.muted`
 * (mismo patrón de "texto secundario" ya usado en toda la app) para lograr el
 * mismo efecto visual de jerarquía sin introducir un campo nuevo.
 */
export const TESTIMONIAL_ROLE_STYLE: NodeStyle = {
  base: {
    typography: { fontSize: { token: "typography.sizes.sm" } },
    appearance: { color: { token: "colors.muted" } },
    spacing: { margin: "0" },
  },
};

/** `defaultChildren` sembrados al crear un `testimonial` nuevo desde la paleta. */
export const TESTIMONIAL_DEFAULT_CHILDREN: DefaultChildSpec[] = [
  {
    type: "text",
    props: { content: "<p>This product completely changed the way we work.</p>" },
    style: TESTIMONIAL_QUOTE_STYLE,
  },
  {
    type: "container",
    style: TESTIMONIAL_CAPTION_STYLE,
    children: [
      { type: "avatar", props: { initials: "AG" }, style: TESTIMONIAL_AVATAR_STYLE },
      {
        type: "container",
        style: TESTIMONIAL_AUTHOR_STYLE,
        children: [
          { type: "text", props: { content: "<strong>Ana Garcia</strong>" }, style: TESTIMONIAL_NAME_STYLE },
          { type: "text", props: { content: "CEO, Acme Inc." }, style: TESTIMONIAL_ROLE_STYLE },
        ],
      },
    ],
  },
];

function TestimonialRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;
  const isEmpty = !node.children || node.children.length === 0;

  return (
    <figure
      ref={rootRef as Ref<HTMLElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {children}
      {!exportMode && isEmpty ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Empty testimonial — add the quote and author
        </span>
      ) : null}
    </figure>
  );
}

export const testimonialDefinition: ComponentDefinition = {
  type: "testimonial",
  label: "Testimonio",
  category: "content",
  acceptsChildren: true,
  defaultProps: {},
  defaultStyle: structuredClone(TESTIMONIAL_DEFAULT_STYLE),
  defaultChildren: TESTIMONIAL_DEFAULT_CHILDREN,
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: TestimonialRender,
};
