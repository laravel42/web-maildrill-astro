import type { BuilderNode, BuilderSite } from "../model/types";
import { usedComponentsCssForNodes } from "../registry/componentRegistry";

/**
 * CSS estático presentacional de los COMPONENTES realmente usados en el sitio
 * (T10, AGENTS.md): concatena `ComponentDefinition.css` de cada tipo presente
 * en algún nodo, en orden estable de `listDefinitions()`. "" si ningún tipo
 * en uso declara `css`. A diferencia de `usedBehaviorsCss` (tree-shake por
 * behavior ADJUNTO), esto se dispara por la mera existencia del nodo — el CSS
 * presentacional de `tabs`/`accordion`/`navbar`/`modal` ya no depende de si
 * el behavior JS está activo (bug real corregido: quitar el behavior dejaba
 * el componente sin estilo). Delega en `usedComponentsCssForNodes`
 * (compartido con el editor en vivo, `app/layout/ComponentsStyle.tsx`).
 */
export function usedComponentsCss(site: BuilderSite): string {
  const allNodes: BuilderNode[] = [];
  for (const id of site.pageOrder) {
    const page = site.pages[id];
    if (!page) continue;
    allNodes.push(...Object.values(page.document.nodes));
  }
  return usedComponentsCssForNodes(allNodes);
}
