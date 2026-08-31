/**
 * BehaviorsStyle — inyecta en vivo el CSS de chrome (`BehaviorRuntimeSpec.css`)
 * de los behaviors REALMENTE usados en la página activa (docs/10 §5, §8.3-8.4).
 *
 * Sin esto, el Preview del editor hidrata el `enhance` real (carousel Embla,
 * flechas/dots creados en runtime) pero sin su CSS de chrome — el layout se ve
 * roto (el runtime crea `.pb-carousel__viewport/__container/__slide` que
 * necesitan `display:flex` explícito, no heredado del estilo del nodo, docs/10
 * §5 tabla "Preview: se hidrata el runtime real").
 *
 * Mismo criterio de tree-shake por uso que `export/site.ts` (`usedBehaviorsCss`),
 * pero contra el documento EN VIVO del store, no un `BuilderSite` congelado.
 * Es chrome del editor (no toca el documento, P1/P8): solo refleja
 * `document.nodes[*].behaviors`.
 */

import { useMemo } from "react";
import { useDocumentStore } from "@/builder/store/documentStore";
import { usedBehaviorsCssForNodes } from "@/builder/registry/behaviorRegistry";

export function BehaviorsStyle() {
  const nodes = useDocumentStore((s) => s.document.nodes);
  const css = useMemo(() => usedBehaviorsCssForNodes(Object.values(nodes)), [nodes]);

  if (!css) return null;
  return <style data-pb-behaviors-css>{css}</style>;
}
