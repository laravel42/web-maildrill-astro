/**
 * Selectors derivados del store (PLAN §7). Mantienen las vistas como
 * proyecciones del documento (P1): ninguna guarda estado propio.
 */

import type {
  BuilderDocument,
  BuilderNode,
  BuilderSite,
  NodeId,
  StyleProperties,
} from "../model/types";
import { resolveStyle } from "../model/style";
import { writeDocIntoSite } from "../model/site";
import type { SiteState } from "./documentStore";

/** Nodo por id (o undefined). */
export function selectNode(
  state: SiteState,
  id: NodeId,
): BuilderNode | undefined {
  return state.document.nodes[id];
}

/** Nodo seleccionado actualmente (o undefined). */
export function selectSelectedNode(state: SiteState): BuilderNode | undefined {
  return state.selectedId ? state.document.nodes[state.selectedId] : undefined;
}

/**
 * Sitio completo con la copia de trabajo de la página activa YA volcada. Para
 * export/JSON/persistencia, que necesitan el sitio íntegro (docs/06 §5-8).
 */
export function selectSite(state: SiteState): BuilderSite {
  return writeDocIntoSite(state.site, state.activePageId, state.document);
}

/**
 * Estilo efectivo de un nodo en el breakpoint activo del editor.
 *
 * ⚠️ Devuelve un objeto NUEVO en cada llamada. NO usar como selector reactivo de
 * Zustand (`useDocumentStore(s => selectResolvedStyle(s, id))`): el snapshot sería
 * inestable y provocaría un bucle infinito ("getSnapshot should be cached"). En
 * componentes, suscríbete a referencias estables (node.style, activeBreakpoint,
 * cfg) y memoiza `resolveStyle` con `useMemo`. Este helper es para uso puntual
 * (p. ej. en tests).
 */
export function selectResolvedStyle(
  state: SiteState,
  id: NodeId,
): StyleProperties {
  const node = state.document.nodes[id];
  if (!node) return {};
  return resolveStyle(node.style, state.activeBreakpoint, state.site.meta.breakpoints);
}

/** Nodos hijos resueltos (en orden) de un nodo. */
export function selectChildren(doc: BuilderDocument, id: NodeId): BuilderNode[] {
  const node = doc.nodes[id];
  if (!node?.children) return [];
  return node.children
    .map((childId) => doc.nodes[childId])
    .filter((n): n is BuilderNode => n !== undefined);
}

/**
 * Valor efectivo de una prop en el idioma de edición activo (docs/12 §B.6-7).
 * En el idioma default, devuelve `node.props[key]` tal cual. En otro idioma,
 * busca `site.pages[activePageId].translations[nodeId][editingLocale][key]`
 * y cae al valor default si no hay traducción (mismo patrón que el fallback
 * de estilo responsive: la capa activa es un override, el default es la base).
 *
 * ⚠️ Devuelve un objeto NUEVO en cada llamada. NO usar como selector reactivo
 * de Zustand (`useDocumentStore(s => selectTranslatedProp(s, id, key))`): el
 * snapshot sería inestable y provocaría un bucle infinito ("Maximum update
 * depth exceeded" / "getSnapshot should be cached"), igual que
 * `selectResolvedStyle` arriba. En componentes, suscríbete a las piezas
 * primitivas/estables (`node.props[key]`, `editingLocale`, `translations`) y
 * memoiza el resultado con `useMemo`, o usa el hook `useTranslatedProp` de
 * abajo.
 */
export function selectTranslatedProp(
  state: SiteState,
  nodeId: NodeId,
  key: string,
): { value: unknown; isTranslated: boolean } {
  const node = state.document.nodes[nodeId];
  const defaultValue = node?.props[key];
  if (state.editingLocale === state.site.meta.defaultLang) {
    return { value: defaultValue, isTranslated: true };
  }
  const page = state.site.pages[state.activePageId];
  const nodeT = page?.translations?.[nodeId]?.[state.editingLocale];
  if (nodeT && key in nodeT) {
    return { value: nodeT[key], isTranslated: true };
  }
  return { value: defaultValue, isTranslated: false };
}
