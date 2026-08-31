import type { BuilderNode, BuilderSite } from "../model/types";
import { usedBehaviorsCssForNodes } from "../registry/behaviorRegistry";

/**
 * CSS mínimo de chrome (flechas/dots…) de los behaviors REALMENTE usados en
 * el sitio (docs/10 §5, §8.3): concatena `BehaviorRuntimeSpec.css` de cada
 * definición cuyo `type` aparece en algún nodo, en orden estable de
 * `listBehaviorDefinitions()`. "" si ningún behavior en uso declara `css`
 * (incluye el caso sin behaviors → no se emite `behaviors.css`). Delega en
 * `usedBehaviorsCssForNodes` (compartido con el editor en vivo,
 * `app/layout/BehaviorsStyle.tsx`), recorriendo todas las páginas del sitio.
 */
export function usedBehaviorsCss(site: BuilderSite): string {
  const allNodes: BuilderNode[] = [];
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (!page) continue;
    allNodes.push(...Object.values(page.document.nodes));
  }
  return usedBehaviorsCssForNodes(allNodes);
}
