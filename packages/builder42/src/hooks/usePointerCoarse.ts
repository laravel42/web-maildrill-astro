/**
 * usePointerCoarse — detecta si el puntero primario del dispositivo es
 * "coarse" (dedo/touch, sin precisión fina) vía `matchMedia("(pointer:
 * coarse)")` (docs/24 §2.3). Se usa para decidir la visibilidad por defecto
 * de los controles de reordenamiento por flechas (▲▼◀▶) cuando la preferencia
 * `reorderControls` está en `"auto"` — visibles en tablets/touch, ocultas en
 * desktop con puntero fino (mouse/trackpad).
 *
 * Mismo patrón que `useThemeMode.ts` (matchMedia + listener de cambio,
 * SSR/jsdom-safe: `false` si no hay `window.matchMedia`), pero sin necesidad
 * de un store externo compartido — no hay estado persistido que sincronizar
 * entre instancias, solo el media query en vivo.
 */

import { useEffect, useState } from "react";
import { useLocalConfig } from "./useLocalConfig";

const COARSE_QUERY = "(pointer: coarse)";
// Umbral de "auto" (feedback de usuario): en `"auto"` los controles solo se
// muestran de TABLET para abajo, nunca en desktop — aunque el desktop tenga
// una pantalla táctil que reporte `pointer: coarse` (p. ej. un monitor/laptop
// touchscreen con mouse como puntero secundario, o algunos navegadores que
// marcan coarse con trackpad). Se combina con `pointer: coarse` (abajo) en
// vez de sustituirlo: sigue distinguiendo mouse/trackpad de touch dentro del
// mismo rango de ancho. Alineado con `DEVICE_PRESETS.md.width` (docs/21
// §3.4, breakpoint "tablet" del propio editor) para no inventar un segundo
// umbral de tamaño en el proyecto.
const AUTO_MAX_WIDTH_QUERY = "(max-width: 768px)";

/** ¿El puntero primario es "coarse" (touch)? SSR/jsdom-safe: `false` si no hay `matchMedia`. */
export function pointerIsCoarse(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(COARSE_QUERY).matches;
}

/** Hook: refleja en vivo si el puntero primario del dispositivo es "coarse" (touch). */
export function usePointerCoarse(): boolean {
  const [coarse, setCoarse] = useState(pointerIsCoarse);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(COARSE_QUERY);
    const handle = () => setCoarse(mql.matches);
    handle();
    mql.addEventListener("change", handle);
    return () => mql.removeEventListener("change", handle);
  }, []);

  return coarse;
}

/**
 * Hook: refleja en vivo si el ancho de la ventana del navegador (NO del
 * canvas emulado) está en el rango de tablet para abajo (≤768px, feedback de
 * usuario). Mismo patrón `matchMedia` que `usePointerCoarse`.
 */
function useAutoSizeThreshold(): boolean {
  const [withinThreshold, setWithinThreshold] = useState(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(AUTO_MAX_WIDTH_QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(AUTO_MAX_WIDTH_QUERY);
    const handle = () => setWithinThreshold(mql.matches);
    handle();
    mql.addEventListener("change", handle);
    return () => mql.removeEventListener("change", handle);
  }, []);

  return withinThreshold;
}

/**
 * Resuelve si los controles de reordenamiento (▲▼◀▶, docs/24 §2.3) deben
 * mostrarse: combina la preferencia persistida (`reorderControls`) con la
 * detección en vivo de dispositivo. `"on"`/`"off"` fuerzan el valor sin
 * importar el dispositivo; `"auto"` exige AMBAS condiciones (feedback de
 * usuario): puntero "coarse" (touch, no mouse/trackpad) Y ancho de ventana de
 * tablet para abajo (≤768px) — en desktop nunca se muestran en "auto", sin
 * importar el tipo de puntero que reporte el navegador.
 */
export function useReorderControlsVisible(): boolean {
  const [pref] = useLocalConfig("reorderControls");
  const coarse = usePointerCoarse();
  const withinAutoSize = useAutoSizeThreshold();
  if (pref === "on") return true;
  if (pref === "off") return false;
  return coarse && withinAutoSize;
}
