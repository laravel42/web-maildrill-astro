/**
 * Ghost render para el drag preview (docs/09 §2.1-2.2, F1).
 *
 * Produce el markup del **elemento real** que se está arrastrando, para usarlo
 * como preview nativo (`setCustomNativeDragPreview`) en vez del chip con el
 * nombre. Reutiliza el `render()` del registry (P3): el mismo camino que el
 * canvas no-interactivo (estilos inline vía cada componente), pero SIN chrome de
 * edición (`rootRef`/`rootProps` undefined) ni `data-node-id`.
 *
 * Es síncrono (`renderToStaticMarkup`) porque el preview nativo del navegador es
 * una imagen estática tomada del contenedor. No muta el documento (P1): para
 * `new-component` sintetiza un nodo con los defaults del registry sin insertarlo.
 * Solo vive en edición; en export nada de esto se emite (P8).
 */

import { cloneElement, useMemo, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createNodeForType, getDefinition, usedComponentsCssForNodes } from "../registry/componentRegistry";
import { getSectionLayout } from "../registry/layoutRegistry";
import { resolveImageSrc } from "../model/assets";
import { useDocumentStore } from "../store/documentStore";
import { classNameForNode, serializeNodeCss } from "../export/cssSerializer";
import type { NodeFragment } from "../model/tree";
import type {
  Breakpoint,
  BuilderDocument,
  BuilderNode,
  ImageSource,
} from "../model/types";
import { DEFAULT_BREAKPOINTS } from "../model/types";
import type { DragData } from "./contract";

/** Renderiza recursivamente un nodo (y su subárbol) como elemento de solo lectura. */
function renderNode(
  node: BuilderNode,
  doc: BuilderDocument | null,
  breakpoint: Breakpoint,
  resolveImg: (source: ImageSource) => string,
): ReactElement | null {
  const def = getDefinition(node.type);
  if (!def) return null;

  const children = (node.children ?? [])
    .map((childId) => {
      const child = doc?.nodes[childId];
      if (!child) return null;
      const el = renderNode(child, doc, breakpoint, resolveImg);
      return el ? cloneElement(el, { key: childId }) : null;
    })
    .filter(Boolean);

  return def.render({
    node,
    children,
    exportMode: false,
    breakpoint,
    resolveImageSrc: resolveImg,
  });
}

/**
 * Markup HTML del elemento arrastrado para el preview. Devuelve "" si no se
 * puede resolver (tipo no registrado, nodo inexistente, error de render) — el
 * caller cae entonces al chip. Lee el estado actual del store (snapshot).
 */
export function dragGhostMarkup(drag: DragData): string {
  const state = useDocumentStore.getState();
  const breakpoint = state.activeBreakpoint;
  const resolveImg = (source: ImageSource) =>
    resolveImageSrc(source, { assets: state.site.assets, forExport: false });

  let node: BuilderNode | null = null;
  let doc: BuilderDocument | null = null;

  if (drag.kind === "new-component") {
    try {
      node = createNodeForType(drag.componentType);
    } catch {
      return "";
    }
  } else if (drag.kind === "fragment") {
    node = fragmentRootNode(drag.layoutId);
  } else {
    doc = state.document;
    node = doc.nodes[drag.nodeId] ?? null;
  }
  if (!node) return "";

  const el = renderNode(node, doc, breakpoint, resolveImg);
  if (!el) return "";
  try {
    return renderToStaticMarkup(el);
  } catch {
    return "";
  }
}

/**
 * Render **en vivo** del elemento arrastrado, de solo lectura, para el fantasma
 * en flujo ("hueco que se abre", docs/09 §2.3, F2). Reutiliza el `render()` del
 * registry (P3) sin chrome de edición (`rootRef`/`rootProps` undefined, sin
 * `data-node-id` → no entra en `measureChildRects`). No muta el documento (P1):
 * para `new-component` sintetiza el nodo con los defaults y lo memoiza.
 */
export function GhostNode({ drag }: { drag: DragData }): ReactElement | null {
  const breakpoint = useDocumentStore((s) => s.activeBreakpoint);
  const doc = useDocumentStore((s) => s.document);
  const assets = useDocumentStore((s) => s.site.assets);

  const synthetic = useMemo(() => {
    if (drag.kind === "new-component") return safeCreate(drag.componentType);
    if (drag.kind === "fragment") return fragmentRootNode(drag.layoutId);
    return null;
  }, [drag]);

  const resolveImg = useMemo(
    () => (source: ImageSource) => resolveImageSrc(source, { assets, forExport: false }),
    [assets],
  );

  const node = drag.kind === "existing-node" ? (doc.nodes[drag.nodeId] ?? null) : synthetic;
  const subtreeDoc = drag.kind === "existing-node" ? doc : null;
  if (!node) return null;
  return renderNode(node, subtreeDoc, breakpoint, resolveImg);
}

function safeCreate(type: string): BuilderNode | null {
  try {
    return createNodeForType(type);
  } catch {
    return null;
  }
}

/** Sintetiza el nodo raíz del fragmento de una plantilla de sección, sin insertarlo (P1). */
function fragmentRootNode(layoutId: string): BuilderNode | null {
  const layout = getSectionLayout(layoutId);
  if (!layout) return null;
  try {
    const fragment = layout.build();
    return fragment.nodes[fragment.rootId] ?? null;
  } catch {
    return null;
  }
}

/**
 * Markup HTML estático de un fragmento COMPLETO (preview de tarjeta, docs/38).
 * A diferencia de `dragGhostMarkup`/`fragmentRootNode`, no depende del drag
 * activo y expone el `doc` sintético del fragmento (no `null`), así los
 * `children` de cada nodo SÍ resuelven recursivamente (antes solo se pintaba la
 * raíz). Sin runtime (P8), solo lectura (P1).
 *
 * Recibe el fragmento ya construido —en vez de un `layoutId`— porque las
 * plantillas de página son de carga perezosa (docs/48 §4): la tarjeta las carga
 * cuando entra en viewport y pasa aquí el resultado. `layoutPreviewMarkup` cubre
 * el caso síncrono de las secciones.
 */
export function fragmentPreviewMarkup(
  fragment: NodeFragment,
  breakpoint: Breakpoint,
): { html: string; css: string } | null {
  const root = fragment.nodes[fragment.rootId];
  if (!root) return null;

  const doc: BuilderDocument = {
    rootId: fragment.rootId,
    nodes: fragment.nodes,
    meta: { version: 1 },
  };

  const state = useDocumentStore.getState();
  const resolveImg = (source: ImageSource) =>
    resolveImageSrc(source, { assets: state.site.assets, forExport: false });

  const el = renderNode(root, doc, breakpoint, resolveImg);
  if (!el) return null;

  let html: string;
  try {
    html = renderToStaticMarkup(el);
  } catch {
    return null;
  }

  const nodes = Object.values(fragment.nodes);
  const nodeCss = nodes
    .map((node) => serializeNodeCss(classNameForNode(node.id), node.style, DEFAULT_BREAKPOINTS))
    .filter(Boolean)
    .join("\n");
  const componentsCss = usedComponentsCssForNodes(nodes);
  const css = [nodeCss, componentsCss].filter(Boolean).join("\n\n");

  return { html, css };
}

/**
 * `fragmentPreviewMarkup` para una plantilla de **sección** por id (camino
 * síncrono). `null` si el id no es una sección o si su `build()` falla.
 */
export function layoutPreviewMarkup(
  layoutId: string,
  breakpoint: Breakpoint,
): { html: string; css: string } | null {
  const layout = getSectionLayout(layoutId);
  if (!layout) return null;
  let fragment: NodeFragment;
  try {
    fragment = layout.build();
  } catch {
    return null;
  }
  return fragmentPreviewMarkup(fragment, breakpoint);
}
