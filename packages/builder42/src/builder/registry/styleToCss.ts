/**
 * Traduce `StyleProperties` (agrupado) a un objeto `CSSProperties` plano para el
 * render del canvas/preview. Los nombres de propiedad ya son camelCase válidos
 * de CSS, así que se aplanan directamente.
 *
 * El export NO usa esto: genera texto CSS con `@media` vía `cssSerializer`
 * (docs/01 §5). Aquí solo producimos estilos inline para el canvas en vivo.
 */

import type { CSSProperties } from "react";
import type { StyleProperties, StyleValue } from "../model/types";
import { styleValueToCss } from "../model/tokens";

export function stylePropertiesToCSSObject(sp: StyleProperties): CSSProperties {
  const out: Record<string, string> = {};
  for (const group of [sp.layout, sp.spacing, sp.size, sp.appearance, sp.typography]) {
    if (!group) continue;
    for (const [key, value] of Object.entries(group)) {
      // Resuelve tokens a var(--…): válido también en estilo inline del canvas,
      // así el WYSIWYG coincide con el export (docs/08 §3-4).
      const css = styleValueToCss(value as StyleValue | undefined);
      if (css !== undefined) out[key] = css;
    }
  }
  return out as CSSProperties;
}
