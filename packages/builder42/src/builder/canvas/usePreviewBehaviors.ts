/**
 * usePreviewBehaviors — hidratación real en el modo Preview del editor
 * (docs/10 §5, Fase 8.4). Monta el `enhance` real de cada behavior del nodo
 * sobre el elemento del DOM ya renderizado, para que el Preview sea WYSIWYG
 * de la interacción (no solo el estado base estático).
 *
 * Contrato de aislamiento (P8/P4):
 * - Solo corre cuando `active` es true (el caller decide: Preview, no Edit —
 *   en Edit pelearía con selección/DnD, docs/10 §5 tabla).
 * - Cada behavior se resuelve por `BehaviorDefinition.runtime.loadPreview`
 *   (import() dinámico, code-split por Vite); el core no conoce "carousel",
 *   solo invoca lo que el registry declara.
 * - El documento (`BuilderDocument`) nunca se toca (P1): el enhancer solo
 *   manipula el DOM del elemento recibido.
 * - Cleanup completo al desmontar o cuando cambian `behaviors`/`active`.
 */

import { useEffect, type RefObject } from "react";
import { getBehaviorDefinition } from "../registry/behaviorRegistry";
import type { BehaviorInstance } from "../model/types";

export function usePreviewBehaviors(
  ref: RefObject<HTMLElement | null>,
  behaviors: BehaviorInstance[] | undefined,
  active: boolean,
): void {
  // Serializado a JSON para una dependencia estable de useEffect: `behaviors`
  // es un array/objeto nuevo en cada render del store (Immer), pero solo nos
  // importa su CONTENIDO (docs/12 antipatrón de snapshots inestables, mismo
  // espíritu — aquí es una dependencia de efecto, no un selector de Zustand).
  const behaviorsKey = behaviors && behaviors.length > 0 ? JSON.stringify(behaviors) : "";

  useEffect(() => {
    if (!active || !behaviorsKey) return;
    const el = ref.current;
    if (!el) return;

    const list: BehaviorInstance[] = JSON.parse(behaviorsKey);
    let cancelled = false;
    const cleanups: (() => void)[] = [];

    for (const instance of list) {
      const def = getBehaviorDefinition(instance.type);
      if (!def?.runtime.loadPreview) continue;
      def.runtime
        .loadPreview()
        .then((enhance) => {
          if (cancelled) return;
          const cleanup = enhance(el, instance.options ?? {});
          if (typeof cleanup === "function") cleanups.push(cleanup);
        })
        .catch(() => {
          // Silencioso: el Preview es una mejora progresiva del propio editor;
          // un behavior que falla al cargar no debe romper el resto del canvas.
        });
    }

    return () => {
      cancelled = true;
      for (const cleanup of cleanups) cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, behaviorsKey, ref]);
}
