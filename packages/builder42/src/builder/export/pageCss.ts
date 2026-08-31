import type { BuilderPage, BuilderSite } from "../model/types";
import { classNameForNode, serializeNodeCss } from "./cssSerializer";
import { getDefinition } from "../registry/componentRegistry";

/** CSS por página: reglas `.n-<id>` + `@media` de cada nodo (docs/01 §5). */
export function pageCss(
  page: BuilderPage,
  site: BuilderSite,
): string {
  const cfg = site.meta.breakpoints;
  return Object.values(page.document.nodes)
    .map((node) => {
      // T9: ver comentario equivalente en `exportToHtml.ts`.
      const stateSpec = getDefinition(node.type)?.styleSchema?.states?.[0];
      const statesClassName = stateSpec ? classNameForNode(node.id, stateSpec.classSuffix) : undefined;
      return serializeNodeCss(classNameForNode(node.id), node.style, cfg, statesClassName);
    })
    .filter(Boolean)
    .join("\n\n");
}
