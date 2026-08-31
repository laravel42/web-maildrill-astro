/**
 * Presets de dispositivo para el modo Preview (docs/21 §3.4) — chrome del
 * editor, NO forma parte del documento JSON del sitio (P8). Tabla declarativa
 * indexada por `Breakpoint`: el core no conoce "dispositivos", solo mapea el
 * `activeBreakpoint` (ya existente) a un marco visual + dimensiones emuladas.
 *
 * El `width` es la ÚNICA fuente de verdad del ancho del canvas/iframe por
 * breakpoint (antes duplicado como `VIEWPORT_WIDTH` en `Canvas.tsx`). En el
 * iframe del Preview ese ancho dispara las media queries reales del sitio →
 * emulación fiel al navegador.
 */

import type { Breakpoint } from "@/builder/model/types";

/** Familia visual del marco — define el bisel/estilo CSS (docs/21 §3.4). */
export type DeviceFrameKind = "phone" | "tablet" | "desktop";

export interface DevicePreset {
  /** Clave i18n del nombre visible (namespace `header`, `viewports.<key>`). */
  labelKey: Breakpoint;
  /** Ancho del viewport emulado en px. Dispara las media queries del sitio. */
  width: number;
  /** Alto emulado en px (marco con scroll interno). */
  height: number;
  /** Familia visual del marco. */
  frame: DeviceFrameKind;
}

/**
 * Un preset por cada `Breakpoint`. Los `width` de sm/md/lg/xl coinciden con el
 * `min-width` de `DEFAULT_BREAKPOINTS` (docs/01 §1) para que el viewport activo
 * represente el umbral exacto de cada breakpoint; `base` usa 375px (móvil
 * típico), por debajo del primer `min-width` (sm = 640).
 */
export const DEVICE_PRESETS: Record<Breakpoint, DevicePreset> = {
  base: { labelKey: "base", width: 375, height: 667, frame: "phone" },
  sm: { labelKey: "sm", width: 640, height: 800, frame: "phone" },
  md: { labelKey: "md", width: 768, height: 1024, frame: "tablet" },
  lg: { labelKey: "lg", width: 1024, height: 768, frame: "desktop" },
  xl: { labelKey: "xl", width: 1280, height: 800, frame: "desktop" },
};

/** Ancho CSS (`"375px"`) del canvas/iframe para un breakpoint. */
export function viewportWidth(bp: Breakpoint): string {
  return `${DEVICE_PRESETS[bp].width}px`;
}
