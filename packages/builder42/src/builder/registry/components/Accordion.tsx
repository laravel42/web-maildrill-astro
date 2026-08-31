/**
 * Accordion — secciones colapsables (FAQ), **composite con slots** (docs/23).
 * Interactivo: trae de fábrica el behavior `accordion` (`defaultBehaviors`) que
 * anima apertura/cierre con WAAPI y aplica "solo una abierta" (runtime opt-in).
 *
 * Modelo children-based (docs/23 §3.1): cada sección es un nodo hijo
 * `accordion-item` (`slots.itemType`) que renderiza su propio
 * `<details>/<summary>` (slot AUTOCONTENIDA), así que el `accordion` solo pinta
 * el contenedor y renderiza `ctx.children` en secuencia — SIN `splitRender`.
 * El contenido de cada sección son nodos reales (texto rich, imágenes, …),
 * cubriendo el pedido de "accordion con editor rich" (docs/23 §1) con el mismo
 * mecanismo.
 *
 * Degrada sin JS (P8/P9): `<details>` nativo colapsa igual. En Edit el runtime
 * no corre → cada `accordion-item` fuerza `open` (contenido visible/editable).
 * El `data-pb-behavior` lo añade el export desde `node.behaviors` (docs/10 §4).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const ACCORDION_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "flex", flexDirection: "column" },
    size: { width: "100%" },
    typography: {
      fontFamily: { token: "typography.families.sans" },
      fontSize: { token: "typography.sizes.base" },
      lineHeight: { token: "typography.lineHeights.normal" },
    },
    appearance: {
      color: { token: "colors.text" },
      borderRadius: { token: "radii.md" },
    },
  },
};

/**
 * CSS estático presentacional (T10, AGENTS.md): cabecera (`summary`), chevron
 * animado (rotación por `[open]`, CSS puro) y panel recortable de cada
 * sección (`accordion-item`) — nada de esto depende de que el behavior
 * `accordion` esté adjunto. Vive en el padre `accordion` (no en
 * `accordion-item`, que es `hiddenInPalette` y nunca existe sin su padre) y se
 * emite mientras exista al menos un nodo `accordion` en el documento. Sin JS,
 * este CSS ya estiliza el `<details>` nativo (progressive enhancement).
 */
const ACCORDION_CSS = [
  ".pb-accordion__item { border-bottom: 1px solid var(--colors-border, rgba(0, 0, 0, 0.12)); }",
  ".pb-accordion__summary { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 4px; cursor: pointer; list-style: none; font-weight: 600; }",
  ".pb-accordion__summary::-webkit-details-marker { display: none; }",
  ".pb-accordion__summary:focus-visible { outline: 2px solid var(--colors-primary-default, #2563eb); outline-offset: 2px; border-radius: 4px; }",
  ".pb-accordion__chevron { flex-shrink: 0; width: 18px; height: 18px; transition: transform 0.25s ease; }",
  ".pb-accordion__item[open] > .pb-accordion__summary .pb-accordion__chevron { transform: rotate(180deg); }",
  ".pb-accordion__panel { overflow: hidden; }",
  ".pb-accordion__content { padding: 0 4px 16px; }",
  "@media (prefers-reduced-motion: reduce) { .pb-accordion__chevron { transition: none; } }",
].join("\n");

function AccordionRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps, slotAffordance } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName =
    ["pb-accordion", className, rootClassName].filter(Boolean).join(" ") || undefined;
  const isEmpty = !node.children || node.children.length === 0;

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {children}
      {!exportMode && isEmpty ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Acordeón vacío — añade una sección
        </span>
      ) : null}
      {slotAffordance}
    </div>
  );
}

export const accordionDefinition: ComponentDefinition = {
  type: "accordion",
  label: "Acordeón",
  category: "content",
  acceptsChildren: true,
  slots: { itemType: "accordion-item", min: 1, addLabel: "Añadir sección" },
  defaultProps: {},
  defaultStyle: structuredClone(ACCORDION_DEFAULT_STYLE),
  css: ACCORDION_CSS,
  // Interactivo de fábrica (Bloque D): trae su runtime opt-in al crearse.
  defaultBehaviors: [{ type: "accordion", options: { single: true, duration: 280 } }],
  // Un acordeón nuevo nace con 3 secciones (docs/23 §7); la 1.ª abierta.
  defaultChildren: [
    { type: "accordion-item", props: { label: "¿Qué incluye el plan?", openByDefault: true }, children: [{ type: "text", props: { content: "<p>Acceso completo a todas las funciones, sin límites de uso.</p>" } }] },
    { type: "accordion-item", props: { label: "¿Puedo cancelar cuando quiera?" }, children: [{ type: "text", props: { content: "<p>Sí, puedes cancelar tu suscripción en cualquier momento.</p>" } }] },
    { type: "accordion-item", props: { label: "¿Ofrecen soporte?" }, children: [{ type: "text", props: { content: "<p>Soporte por correo y chat en horario laboral.</p>" } }] },
  ],
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["typography", "spacing", "size", "appearance"] },
  render: AccordionRender,
};
