/**
 * WCAG 2.1 Color Contrast Utilities
 *
 * Implements WCAG contrast ratio calculations to ensure accessibility compliance.
 * Reference: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */

/**
 * Convert hex color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance of a color
 * Formula from WCAG 2.1: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio from 1:1 (no contrast) to 21:1 (maximum contrast)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    throw new Error(`Invalid color format. Expected hex colors, got: ${color1}, ${color2}`);
  }

  const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG 2.1 AA compliance levels
 */
export const WCAG_LEVELS = {
  AA_NORMAL: 4.5, // Normal text (< 18pt or < 14pt bold)
  AA_LARGE: 3.0, // Large text (≥ 18pt or ≥ 14pt bold)
  AAA_NORMAL: 7.0, // Enhanced normal text
  AAA_LARGE: 4.5, // Enhanced large text
} as const;

/**
 * Check if color combination meets WCAG AA standards
 */
export function isWCAGCompliant(
  textColor: string,
  backgroundColor: string,
  fontSize: number = 16,
  fontWeight: string = 'normal'
): { compliant: boolean; ratio: number; required: number; level: string } {
  const ratio = getContrastRatio(textColor, backgroundColor);

  // Determine if text is "large" per WCAG definition
  const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight === 'bold');
  const required = isLargeText ? WCAG_LEVELS.AA_LARGE : WCAG_LEVELS.AA_NORMAL;
  const level = isLargeText ? 'AA Large' : 'AA Normal';

  return {
    compliant: ratio >= required,
    ratio: Math.round(ratio * 100) / 100,
    required,
    level,
  };
}

/**
 * Get suggested text color (black or white) for given background
 */
export function getSuggestedTextColor(backgroundColor: string): string {
  const whiteRatio = getContrastRatio('#FFFFFF', backgroundColor);
  const blackRatio = getContrastRatio('#000000', backgroundColor);

  return whiteRatio > blackRatio ? '#FFFFFF' : '#000000';
}

/**
 * Validate archetype color palette for contrast issues
 */
export function validateArchetypePalette(palette: {
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  buttonBackgroundColor?: string;
  buttonTextColor?: string;
}): Array<{ issue: string; colors: string[]; ratio: number; suggestion?: string }> {
  const issues: Array<{ issue: string; colors: string[]; ratio: number; suggestion?: string }> = [];

  // Check main text on background
  const mainTextCheck = isWCAGCompliant(palette.textColor, palette.backgroundColor);
  if (!mainTextCheck.compliant) {
    issues.push({
      issue: `Main text contrast too low (${mainTextCheck.ratio}:1, needs ${mainTextCheck.required}:1)`,
      colors: [palette.textColor, palette.backgroundColor],
      ratio: mainTextCheck.ratio,
      suggestion: getSuggestedTextColor(palette.backgroundColor),
    });
  }

  // Check button contrast if provided
  if (palette.buttonBackgroundColor && palette.buttonTextColor) {
    const buttonCheck = isWCAGCompliant(palette.buttonTextColor, palette.buttonBackgroundColor, 16, 'bold');
    if (!buttonCheck.compliant) {
      issues.push({
        issue: `Button text contrast too low (${buttonCheck.ratio}:1, needs ${buttonCheck.required}:1)`,
        colors: [palette.buttonTextColor, palette.buttonBackgroundColor],
        ratio: buttonCheck.ratio,
        suggestion: getSuggestedTextColor(palette.buttonBackgroundColor),
      });
    }
  }

  return issues;
}
