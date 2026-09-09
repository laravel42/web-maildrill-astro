/**
 * LogoCloud — "trusted by": fila/grid de logos de clientes (docs/16 §12.1 #14).
 *
 * Componente `content` que ACEPTA HIJOS: contenedor con layout de logos (flex
 * wrap centrado con gap generoso) por tokens. El usuario coloca dentro
 * componentes `image` (los logos). Prueba social típica de landings.
 *
 * Render puro (P3): raíz `<div>` con `rootRef`/`rootProps` sin wrapper; en
 * `exportMode` sin estilo inline (CSS por clase, AGENTS.md §5) y HTML puro (P8).
 *
 * **Behavior `marquee` (docs/44 §5 fila P1):** cuando el nodo tiene el
 * behavior `marquee` adjunto, este componente (no el core, P4 — el core no
 * sabe qué es "logo-cloud" ni "marquee") pasa a:
 * 1. Envolver los hijos en una "pista" (`data-pb-marquee-track`) DUPLICADA —
 *    dos copias consecutivas de los mismos logos — para que el loop CSS
 *    (`registry/behaviors/marquee.ts`, `@keyframes` que traslada -50%) no
 *    tenga costura visible: cuando la primera copia termina de salir, la
 *    segunda ya ocupa exactamente su lugar. La segunda copia es
 *    `aria-hidden="true"` (decorativa, evita que un lector de pantalla anuncie
 *    cada logo dos veces).
 * 2. Traducir `direction`/`duration` de las opciones del behavior a estilo
 *    inline (`--pb-marquee-duration`) / clase (`pb-marquee--right`) — el CSS
 *    del behavior NO puede leer `data-pb-options` (es JSON, no hay JS
 *    obligatorio en tier 0), así que este componente es quien needs
 *    trasladarlas a algo que CSS puro entienda, en el MISMO `render()` que
 *    usa canvas y export (P3).
 * 3. En modo Edit (`ctx.suppressClip`, ver AGENTS.md §5 — mismo mecanismo que
 *    `Container.tsx`): NO duplica la pista. El recorte real del marquee
 *    (`overflow: hidden` del CSS del behavior, anclado a
 *    `[data-pb-behavior~="marquee"]`) nunca se aplica en el canvas (el
 *    atributo `data-pb-behavior` es exclusivo del export/hidratación real —
 *    no de Edit ni Preview del editor), así que duplicar ahí solo mostraría
 *    el doble de logos sin ningún límite visual que explique por qué — se
 *    muestran los logos reales una sola vez, seleccionables/arrastrables con
 *    normalidad.
 */

import type { CSSProperties, Ref } from "react";
import { Children, cloneElement, isValidElement, type ReactNode } from "react";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";

export const LOGO_CLOUD_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      alignItems: "center",
      gap: "40px",
    },
    spacing: { padding: "24px" },
    size: { width: "100%", minHeight: "48px" },
    // Vinculado a tokens base (AGENTS-COMPONENTS §2): sin color de fondo propio
    // (es una fila de logos, no una superficie), pero el color de texto se liga
    // igual que el resto de contenedores de contenido — coherencia con el tema
    // si el usuario agrega texto/alt visible o iconos que heredan currentColor.
    appearance: { color: { token: "colors.text" } },
  },
};

/** ¿El nodo tiene el behavior `marquee` adjunto? (mismo patrón que `IconComponent.hasToggleBehavior`.) */
function marqueeInstance(
  node: { behaviors?: { type: string; options?: Record<string, unknown> }[] | undefined },
): { type: string; options?: Record<string, unknown> } | undefined {
  return (node.behaviors ?? []).find((b) => b.type === "marquee");
}

/** Clona `children` con una `key` derivada (evita colisión con la copia original). */
function duplicateForLoop(children: ReactNode): ReactNode {
  return Children.map(children, (child, i) =>
    isValidElement(child) ? cloneElement(child, { key: `pb-marquee-dup-${child.key ?? i}` }) : child,
  );
}

function LogoCloudRender(ctx: RenderContext) {
  const { node, children, exportMode, className, breakpoint, rootRef, rootProps, suppressClip } = ctx;
  const resolvedStyle = stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const marquee = marqueeInstance(node);
  const marqueeOptions = marquee?.options ?? {};
  const direction = marqueeOptions.direction === "right" ? "right" : "left";
  const duration = typeof marqueeOptions.duration === "number" ? marqueeOptions.duration : 30;
  const pauseOnHover = marqueeOptions.pauseOnHover !== false;

  // El CSS del behavior lee `--pb-marquee-duration` (custom property, ver
  // `registry/behaviors/marquee.ts`) para fijar la velocidad del loop. Esto
  // NO es una excepción al hard rule de AGENTS.md §5 (nunca un `style` fijo
  // mezclado en `render()` que compita con el estilo del usuario): esa regla
  // protege valores PRESENTACIONALES (`display`, `textDecoration`…) que deben
  // vivir en `defaultStyle` para no pisar los breakpoints del usuario. Esta
  // variable no es presentación ni estilo editable por el Inspector de
  // estilo — es DATO DE CONFIGURACIÓN del behavior (duration/direction, ya
  // editables desde el Inspector de Interactividad, `optionsSchema` de
  // `marquee.ts`), análogo a `data-pb-options`. La diferencia es que, a
  // diferencia de esas opciones (JSON leído solo por JS), esta SÍ debe llegar
  // al CSS sin JS (tier 0): CSS no tiene forma de leer JSON en un `animation-
  // duration`, así que el canal es una custom property inline — se emite
  // SIEMPRE (también en `exportMode`), nunca resuelve nada de `node.style`.
  const marqueeStyle: CSSProperties | undefined = marquee
    ? ({ "--pb-marquee-duration": `${duration}s` } as CSSProperties)
    : undefined;

  const style: CSSProperties | undefined = exportMode ? marqueeStyle : { ...resolvedStyle, ...marqueeStyle };

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [
    className,
    rootClassName,
    marquee && direction === "right" ? "pb-marquee--right" : null,
    marquee && !pauseOnHover ? "pb-marquee--no-pause" : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;
  const isEmpty = !node.children || node.children.length === 0;

  // En Edit (`suppressClip`), nunca duplicamos: el recorte real del marquee no
  // aplica en el canvas (ver comentario de arriba), así que mostrar el doble
  // de logos solo confundiría — se listan los hijos reales una sola vez.
  const shouldDuplicate = !!marquee && !isEmpty && !suppressClip;

  const content = shouldDuplicate ? (
    <>
      <span data-pb-marquee-track style={{ display: "contents" }}>
        {children}
      </span>
      <span data-pb-marquee-track aria-hidden="true" style={{ display: "contents" }}>
        {duplicateForLoop(children)}
      </span>
    </>
  ) : (
    children
  );

  return (
    <div
      ref={rootRef as Ref<HTMLDivElement> | undefined}
      className={mergedClassName}
      style={style}
      {...restRootProps}
    >
      {content}
      {!exportMode && isEmpty ? (
        <span className="pbx-empty-hint" data-empty-hint>
          Empty logo cloud — drop logo images
        </span>
      ) : null}
    </div>
  );
}

export const logoCloudDefinition: ComponentDefinition = {
  type: "logo-cloud",
  label: "Muro de logos",
  category: "content",
  acceptsChildren: true,
  defaultProps: {},
  defaultStyle: structuredClone(LOGO_CLOUD_DEFAULT_STYLE),
  propsSchema: { fields: [] },
  styleSchema: { enabledGroups: ["layout", "spacing", "size", "appearance"] },
  render: LogoCloudRender,
};
