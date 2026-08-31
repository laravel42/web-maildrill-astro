/**
 * Serializador de estilo a CSS plano (docs/01 §5, P8).
 *
 * Traduce `StyleProperties` (agrupado, camelCase) a declaraciones CSS
 * (kebab-case). Emite, por nodo, la capa `base` sin media query y un bloque
 * `@media (min-width: …)` por cada override, EN ORDEN ascendente de breakpoint
 * para que la cascada CSS coincida con la del modelo (mobile-first).
 *
 * No aplana la cascada: preserva la semántica en capas (a diferencia de
 * `resolveStyle`, que es para el canvas en vivo).
 */

import type {
  BreakpointConfig,
  NodeStyle,
  StyleGroup,
  StyleProperties,
  StyleState,
  StyleValue,
} from "../model/types";
import { styleValueToCss } from "../model/tokens";

const STYLE_GROUPS: StyleGroup[] = ["layout", "spacing", "size", "appearance", "typography"];

/**
 * Selector CSS de cada estado editable (T9, AGENTS.md). `hover` es una
 * pseudo-clase nativa, aplicable a cualquier nodo; `selected` es un estado ARIA
 * de un componente compuesto (hoy solo el botón de `tab` dentro de `tabs`, vía
 * `selectorSuffix` en `serializeNodeCss` — la clase que lleva `[aria-selected]`
 * no es la del nodo raíz de `tabs`, sino una clase derivada por botón).
 * `pressed` es el estado ARIA que escribe el behavior genérico `toggle`
 * (`registry/behaviors/toggle.ts`) sobre el propio elemento raíz del nodo —
 * a diferencia de `selected`, nunca necesita `statesClassName`: la clase raíz
 * (`n-{id}`) que cualquier componente ya emite es el ancla correcta.
 */
export const STATE_SELECTORS: Record<StyleState, string> = {
  hover: ":hover",
  selected: '[aria-selected="true"]',
  pressed: '[aria-pressed="true"]',
};

function camelToKebab(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/** Convierte un `StyleProperties` (o parcial) en declaraciones CSS "prop: value;". */
export function serializeDeclarations(sp: Partial<StyleProperties>): string {
  const decls: string[] = [];
  for (const group of STYLE_GROUPS) {
    const values = sp[group];
    if (!values) continue;
    for (const [key, value] of Object.entries(values)) {
      // undefined/"" = "no declarado" (hereda); nunca se emite (docs/01 §7).
      // Una referencia a token se emite como var(--…) (docs/08 §4).
      const css = styleValueToCss(value as StyleValue | undefined);
      if (css === undefined) continue;
      decls.push(`${camelToKebab(key)}: ${css};`);
    }
  }
  return decls.join(" ");
}

/**
 * Un contenedor con `overflow-x: auto|scroll` (slider horizontal) necesita que
 * sus hijos NO se encojan; si no, flexbox los comprime para caber y no queda
 * nada que scrollear. Devuelve la declaración `flex` para la regla `.n-id > *`,
 * o `null` si el valor de overflow no activa/desactiva el modo slider.
 *
 * - auto/scroll → hijos no-encogibles + `scroll-snap-align: start` (encaje).
 * - visible/hidden/clip en un OVERRIDE → restablece el comportamiento por defecto
 *   (para poder "apagar" el slider en un breakpoint mayor).
 */
function sliderOn(overflowX: string | undefined): boolean {
  return overflowX === "auto" || overflowX === "scroll";
}

/** Declaraciones para los hijos del slider (`.n-id > *`). */
function childDeclsForOverflow(
  overflowX: string | undefined,
  isOverride: boolean,
): string | null {
  if (sliderOn(overflowX)) return "flex: 0 0 auto; scroll-snap-align: start;";
  if (isOverride && overflowX !== undefined) return "flex: 0 1 auto; scroll-snap-align: none;";
  return null;
}

/** Declaraciones extra del contenedor slider (snap + barra oculta, sin JS). */
function containerSnapDecls(
  overflowX: string | undefined,
  isOverride: boolean,
): string | null {
  if (sliderOn(overflowX)) return "scroll-snap-type: x mandatory; scrollbar-width: none;";
  if (isOverride && overflowX !== undefined) return "scroll-snap-type: none;";
  return null;
}

/** ¿Alguna capa (base u override) activa el modo slider? */
function hasAnySlider(style: NodeStyle): boolean {
  if (sliderOn(style.base.layout?.overflowX)) return true;
  const overrides = style.overrides;
  if (!overrides) return false;
  return Object.values(overrides).some((o) => sliderOn(o?.layout?.overflowX));
}

/**
 * CSS de un nodo: regla base + un `@media` por override (orden ascendente) +
 * reglas de estado (T9). Devuelve "" si el nodo no tiene ninguna declaración.
 *
 * `statesClassName` (T9): clase a la que se anclan las reglas de `style.states`,
 * si es DISTINTA de `className` — caso de un elemento del render que no es la
 * raíz del nodo (p. ej. el botón de cada `tab` dentro de `tabs`: no puede
 * llevar la clase raíz sin heredar `display`/`width` del contenedor `tabs`,
 * así que el estado `selected` se ancla a una clase propia del botón en vez de
 * mezclarse con la regla base/overrides). Por defecto (ausente), usa el mismo
 * `className` — caso normal, un solo elemento por nodo.
 */
export function serializeNodeCss(
  className: string,
  style: NodeStyle,
  cfg: BreakpointConfig,
  statesClassName?: string,
): string {
  const blocks: string[] = [];

  // Regla base: declaraciones + (si slider) snap + ocultar barra.
  const baseDeclParts = [serializeDeclarations(style.base), containerSnapDecls(style.base.layout?.overflowX, false)]
    .filter(Boolean)
    .join(" ");
  if (baseDeclParts) blocks.push(`.${className} { ${baseDeclParts} }`);

  // Regla de hijos (no-encogibles + snap) para slider (capa base).
  const baseChild = childDeclsForOverflow(style.base.layout?.overflowX, false);
  if (baseChild) blocks.push(`.${className} > * { ${baseChild} }`);

  for (const bp of cfg.order) {
    if (bp === "base") continue;
    const override = style.overrides?.[bp];
    if (!override) continue;
    const minWidth = cfg.minWidth[bp];

    const declParts = [serializeDeclarations(override), containerSnapDecls(override.layout?.overflowX, true)]
      .filter(Boolean)
      .join(" ");
    if (declParts) {
      blocks.push(`@media (min-width: ${minWidth}px) { .${className} { ${declParts} } }`);
    }
    // Regla de hijos por breakpoint (activa/desactiva el slider en ese tamaño).
    const childDecls = childDeclsForOverflow(override.layout?.overflowX, true);
    if (childDecls) {
      blocks.push(
        `@media (min-width: ${minWidth}px) { .${className} > * { ${childDecls} } }`,
      );
    }
  }

  // Ocultar la barra de scroll en WebKit (sin JS). Inocuo si nunca scrollea.
  if (hasAnySlider(style)) {
    blocks.push(`.${className}::-webkit-scrollbar { display: none; }`);
  }

  // Estados de interacción (T9, AGENTS.md): una regla por estado declarado en
  // `style.states`, con el selector fijo de `STATE_SELECTORS` (p. ej.
  // `.n-id:hover` o `.n-id--tab[aria-selected="true"]`). Ancladas a
  // `statesClassName` si se pasó (elemento distinto de la raíz del nodo);
  // si no, a la misma `className`. Sin `@media`: `states` es plano (T9).
  if (style.states) {
    const stateClass = statesClassName ?? className;
    for (const [state, decls] of Object.entries(style.states) as [StyleState, Partial<StyleProperties>][]) {
      if (!decls) continue;
      const declParts = serializeDeclarations(decls);
      if (declParts) {
        blocks.push(`.${stateClass}${STATE_SELECTORS[state]} { ${declParts} }`);
      }
    }
  }

  return blocks.join("\n");
}

/**
 * Clase generada por nodo (docs/01 §5). `suffix` (T9): variante derivada para
 * un elemento del render que NO es la raíz del nodo (p. ej. el botón de cada
 * `tab` dentro de `tabs`) — genera `n-{id}--{suffix}`, útil como
 * `statesClassName` en `serializeNodeCss` para anclar reglas de estado sin
 * mezclarlas con la regla base/overrides del nodo raíz.
 */
export function classNameForNode(nodeId: string, suffix?: string): string {
  return suffix ? `n-${nodeId}--${suffix}` : `n-${nodeId}`;
}
