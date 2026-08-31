/**
 * Resolvedor de ORIGEN de un valor de estilo (docs/41 §4.5, pieza clave para
 * "cero `(heredar)`, muestra el valor heredado real"). PURO: sin React, sin
 * DOM, sin importar el store (P7). Reutiliza `resolveStyle` (`model/style.ts`)
 * para no reimplementar la cascada mobile-first — este módulo solo decide DE
 * QUÉ CAPA vino el valor, no cómo se mergean las capas.
 */

import type { Breakpoint, BreakpointConfig, NodeStyle } from "@/builder/model/types";
import { resolveStyle } from "@/builder/model/style";

/** `[group, key]`, misma forma que `panel/sections.ts#StylePath` (aquí como tupla de strings sueltos para no acoplar a `StyleGroup`). */
export type StylePath = [string, string];

/**
 * Origen de un valor de estilo para un campo, en un breakpoint activo dado.
 *
 * - `activeLayer`: declarado EN la capa del breakpoint activo del nodo
 *   (`base` si `bp === "base"`, o `style.overrides[bp]` si no). Se pinta
 *   "modificado" (azul) — es el target de reset.
 * - `inheritedLayer`: no está en la capa activa, pero SÍ en una capa inferior
 *   del propio nodo (`from` indica cuál). El valor mostrado es el resuelto por
 *   la cascada hasta el breakpoint activo.
 * - `componentDefault`: ninguna capa del nodo lo declara; viene del
 *   `defaultStyle` del componente (registry). `from` se anota si ese valor,
 *   dentro del `defaultStyle`, vive en un override por breakpoint (ver nota
 *   de clasificación abajo).
 * - `none`: no hay valor en ningún lado (ni nodo ni defaultStyle).
 */
export type ValueOrigin =
  | { kind: "activeLayer"; value: unknown }
  | { kind: "inheritedLayer"; from: Breakpoint; value: unknown }
  | { kind: "componentDefault"; value: unknown; from?: Breakpoint }
  | { kind: "none" };

/**
 * Lee `layer[group][key]` de una capa parcial de estilo (tipado laxo: el
 * valor puede ser un string CSS o `{ token: string }`, `StyleValue`).
 */
function readAt(layer: Record<string, unknown> | undefined, group: string, key: string): unknown {
  if (!layer) return undefined;
  const groupValue = layer[group] as Record<string, unknown> | undefined;
  return groupValue?.[key];
}

/** Capa `base` u override exacto de `bp` en un `NodeStyle` (sin cascada). */
function layerOf(style: NodeStyle, bp: Breakpoint): Record<string, unknown> | undefined {
  if (bp === "base") return style.base as unknown as Record<string, unknown>;
  return style.overrides?.[bp] as unknown as Record<string, unknown> | undefined;
}

/**
 * Busca en qué capa INFERIOR (estrictamente anterior al breakpoint activo, en
 * `cfg.order`) el nodo declara el campo, recorriendo de la más cercana al
 * activo hacia `base` (así se reporta la capa cascada-relevante más próxima:
 * si `sm` y `base` lo declaran y el activo es `lg`, se reporta `sm`, que es
 * la que de verdad gana en la cascada mobile-first).
 */
function findInheritedLayer(
  style: NodeStyle,
  activeIndex: number,
  cfg: BreakpointConfig,
  group: string,
  key: string,
): { from: Breakpoint; value: unknown } | undefined {
  for (let i = activeIndex - 1; i >= 0; i--) {
    const bp = cfg.order[i];
    if (bp === undefined) continue;
    const layer = layerOf(style, bp);
    const value = readAt(layer, group, key);
    if (value !== undefined) return { from: bp, value };
  }
  return undefined;
}

/**
 * Resuelve el origen de un campo de estilo (`[group, key]`) para el nodo,
 * dado su `style` propio, el `defaultStyle` de su componente (registry), el
 * breakpoint activo y la config de breakpoints del sitio.
 *
 * Orden de resolución (cuatro casos, docs/41 §4.5):
 * 1. Declarado en la capa activa del nodo → `activeLayer`.
 * 2. Declarado en una capa inferior del nodo (no la activa) → `inheritedLayer`,
 *    anotando de qué breakpoint viene.
 * 3. Ausente en todas las capas del nodo pero presente en `defaultStyle` del
 *    componente → `componentDefault`. NOTA DE CLASIFICACIÓN (decisión
 *    documentada, docs/41 §4.5): el `defaultStyle` de un componente también
 *    puede tener `overrides` por breakpoint. Se usa `resolveStyle` sobre el
 *    propio `defaultStyle` con el breakpoint activo para obtener el valor
 *    correcto (cascada del default incluida), y la etiqueta sigue siendo
 *    `componentDefault` sin importar si ese valor salió de `defaultStyle.base`
 *    o de un override — "viene del componente" es la información relevante
 *    para el usuario, no de qué capa DEL DEFAULT salió. Se anota igualmente
 *    `from` con el breakpoint donde el default lo declara en SU capa propia
 *    (si está en un override del default en vez de su base), por si quien
 *    pinta quiere mostrar ese detalle en el tooltip.
 * 4. Ninguna de las anteriores → `none`.
 *
 * Un valor que es referencia a token (`{ token: "…" }`) se devuelve TAL CUAL
 * en `value`, sin resolverlo — quien pinta decide si muestra el chip.
 */
export function resolveValueOrigin(
  style: NodeStyle,
  defaultStyle: NodeStyle | undefined,
  bp: Breakpoint,
  cfg: BreakpointConfig,
  path: StylePath,
): ValueOrigin {
  const [group, key] = path;
  const activeIndex = cfg.order.indexOf(bp);
  const safeActiveIndex = activeIndex === -1 ? 0 : activeIndex;

  // 1) Capa activa del propio nodo.
  const activeLayer = layerOf(style, bp);
  const activeValue = readAt(activeLayer, group, key);
  if (activeValue !== undefined) {
    return { kind: "activeLayer", value: activeValue };
  }

  // 2) Capa inferior del propio nodo.
  const inherited = findInheritedLayer(style, safeActiveIndex, cfg, group, key);
  if (inherited) {
    return { kind: "inheritedLayer", from: inherited.from, value: inherited.value };
  }

  // 3) `defaultStyle` del componente (registry), con su propia cascada.
  if (defaultStyle) {
    const resolvedDefault = resolveStyle(defaultStyle, bp, cfg);
    const defaultGroupValue = (resolvedDefault as unknown as Record<string, unknown>)[group] as
      | Record<string, unknown>
      | undefined;
    const defaultValue = defaultGroupValue?.[key];
    if (defaultValue !== undefined) {
      // Se anota `from` si el valor no viene de `defaultStyle.base` sino de un
      // override propio del default (para un tooltip más preciso opcional).
      const declaredInBase = readAt(
        defaultStyle.base as unknown as Record<string, unknown>,
        group,
        key,
      );
      if (declaredInBase !== undefined) {
        return { kind: "componentDefault", value: defaultValue };
      }
      const fromOverride = findInheritedLayer(defaultStyle, safeActiveIndex + 1, cfg, group, key);
      return { kind: "componentDefault", value: defaultValue, from: fromOverride?.from };
    }
  }

  // 4) Ausencia total.
  return { kind: "none" };
}
