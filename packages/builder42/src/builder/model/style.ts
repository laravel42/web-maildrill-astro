/**
 * Resolución de estilo efectivo — función pura (P7, docs/01 §2).
 *
 * Cascada mobile-first: parte de `base` y hace deep-merge (por grupo, campo a
 * campo) de cada override cuyo breakpoint sea <= al activo, en el orden de
 * `cfg.order` (base → sm → md → lg → xl). Nunca muta el nodo; devuelve un
 * `StyleProperties` aplanado para el breakpoint activo.
 *
 * El export NO usa esto para aplanar: genera CSS por capas con `@media`
 * (docs/01 §5). Este resolver es para el canvas/preview.
 */

import type {
  Breakpoint,
  BreakpointConfig,
  NodeStyle,
  StyleProperties,
  StyleGroup,
  StyleState,
} from "./types";

const STYLE_GROUPS: StyleGroup[] = ["layout", "spacing", "size", "appearance", "typography"];

/**
 * Merge de una capa de override sobre el acumulado. El merge es profundo pero
 * por grupo: un override de `layout.flexDirection` no borra `layout.gap` de base
 * (docs/01 §2). `undefined` = "no declarado" (hereda); no se copia.
 */
function mergeLayer(
  acc: StyleProperties,
  layer: Partial<StyleProperties>,
): StyleProperties {
  const result: StyleProperties = { ...acc };
  for (const group of STYLE_GROUPS) {
    const layerGroup = layer[group];
    if (!layerGroup) continue;
    // merge campo a campo, ignorando undefined
    const merged = { ...(result[group] ?? {}) } as Record<string, unknown>;
    for (const key of Object.keys(layerGroup)) {
      const value = (layerGroup as Record<string, unknown>)[key];
      if (value !== undefined) merged[key] = value;
    }
    (result as Record<string, unknown>)[group] = merged;
  }
  return result;
}

/**
 * Devuelve el estilo efectivo en `active` aplicando la cascada mobile-first.
 * Se recorre `cfg.order` hasta (incluido) el breakpoint activo.
 */
export function resolveStyle(
  style: NodeStyle,
  active: Breakpoint,
  cfg: BreakpointConfig,
): StyleProperties {
  const activeIndex = cfg.order.indexOf(active);
  // Si el breakpoint activo no está en el orden, caemos a solo base.
  const upTo = activeIndex === -1 ? 0 : activeIndex;

  let resolved: StyleProperties = mergeLayer({}, style.base);

  for (let i = 1; i <= upTo; i++) {
    const bp = cfg.order[i];
    if (!bp || bp === "base") continue;
    const override = style.overrides?.[bp];
    if (override) resolved = mergeLayer(resolved, override);
  }

  return resolved;
}

/**
 * Estilo efectivo de un ESTADO (T9, docs/AGENTS §T9): `base` (mismo fallback
 * que ve el usuario en el estado normal) con el override de `states[state]`
 * mezclado encima. Sin variante por breakpoint (docs/AGENTS §T9 — `states` es
 * plano); si en el futuro se necesita "hover distinto en mobile" se extiende
 * sin romper esto. Devuelve solo la capa base si el nodo no declara ese estado
 * (o `states` está ausente por completo, retrocompat).
 */
export function resolveStateStyle(style: NodeStyle, state: StyleState): StyleProperties {
  const base = mergeLayer({}, style.base);
  const override = style.states?.[state];
  return override ? mergeLayer(base, override) : base;
}
