/**
 * AccordionItem — NODO DE SLOT del composite `accordion` (docs/23 §3.1, Opción
 * A). Slot AUTOCONTENIDA: a diferencia del `tab`, aquí la cabecera y el
 * contenido son CONTIGUOS en el DOM (`<details>/<summary>`), así que la propia
 * slot pinta su sub-estructura completa y el `accordion` la renderiza como un
 * hijo opaco más (usa `ctx.children`, sin `splitRender`).
 *
 * `props.label` = título de la sección (translatable); `props.openByDefault` =
 * si la sección abre en el sitio publicado; `children` = contenido real
 * (arrastrable). En Edit se fuerza `open` para ver/editar todo el contenido (el
 * runtime que colapsa nunca corre en Edit — AGENTS.md §5). Clases del OUTPUT
 * (`pb-accordion__*`) idénticas a las que espera el behavior (docs/10).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const ACCORDION_ITEM_DEFAULT_STYLE: NodeStyle = { base: {} };

function AccordionItemRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps } = ctx;
  const rawLabel = node.props.label;
  const label = typeof rawLabel === "string" && rawLabel !== "" ? rawLabel : "Sección";
  const openByDefault = node.props.openByDefault === true;
  // Edit: todo abierto (editable); export: `openByDefault` decide el estado sin JS.
  const isOpen = exportMode ? openByDefault : true;

  const style: CSSProperties | undefined = exportMode
    ? undefined
    : {
        position: "relative",
        ...stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS)),
      };

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName =
    ["pb-accordion__item", className, rootClassName].filter(Boolean).join(" ") || undefined;
  const isEmpty = !node.children || node.children.length === 0;

  return (
    <details
      ref={rootRef as Ref<HTMLDetailsElement> | undefined}
      className={mergedClassName}
      style={style}
      {...(isOpen ? { open: true } : {})}
      {...restRootProps}
    >
      <summary className="pb-accordion__summary">
        <span className="pb-accordion__title">{label}</span>
        <svg
          className="pb-accordion__chevron"
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="pb-accordion__panel">
        <div className="pb-accordion__content">
          {children}
          {!exportMode && isEmpty ? (
            <span className="pbx-empty-hint" data-empty-hint>
              Sección vacía — suelta componentes aquí
            </span>
          ) : null}
        </div>
      </div>
    </details>
  );
}

export const accordionItemDefinition: ComponentDefinition = {
  type: "accordion-item",
  label: "Sección",
  category: "content",
  acceptsChildren: true,
  isSlot: "accordion",
  hiddenInPalette: true,
  defaultProps: { label: "Sección", openByDefault: false },
  defaultStyle: structuredClone(ACCORDION_ITEM_DEFAULT_STYLE),
  defaultChildren: [{ type: "text", props: { content: "<p>Contenido de la sección.</p>" } }],
  propsSchema: {
    fields: [
      { key: "label", label: "Título de la sección", control: "text", group: "Contenido", translatable: true },
      { key: "openByDefault", label: "Abierta por defecto", control: "toggle", group: "Contenido" },
    ],
  },
  styleSchema: { enabledGroups: ["spacing", "size", "appearance", "typography"] },
  render: AccordionItemRender,
};
