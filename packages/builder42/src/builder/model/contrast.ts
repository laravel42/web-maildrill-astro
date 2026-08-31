/**
 * Contraste de color WCAG (docs/11 §6, Fase 9.3). Puro (P7): calcula el ratio
 * de contraste entre dos colores y si cumplen el nivel AA. Solo entiende
 * colores hex (`#rgb` / `#rrggbb`); cualquier otro formato (rgb(), var(),
 * nombres CSS…) devuelve `null` → la UI simplemente no muestra aviso (informa
 * cuando puede, nunca bloquea). Sin DOM ni React.
 */

/** Parsea un color hex (`#rgb` o `#rrggbb`) a `[r, g, b]` 0-255, o `null`. */
export function parseHexColor(input: string): [number, number, number] | null {
  const s = input.trim();
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m3) {
    return [
      parseInt(m3[1]! + m3[1]!, 16),
      parseInt(m3[2]! + m3[2]!, 16),
      parseInt(m3[3]! + m3[3]!, 16),
    ];
  }
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
  if (m6) {
    return [parseInt(m6[1]!, 16), parseInt(m6[2]!, 16), parseInt(m6[3]!, 16)];
  }
  return null;
}

/** Luminancia relativa (WCAG 2.x) de un color RGB 0-255. */
function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Ratio de contraste WCAG entre dos colores (1..21). `null` si alguno no es un
 * hex parseable.
 */
export function contrastRatio(fg: string, bg: string): number | null {
  const a = parseHexColor(fg);
  const b = parseHexColor(bg);
  if (!a || !b) return null;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastResult {
  ratio: number;
  /** Cumple AA para texto normal (≥ 4.5:1). */
  aaNormal: boolean;
  /** Cumple AA para texto grande / componentes gráficos (≥ 3:1). */
  aaLarge: boolean;
}

/**
 * Evalúa el contraste entre `fg` y `bg` contra WCAG AA. `null` si no se pueden
 * parsear (no hay aviso posible).
 */
export function checkContrast(fg: string, bg: string): ContrastResult | null {
  const ratio = contrastRatio(fg, bg);
  if (ratio === null) return null;
  return { ratio, aaNormal: ratio >= 4.5, aaLarge: ratio >= 3 };
}
