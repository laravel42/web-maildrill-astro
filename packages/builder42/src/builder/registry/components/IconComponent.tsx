/**
 * Icon — SVG inline backed by lucide core (1994+ icons).
 *
 * Usa el paquete `lucide` (core, no lucide-react) que exporta cada icono como
 * un array de `[tagName, attrs][]` — datos SVG puros, sin dependencia de React.
 * El sitio exportado es cero-JS (P8): el render produce SVG estático que
 * `renderToStaticMarkup` serializa sin React en el output.
 *
 * Contrato:
 *  - `props.name` (PROP, P6): nombre del icono lucide (ej: "Star", "Heart").
 *    Fallback a "Star" si el nombre no existe.
 *  - `props.pressedName` (PROP, opcional): nombre del icono lucide a mostrar
 *    cuando el nodo está en estado `pressed` (behavior `toggle`). Solo
 *    aplica si el nodo tiene el behavior `toggle` adjunto (P4). El render
 *    emite `data-pb-icon-default-content` y `data-pb-icon-pressed-content` con
 *    el innerHTML completo de cada glifo para que el `enhanceToggle`
 *    (`runtime/behaviors/toggle.ts`) haga el swap del glifo en cada click
 *    (un solo reemplazo limpio, sin remanentes). En el canvas, cuando
 *    `ctx.previewState === "pressed"`, el render YA pinta directamente el
 *    icono alternativo (sin esperar al click) — es UI-state del Inspector,
 *    no del documento (P1).
 *  - `props.title` (PROP, traducible P9): etiqueta accesible opcional.
 *  - color: STYLE `appearance.color` → el SVG usa `currentColor`.
 *  - tamaño: STYLE `size.width`/`height` (24px por defecto).
 *
 * Render puro (P3): raíz `<svg>` con `rootRef`/`rootProps` sin wrapper.
 */

import React, { type CSSProperties, type ReactElement, type Ref, type SVGProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DEFAULT_BREAKPOINTS, type NodeStyle } from "../../model/types";
import { resolveStyle } from "../../model/style";
import { stylePropertiesToCSSObject } from "../styleToCss";
import type { ComponentDefinition, RenderContext } from "../types";
import { lucideCatalog, type LucideGlyph, type LucideIconNode } from "../catalogs/lucide.catalog";

type IconNode = LucideIconNode;

const DEFAULT_ICON_NAME = "Star";

function resolveIcon(name: string): LucideGlyph | undefined {
  return lucideCatalog.get(name);
}

/** Alias para mantener compatibilidad con el resto del componente. */
export const ICON_NAMES: readonly string[] = lucideCatalog.names();

function renderIconNodes(nodes: IconNode[]): ReactElement[] {
  return nodes.map(([tag, attrs], i) => {
    const { key: _key, ...svgAttrs } = attrs;
    return React.createElement(tag, { key: i, ...svgAttrs });
  });
}

/**
 * Serializa el contenido INTERNO de un icono Lucide (los `<path>`, `<circle>`,
 * `<line>`, etc., sin el `<svg>` raíz) a un string HTML. Lo usamos para el
 * swap de glifo en runtime (`enhanceToggle`, `runtime/behaviors/toggle.ts`):
 * cada click reemplaza `svg.innerHTML` por el blob destino, sin remanentes
 * (bug real: antes solo capturábamos `<path>` vía `pathsOf`, e iconos como
 * `Sun` (1 `<circle>` + 8 `<path>`) dejaban el `<circle>` "pegado" en el DOM
 * al alternar con `Moon` (1 `<path>`)).
 *
 * Reutiliza el MISMO render de React (`renderIconNodes`) que pinta el icono en
 * el canvas → paridad total con lo que ve el usuario: si React agrega un
 * atributo nuevo a un `<path>` mañana, este helper lo captura sin tocar nada.
 * El único requisito es que el render funcione en `react-dom/server`
 * (verificado: `IconRender` ya lo usa vía `exportToHtml`).
 *
 * Devuelve `""` si `iconData` es `undefined`.
 */
function innerHtmlOf(iconData: IconNode[] | undefined): string {
  if (!iconData) return "";
  // Envolvemos en un `<svg>` temporal para que `renderToStaticMarkup` produzca
  // HTML bien formado; luego quitamos las etiquetas `<svg>...</svg>` envolventes
  // para quedarnos SOLO con el contenido interno que `enhanceToggle` va a
  // inyectar en `svg.innerHTML`.
  const wrapper = React.createElement(
    "svg",
    { viewBox: "0 0 24 24" },
    renderIconNodes(iconData),
  );
  const fullHtml = renderToStaticMarkup(wrapper);
  // `fullHtml` es exactamente `<svg ...>...</svg>`. Extraemos el innerHTML con
  // un regex simple — los SVG de Lucide no tienen `<` literales en sus attrs,
  // así que un match codicioso por la primera `>` y la última `</svg>` es
  // seguro. Más explícito que parsear con DOMParser (jsdom no está aquí).
  const openEnd = fullHtml.indexOf(">");
  const closeStart = fullHtml.lastIndexOf("</svg>");
  if (openEnd === -1 || closeStart === -1 || closeStart < openEnd) return "";
  return fullHtml.slice(openEnd + 1, closeStart);
}

/** Preview en miniatura de un icono lucide por nombre, para el picker del Inspector. */
function renderIconOptionPreview(name: string): ReactElement | null {
  const iconData = resolveIcon(name);
  if (!iconData) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {renderIconNodes(iconData)}
    </svg>
  );
}

/**
 * ¿Este nodo `icon` tiene el behavior `toggle` adjunto? Lo usamos para decidir
 * si el campo `pressedName` se evalúa (solo aplica si está) y si emitimos los
 * atributos `data-pb-icon-*-paths` para que el runtime haga el swap.
 */
function hasToggleBehavior(node: { behaviors?: { type: string }[] | undefined }): boolean {
  return (node.behaviors ?? []).some((b) => b.type === "toggle");
}

/**
 * Lee la opción `pressed` del behavior `toggle` adjunto (si existe). Es el
 * ESTADO INICIAL del toggle en el sitio exportado (`Iniciar activo` en el
 * Inspector): `true` = el nodo arranca con `aria-pressed="true"` y debe pintar
 * el glifo `pressedName` desde el primer render. UI-state de runtime, NO del
 * documento: en el editor previsualizamos el mismo estado en el canvas (P3:
 * canvas ↔ export deben coincidir) para que el usuario vea lo que va a salir.
 */
function toggleStartsPressed(node: { behaviors?: { type: string; options?: Record<string, unknown> }[] | undefined }): boolean {
  const toggle = (node.behaviors ?? []).find((b) => b.type === "toggle");
  return toggle?.options?.pressed === true;
}

function IconRender(ctx: RenderContext) {
  const { node, exportMode, className, breakpoint, rootRef, rootProps, previewState } = ctx;
  const style: CSSProperties | undefined = exportMode
    ? undefined
    : stylePropertiesToCSSObject(resolveStyle(node.style, breakpoint, DEFAULT_BREAKPOINTS));

  const rawName = typeof node.props.name === "string" ? node.props.name : "";
  const rawPressedName = typeof node.props.pressedName === "string" ? node.props.pressedName : "";
  const startsPressed = hasToggleBehavior(node) && toggleStartsPressed(node) && rawPressedName !== "";
  // El glifo pressed se pinta cuando:
  //  (a) el Inspector está previsualizando el estado `pressed` (UI-state local
  //      para que el usuario estilice el estado), O
  //  (b) la opción `pressed: true` del behavior está activa (estado inicial del
  //      toggle en el sitio exportado, debe verse igual en el canvas por P3).
  // Sin behavior toggle, `pressedName` se ignora (regla ya documentada).
  const isPressed = (previewState === "pressed" || startsPressed) && hasToggleBehavior(node) && rawPressedName !== "";
  const activeName = isPressed ? rawPressedName : rawName;
  const iconData = resolveIcon(activeName) ?? lucideCatalog.get(DEFAULT_ICON_NAME);
  const title = typeof node.props.title === "string" && node.props.title !== "" ? node.props.title : "";

  // Atributos para el swap de glifo en runtime (`enhanceToggle`,
  // `runtime/behaviors/toggle.ts`). Solo se emiten si: el nodo tiene el behavior
  // `toggle` Y ambos `name`/`pressedName` resuelven a iconos válidos. Cada
  // atributo lleva el innerHTML COMPLETO del `<svg>` destino (`innerHtmlOf`,
  // serializado vía `renderToStaticMarkup` para paridad con el render del
  // canvas). El click de `enhanceToggle` reemplaza `svg.innerHTML` por el blob
  // destino — un solo reemplazo limpio, sin remanentes de formas SVG no-path
  // (`<circle>`, `<line>`, `<rect>`…) que el swap anterior basado en `<path>`
  // dejaba pegadas (bug real con `Moon` ↔ `Sun`). En export también se emiten
  // (metadata inocua, sin listeners — `enhance` solo corre si el runtime
  // carga el módulo). Sin esto el click solo alterna `aria-pressed` y el glifo
  // se queda fijo (CSS-only, comportamiento previo).
  const defaultIconData = resolveIcon(rawName);
  const pressedIconData = rawPressedName !== "" ? resolveIcon(rawPressedName) : undefined;
  const shouldEmitSwapAttrs =
    hasToggleBehavior(node) && defaultIconData && pressedIconData;
  const swapAttrs: Record<string, string> | undefined = shouldEmitSwapAttrs
    ? {
        "data-pb-icon-default-content": innerHtmlOf(defaultIconData),
        "data-pb-icon-pressed-content": innerHtmlOf(pressedIconData),
      }
    : undefined;

  const { className: rootClassName, ...restRootProps } = rootProps ?? {};
  const mergedClassName = [className, rootClassName].filter(Boolean).join(" ") || undefined;

  return (
    <svg
      ref={rootRef as unknown as Ref<SVGSVGElement> | undefined}
      className={mergedClassName}
      style={style}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      {...swapAttrs}
      {...(restRootProps as SVGProps<SVGSVGElement>)}
    >
      {title ? <title>{title}</title> : null}
      {iconData ? renderIconNodes(iconData) : null}
    </svg>
  );
}

const ICON_DEFAULT_STYLE: NodeStyle = {
  base: {
    layout: { display: "inline-block" },
    size: { width: "24px", height: "24px" },
    appearance: { color: { token: "colors.text" } },
  },
};

export const iconDefinition: ComponentDefinition = {
  type: "icon",
  label: "Icono",
  category: "content",
  acceptsChildren: false,
  defaultProps: { name: DEFAULT_ICON_NAME, pressedName: "", title: "" },
  defaultStyle: structuredClone(ICON_DEFAULT_STYLE),
  propsSchema: {
    fields: [
      {
        key: "name",
        label: "Icono",
        control: "searchable-select",
        options: ICON_NAMES.map((n) => ({ label: n, value: n })),
        renderOptionPreview: renderIconOptionPreview,
        group: "Contenido",
        placeholder: "Star, Heart, Mail, Check…",
      },
      {
        key: "pressedName",
        label: "Icono (presionado)",
        control: "searchable-select",
        options: ICON_NAMES.map((n) => ({ label: n, value: n })),
        renderOptionPreview: renderIconOptionPreview,
        group: "Contenido",
        placeholder: "Heart, Star…",
        help: "iconPressed.help",
        // Solo aparece cuando el nodo tiene el behavior `toggle` adjunto
        // (mismo predicado que `inspector/InspectorForm.tsx` usa para mostrar
        // el estado "Activo" en el selector). Sin toggle, este campo no
        // haría nada (el runtime solo hace swap si el enhance está cargado).
        visibleWhen: (n) => (n.behaviors ?? []).some((b) => b.type === "toggle"),
      },
      { key: "title", label: "Etiqueta accesible", control: "text", group: "Contenido", translatable: true },
    ],
  },
  styleSchema: { enabledGroups: ["size", "appearance", "spacing"] },
  render: IconRender,
};
