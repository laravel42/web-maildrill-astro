/**
 * ComponentsStyle — inyecta en vivo el CSS estático de los COMPONENTES
 * realmente usados en el documento activo (T10, AGENTS.md).
 *
 * Análogo a `BehaviorsStyle.tsx`, pero tree-shakeado por USO DEL COMPONENTE
 * (¿existe algún nodo de este `type`?), no por behavior adjunto: el CSS
 * presentacional de `tabs`/`accordion`/`navbar`/`modal` (layout de lista,
 * truncado, estados por `aria-*`, chrome del diálogo…) ya no depende de que
 * el behavior JS esté activo — así que se inyecta incondicionalmente mientras
 * el nodo exista, con o sin behavior.
 *
 * Es chrome del editor (no toca el documento, P1/P8): solo refleja
 * `document.nodes[*].type`.
 */

import { useMemo } from "react";
import { useDocumentStore } from "@/builder/store/documentStore";
import { usedComponentsCssForNodes } from "@/builder/registry/componentRegistry";

export function ComponentsStyle() {
  const nodes = useDocumentStore((s) => s.document.nodes);
  const css = useMemo(() => usedComponentsCssForNodes(Object.values(nodes)), [nodes]);

  if (!css) return null;
  return <style data-pb-components-css>{css}</style>;
}
