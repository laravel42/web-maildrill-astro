/**
 * Micro-runtime `ui.js` (docs/15, tier 1) — ENTRY POINT del output.
 *
 * Agrupa micro-interacciones COSMÉTICAS de los componentes base que CSS puro no
 * alcanza (p. ej. rotar el chevron del `select`, docs/15 §1.6). La lógica de
 * los enhancers vive en `uiEnhancers.ts` (módulo puro, sin side-effects, para
 * que el editor la reuse en Preview). Este archivo solo la conecta al DOM del
 * sitio publicado con auto-ejecución al cargar.
 *
 * Se bundlea aparte (`assets/js/ui.js`) y el export lo incluye SOLO si la
 * página tiene ≥1 componente con `data-pb-ui` (tree-shake por uso, cero-JS por
 * defecto — P8/P9). Es autónomo: no se auto-registra en `window.__pbBehaviors`.
 *
 * Regla dura (P8): NO importa nada de `src/builder/`.
 */

import { runUIEnhancements } from "./uiEnhancers";

export { runUIEnhancements, enhanceUIElement, uiEnhancers } from "./uiEnhancers";

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => runUIEnhancements());
  } else {
    runUIEnhancements();
  }
}
