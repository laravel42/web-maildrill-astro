/**
 * Card — tarjeta: contenedor semántico `<article>` (docs/16 §12.1 #10, §12.2).
 *
 * Componente `content` que ACEPTA HIJOS (como `container`/`section`/`form`): es
 * un "contenedor semántico" con chrome de tarjeta por defecto (superficie +
 * borde + radio + sombra + padding, todo por tokens). El usuario lo rellena con
 * los building blocks existentes (`image`, `text`, `button`) — §12.2.
 *
 * Decisión D4 (docs/16): se entrega como contenedor vacío estilizable, NO como
 * plantilla que se pre-puebla o se "descompone". Pre-poblar con un subárbol
 * (image+title+desc+CTA) es una feature transversal de inserción de plantillas
 * (Fase 13, `layoutRegistry`), no per-componente — queda diferido para revisión
 * del usuario.
 *
 * Render puro (P3): raíz `<article>` con `rootRef`/`rootProps` sin wrapper; en
 * `exportMode` sin estilo inline (CSS por clase, AGENTS.md §5) y HTML puro (P8).
 */

import type { CSSProperties, Ref } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const CARD_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      alignItems: "stretch",
      overflowX: "hidden",
      overflowY: "hidden",
    },
    spacing: { padding: "16px" },
    size: { minHeight: "64px" },
    appearance: {
      background: { token: "colors.surface.default" },
      borderColor: { token: "colors.border" },
      borderWidth: "1px",
      borderStyle: "solid",
      borderRadius: { token: "radii.md" },
      boxShadow: { token: "shadows.sm" },
    },
  },
};

function CardRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps, suppressClip } = ctx;
  const resolved = resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS);

  // En canvas (edición) el runtime no corre y el usuario necesita soltar/
  // seleccionar/arrastrar hijos DENTRO de la tarjeta. El `overflow:hidden` que
  // `CARD_DEFAULT_STYLE` aplica (para recortar los hijos al radio en el sitio
  // publicado) esconde en Edit cualquier contenido recién soltado que asome del
  // recuadro y estorba el feedback de drop — el mismo antipatrón que documenta
  // AGENTS.md §5 para `Container`. Por eso, sólo en Edit:
  //   - `position:relative` ancla el overlay del indicador de drop (chrome, no
  //     se exporta — P8); si el usuario fija su propia `position`, la suya gana
  //     (spread después).
  //   - se ANULA el recorte (`overflow*`) para dejar los hijos en flujo normal
  //     y seleccionables. Con `suppressClip` (un behavior que recorta, p. ej.
  //     `carousel`) también se libera el alto fijo, igual que `Container`.
  // Preview (iframe) y export conservan el recorte real al radio.
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : {
        position: "relative",
        ...stylePropertiesToCSSObject(resolved),
        overflow: "visible",
        overflowX: "visible",
        overflowY: "visible",
        ...(suppressClip ? { maxHeight: "none", height: "auto" } : null),
      };

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
          Empty card — drop an image, text, or button
        </span>
      ) : null}
    </article>
  );
}

export const cardDefinition: ComponentDefinition = {
  type: "card",
  label: "Tarjeta",
  category: "content",
  acceptsChildren: true,
  defaultProps: {},
  defaultStyle: structuredClone(CARD_DEFAULT_STYLE),
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["layout", "spacing", "size", "appearance", "typography"] },
  render: CardRender,
};
