/**
 * Toggle — behavior genérico de estado propio al click (docs/10). Convierte
 * CUALQUIER nodo en un interruptor que alterna `aria-pressed` en sí mismo,
 * sin acoplarse a ningún concepto de dominio (tema, favoritos…): el usuario
 * decide qué significa "activo" estilando el estado `pressed` del nodo desde
 * el Inspector (T9, `[aria-pressed="true"]`, `export/cssSerializer.ts`).
 *
 * A diferencia de `theme-toggle`, este behavior NO persiste en `localStorage`
 * (estado de sesión, se resetea al recargar) y no toca `document.documentElement`
 * — solo el propio elemento. Útil como bloque genérico para un like/favorito
 * visual, un icono que cambia de apariencia al presionar, un disclosure
 * custom, etc.
 *
 * Swap de glifo (opcional, específico para el componente `icon`): cuando el
 * nodo es un `<svg>` (renderizado por `registry/components/IconComponent.tsx`)
 * con los atributos `data-pb-icon-pressed-content` y `data-pb-icon-default-content`
 * (strings con el innerHTML serializado vía `renderToStaticMarkup` del glifo
 * destino, emitidos solo si el usuario configuró `pressedName`), el click
 * reemplaza `svg.innerHTML` por el blob destino — un solo reemplazo limpio
 * que captura TODAS las formas SVG (path/circle/line/rect/…), sin remanentes
 * (bug real con el esquema anterior basado en `data-pb-icon-*-paths` que solo
 * capturaba `<path>`: al alternar Moon ↔ Sun el `<circle>` del sol quedaba
 * pegado en el DOM). Es GENÉRICO desde el punto de vista del enhance: solo
 * conoce el contrato de los atributos; el componente decide qué poner ahí.
 * Si los atributos no existen, el toggle sigue funcionando (solo CSS).
 *
 * Regla dura (P8, docs/10 §11.2): este archivo NUNCA importa de `src/builder/`.
 * Solo conoce el DOM y sus `options`.
 */

export interface ToggleOptions {
  /** Estado inicial de `aria-pressed`. Default `false`. */
  pressed?: boolean;
}

export type Cleanup = () => void;

/** Devuelve el `<svg>` sobre el que aplica el swap de glifo, o `null` si no hay. */
function findSvg(el: HTMLElement): SVGSVGElement | null {
  if (el.tagName === "svg") return el as unknown as SVGSVGElement;
  return el.querySelector("svg");
}

/** Lee el contenido (string) de un atributo del nodo, o `null` si está ausente o vacío. */
function readContentAttr(el: HTMLElement, attr: string): string | null {
  const raw = el.getAttribute(attr);
  if (!raw) return null;
  return raw;
}

/**
 * Aplica el contenido destino al `<svg>` objetivo. Un solo `innerHTML = …` —
 * limpio, captura todas las formas SVG (path/circle/line/rect/polyline/…).
 */
function applySvgContent(svg: SVGSVGElement, content: string): void {
  svg.innerHTML = content;
}

export function enhanceToggle(el: HTMLElement, options: ToggleOptions = {}): Cleanup | void {
  const initialPressed = options.pressed === true;
  el.setAttribute("aria-pressed", String(initialPressed));

  // Swap de glifo (opcional): si el nodo trae `data-pb-icon-pressed-content` y
  // `data-pb-icon-default-content`, en cada click también reemplazamos el
  // `innerHTML` del `<svg>` interno. `false` = glifo default; `true` = glifo
  // alternativo (mismo criterio que aria-pressed).
  const defaultContent = readContentAttr(el, "data-pb-icon-default-content");
  const pressedContent = readContentAttr(el, "data-pb-icon-pressed-content");

  // Estado inicial coherente con `aria-pressed`: si arrancó activo, pintamos el
  // glifo pressed desde el primer render (paridad con lo que el canvas muestra
  // cuando la opción `pressed: true` del behavior está activa — P3). El render
  // estático del HTML ya pintó `name` (default), así que el primer frame
  // muestra el glifo incorrecto si no hacemos este swap aquí.
  if (initialPressed && defaultContent && pressedContent) {
    const svg = findSvg(el);
    if (svg) applySvgContent(svg, pressedContent);
  }

  const onClick = (): void => {
    const isPressed = el.getAttribute("aria-pressed") === "true";
    const next = !isPressed;
    el.setAttribute("aria-pressed", String(next));
    if (defaultContent && pressedContent) {
      const svg = findSvg(el);
      if (svg) applySvgContent(svg, next ? pressedContent : defaultContent);
    }
  };
  el.addEventListener("click", onClick);

  return () => {
    el.removeEventListener("click", onClick);
  };
}

// ---------------------------------------------------------------------------
// Auto-registro para el loader (docs/10 §11, `enhance.ts`)
// ---------------------------------------------------------------------------
declare global {
  interface Window {
    __pbBehaviors?: Record<
      string,
      (el: HTMLElement, options: Record<string, unknown>) => (() => void) | void
    >;
  }
}

if (typeof window !== "undefined") {
  window.__pbBehaviors = window.__pbBehaviors ?? {};
  window.__pbBehaviors.enhanceToggle = (el, options) => enhanceToggle(el, options as ToggleOptions);
}
