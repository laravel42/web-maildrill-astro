/**
 * Helper de TEST (no productivo, docs/48 §5.4) para la guarda de tema de una
 * plantilla: contraste AA de los pares clave, determinismo del id
 * (`theme-tpl-<slug>`) y presencia de las familias declaradas. Reutiliza
 * `checkContrast`/`contrastRatio` de `model/contrast.ts` tal cual (no se
 * reescribe, docs/48 instrucciones de la fase) — mismo patrón que
 * `themePresets.test.ts`.
 *
 * La idempotencia de `applyPageLayout` (aplicar dos veces no duplica temas) NO
 * vive aquí: requiere un store real (Zustand), no es una función pura sobre
 * `NodeFragment`/`LayoutTheme`. Ese caso se cubre con un test de integración en
 * `store/slices/layouts.test.ts`.
 */

import { checkContrast } from "../../model/contrast";
import type { LayoutTheme } from "../layoutRegistry";
import { layoutThemeId } from "../layoutRegistry";

export interface ThemeContrastViolation {
  pair: string;
  ratio: number | null;
  required: "aaNormal" | "aaLarge";
}

/**
 * Contraste AA de los pares clave de un tema (docs/48 §3.4): `colors.text` /
 * `colors.surface.default` (texto normal, ≥4.5:1) y `colors.primary.on` /
 * `colors.primary.default` (componente gráfico/botón, ≥3:1). Solo evalúa los
 * pares presentes como valor CRUDO en `theme.tokens` — si el tema no redefine
 * un token del par, hereda el de `BASE_TOKENS` (ya cubierto por sus propios
 * tests) y no hace falta reevaluarlo aquí.
 */
export function themeContrastViolations(theme: LayoutTheme): ThemeContrastViolation[] {
  const out: ThemeContrastViolation[] = [];

  const text = theme.tokens["colors.text"];
  const surface = theme.tokens["colors.surface.default"];
  if (text && surface) {
    const result = checkContrast(text, surface);
    if (!result || !result.aaNormal) {
      out.push({ pair: "colors.text / colors.surface.default", ratio: result?.ratio ?? null, required: "aaNormal" });
    }
  }

  const on = theme.tokens["colors.primary.on"];
  const primary = theme.tokens["colors.primary.default"];
  if (on && primary) {
    const result = checkContrast(on, primary);
    if (!result || !result.aaLarge) {
      out.push({ pair: "colors.primary.on / colors.primary.default", ratio: result?.ratio ?? null, required: "aaLarge" });
    }
  }

  const bandOn = theme.tokens["colors.band.on"];
  const bandDark = theme.tokens["colors.band.dark"];
  if (bandOn && bandDark) {
    const result = checkContrast(bandOn, bandDark);
    if (!result || !result.aaNormal) {
      out.push({ pair: "colors.band.on / colors.band.dark", ratio: result?.ratio ?? null, required: "aaNormal" });
    }
  }

  return out;
}

/** ¿El id derivado del tema sigue el patrón determinista `theme-tpl-<slug>`? */
export function themeIdIsDeterministic(theme: LayoutTheme): boolean {
  return layoutThemeId(theme) === `theme-tpl-${theme.slug}`;
}

/**
 * Claves de `fontFamilies` que el tema declara pero que NINGÚN nodo del
 * fragmento referencia por token (`{ token: "typography.families.<key>" }`).
 * Una familia declarada y no usada no rompe nada, pero es una pista de que la
 * plantilla no está aprovechando la personalidad tipográfica que su propio
 * tema propone.
 */
export function unusedFontFamilyKeys(theme: LayoutTheme, fragmentJson: string): string[] {
  if (!theme.fontFamilies) return [];
  return Object.keys(theme.fontFamilies).filter((key) => {
    const needle = `"typography.families.${key}"`;
    return !fragmentJson.includes(needle);
  });
}
