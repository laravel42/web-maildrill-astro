/**
 * Visibilidad por breakpoint (docs/01 §5, docs/04 Fase 3) — lógica PURA,
 * testeable sin React ni DOM (P7).
 *
 * "Ocultar en un breakpoint" = `layout.display = "none"` en la capa de ese
 * breakpoint. Como `display` cascada mobile-first (`resolveStyle`), ocultar en
 * `md` oculta en `md`+ hasta que una capa superior lo vuelva a declarar.
 *
 * El caso delicado es MOSTRAR: `display` es una sola propiedad, así que al
 * ocultar se sobreescribió el valor visible (`flex`/`grid`/…). Para restaurar
 * elegimos, en orden:
 *   1. Si una capa POR DEBAJO del breakpoint activo ya resuelve a un display
 *      visible → basta con RESETEAR la capa activa (hereda ese valor).
 *   2. Si no (oculto desde una capa inferior, o es `base`), usar el display por
 *      defecto del componente (`def.defaultStyle.base.layout.display`).
 *   3. Si el componente no declara display (imagen, botón… usan el natural del
 *      elemento) → RESETEAR para volver al display natural del tag.
 */

import type { Breakpoint, BreakpointConfig, NodeStyle } from "./types";
import { resolveStyle } from "./style";

/** ¿El nodo queda oculto (display:none resuelto) en este breakpoint? */
export function isHiddenAt(
  style: NodeStyle,
  bp: Breakpoint,
  cfg: BreakpointConfig,
): boolean {
  return resolveStyle(style, bp, cfg).layout?.display === "none";
}

/**
 * Acción a aplicar para MOSTRAR el nodo en `bp` (asumiendo que ahora está
 * oculto ahí):
 *  - `{ reset: true }`   → `resetStyleProp(bp, ["layout","display"])` (hereda /
 *                          vuelve al display natural del elemento).
 *  - `{ set: value }`    → `setStyleProp(bp, ["layout","display"], value)`.
 *
 * `defaultDisplay` es el display por defecto del componente
 * (`def.defaultStyle.base.layout?.display`), o `undefined` si no declara uno.
 */
export function computeShowAction(
  style: NodeStyle,
  bp: Breakpoint,
  cfg: BreakpointConfig,
  defaultDisplay: string | undefined,
): { reset: true } | { set: string } {
  const order = cfg.order;
  const idx = order.indexOf(bp);
  // Display resuelto por las capas INFERIORES a `bp` (excluye la capa activa,
  // que es la que tiene el `none`). En `base` no hay capa inferior.
  const below =
    idx > 0 ? resolveStyle(style, order[idx - 1]!, cfg).layout?.display : undefined;

  // 1. Hay un display visible heredable desde abajo → resetear y heredarlo.
  if (below !== undefined && below !== "none") return { reset: true };
  // 2. El componente declara un display propio (container → flex) → restaurarlo.
  if (defaultDisplay !== undefined && defaultDisplay !== "none") {
    return { set: defaultDisplay };
  }
  // 3. Se HEREDA `none` de una capa inferior (p. ej. oculto en base) y el
  //    componente no tiene display propio (image/button/text). Resetear NO
  //    basta: seguiría heredando `none` y el nodo quedaría oculto igual (bug
  //    "se hereda el último estado"). Hay que SOBREESCRIBIR con un display
  //    visible específico de esta capa. `revert` = display natural del tag
  //    (img→inline, div→block…), sin inventar un valor concreto ni pisar el
  //    natural con `block`. Así "ocultar en mobile + mostrar en desktop" deja
  //    `base:none` + `<bp>:revert` — edición específica por breakpoint.
  if (below === "none") return { set: "revert" };
  // 4. No se hereda nada (ni `none`) y no hay default → basta quitar nuestro
  //    propio `none` de esta capa y volver al display natural del elemento.
  return { reset: true };
}
