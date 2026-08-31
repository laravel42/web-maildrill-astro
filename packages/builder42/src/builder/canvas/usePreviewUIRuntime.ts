/**
 * usePreviewUIRuntime — hidratación del micro-runtime `ui.js` (tier 1) en el
 * modo Preview del editor (docs/15 §1.7, análogo a `usePreviewBehaviors`).
 *
 * En Preview el canvas debe ser WYSIWYG del export: si el sitio publicado anima
 * el chevron del `select` (vía `ui.js`), el Preview también debe hacerlo. En
 * Edit NO corre (pelearía con selección; además el chevron animado distrae al
 * editar). El export nunca importa esto (P8 — es un hook del canvas).
 *
 * Contrato de aislamiento:
 * - Solo corre cuando `active` (Preview, no Edit).
 * - Importa `enhanceUIElement` de `runtime/uiEnhancers` (módulo PURO, sin
 *   side-effects — no dispara el escaneo global que sí hace `runtime/ui.ts`).
 * - Solo aplica si el elemento tiene `data-pb-ui` (mismo criterio que el
 *   output). El documento nunca se toca (P1).
 * - Cleanup completo al desmontar o cambiar `active`.
 */

import { useEffect, type RefObject } from "react";

export function usePreviewUIRuntime(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
): void {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el || !el.dataset.pbUi) return;

    let cleanup: (() => void) | void;
    let cancelled = false;

    // import() dinámico: el micro-runtime no se bundlea estáticamente en el
    // editor (code-split por Vite), igual que `loadPreview` de los behaviors.
    import("@/runtime/uiEnhancers")
      .then(({ enhanceUIElement }) => {
        if (cancelled) return;
        cleanup = enhanceUIElement(el);
      })
      .catch(() => {
        // Silencioso: el Preview es una mejora progresiva del propio editor.
      });

    return () => {
      cancelled = true;
      if (typeof cleanup === "function") cleanup();
    };
  }, [active, ref]);
}
