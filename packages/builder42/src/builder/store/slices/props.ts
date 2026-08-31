import { linkTargetHasValue } from "../../model/nodeAction";
import type { Breakpoint, NodeId, PageId, StyleGroup, StyleState } from "../../model/types";
import { isHiddenAt, computeShowAction } from "../../model/visibility";
import { getDefinition } from "../../registry/componentRegistry";
import type { SliceCreator } from "./types";

export interface PropsSlice {
  setProp: (nodeId: NodeId, key: string, value: unknown) => void;

  /**
   * Escribe un campo traducible para un locale ARBITRARIO (tabla de traducción,
   * Fase 19.j) sin depender del `editingLocale` activo. En el idioma default
   * escribe en la página correspondiente (`pages[pageId].document.nodes[id].props[key]`
   * si `pageId` difiere de la activa, o `document.nodes[id].props[key]` si es la
   * activa — mismo árbol); en otro locale, en
   * `site.pages[pageId].translations[nodeId][locale][key]`. `pageId` es opcional
   * y por defecto es `activePageId` (retrocompat: la tabla de traducción de
   * Fase 19.j/51 siempre operaba sobre la página activa). Se agrega en docs/17.c
   * para que la tabla de traducción pueda cubrir una página distinta a la que
   * el usuario tiene abierta en el canvas, sin cambiar `activePageId` global.
   */
  setNodeTranslation: (nodeId: NodeId, locale: string, key: string, value: unknown, pageId?: PageId) => void;
  setStyleProp: (
    nodeId: NodeId,
    breakpoint: Breakpoint,
    path: [StyleGroup, string],
    value: unknown,
  ) => void;
  resetStyleProp: (
    nodeId: NodeId,
    breakpoint: Breakpoint,
    path: [StyleGroup, string],
  ) => void;
  /**
   * Estilo por ESTADO de interacción (T9, AGENTS.md): escribe/borra en
   * `node.style.states[state]`, ortogonal a `base`/`overrides` (sin
   * breakpoint — `states` es plano). Mismo patrón que `setStyleProp`/
   * `resetStyleProp`, sin el eje de breakpoint.
   */
  setStateStyleProp: (nodeId: NodeId, state: StyleState, path: [StyleGroup, string], value: unknown) => void;
  resetStateStyleProp: (nodeId: NodeId, state: StyleState, path: [StyleGroup, string]) => void;
  /**
   * Alterna la visibilidad del nodo en el breakpoint activo (docs/01 §8.1):
   * oculta con `display:none`, o muestra restaurando el display (heredado / por
   * defecto del componente / natural) vía `computeShowAction`. Única vía de
   * alternar visibilidad; la comparten el `VisibilityStrip` del Inspector y el
   * panel de Capas.
   */
  toggleNodeVisibility: (nodeId: NodeId) => void;
}

export const createPropsSlice: SliceCreator<PropsSlice> = (set, get) => ({
  setProp: (nodeId, key, value) =>
    set((s) => {
      // docs/12 §B.6: en el idioma default, escribe directo en props (como
      // siempre); en otro idioma, escribe en `site.pages[activePageId]
      // .translations[nodeId][editingLocale]` — SIN tocar `props` (que
      // permanece en el idioma default, docs/12 §B.4). `translations` vive
      // a nivel `BuilderPage` (site), no en la copia de trabajo `document`.
      if (s.editingLocale === s.site.meta.defaultLang) {
        const node = s.document.nodes[nodeId];
        if (node) {
          node.props[key] = value;
          // Exclusión mutua click-acción ↔ navegación: un `link` (control
          // "link" del propsSchema) con valor real y `onClick` (docs/20 §3)
          // no pueden coexistir en el mismo nodo — en export ambos emiten
          // atributos en el mismo elemento (`href` real + `data-pb-modal-
          // target`), ambiguo para el usuario y el runtime. Al escribir un
          // link con contenido, la acción de click existente se limpia.
          const def = getDefinition(node.type);
          const isLinkField = def?.propsSchema.fields.some(
            (f) => f.key === key && f.control === "link",
          );
          if (isLinkField && node.onClick && linkTargetHasValue(value)) {
            delete node.onClick;
          }
        }
        return;
      }
      const page = s.site.pages[s.activePageId];
      if (!page || !(nodeId in s.document.nodes)) return;
      page.translations ??= {};
      const nodeT = (page.translations[nodeId] ??= {});
      const localeT = (nodeT[s.editingLocale] ??= {});
      localeT[key] = value;
    }),

  setNodeTranslation: (nodeId, locale, key, value, pageId) =>
    set((s) => {
      const targetPageId = pageId ?? s.activePageId;
      const page = s.site.pages[targetPageId];
      if (!page) return;
      const targetDocument = targetPageId === s.activePageId ? s.document : page.document;
      if (!(nodeId in targetDocument.nodes)) return;
      if (locale === s.site.meta.defaultLang) {
        const node = targetDocument.nodes[nodeId];
        if (node) node.props[key] = value;
        return;
      }
      page.translations ??= {};
      const nodeT = (page.translations[nodeId] ??= {});
      const localeT = (nodeT[locale] ??= {});
      localeT[key] = value;
    }),

  setStyleProp: (nodeId, breakpoint, path, value) =>
    set((s) => {
      const node = s.document.nodes[nodeId];
      if (!node) return;
      const [group, key] = path;
      if (breakpoint === "base") {
        const g = (node.style.base[group] ??= {}) as Record<string, unknown>;
        g[key] = value;
      } else {
        node.style.overrides ??= {};
        const layer = (node.style.overrides[breakpoint] ??= {});
        const g = ((layer as Record<string, Record<string, unknown>>)[group] ??=
          {}) as Record<string, unknown>;
        g[key] = value;
      }
    }),

  resetStyleProp: (nodeId, breakpoint, path) =>
    set((s) => {
      const node = s.document.nodes[nodeId];
      if (!node) return;
      const [group, key] = path;
      if (breakpoint === "base") {
        const g = node.style.base[group] as Record<string, unknown> | undefined;
        if (!g) return;
        delete g[key];
        if (Object.keys(g).length === 0) delete node.style.base[group];
      } else {
        const layer = node.style.overrides?.[breakpoint];
        if (!layer) return;
        const g = (layer as Record<string, Record<string, unknown>>)[group];
        if (g) {
          delete g[key];
          if (Object.keys(g).length === 0)
            delete (layer as Record<string, unknown>)[group];
        }
        if (Object.keys(layer).length === 0) delete node.style.overrides![breakpoint];
        if (node.style.overrides && Object.keys(node.style.overrides).length === 0)
          delete node.style.overrides;
      }
    }),

  setStateStyleProp: (nodeId, state, path, value) =>
    set((s) => {
      const node = s.document.nodes[nodeId];
      if (!node) return;
      const [group, key] = path;
      node.style.states ??= {};
      const layer = (node.style.states[state] ??= {});
      const g = ((layer as Record<string, Record<string, unknown>>)[group] ??=
        {}) as Record<string, unknown>;
      g[key] = value;
    }),

  resetStateStyleProp: (nodeId, state, path) =>
    set((s) => {
      const node = s.document.nodes[nodeId];
      if (!node) return;
      const [group, key] = path;
      const layer = node.style.states?.[state];
      if (!layer) return;
      const g = (layer as Record<string, Record<string, unknown>>)[group];
      if (g) {
        delete g[key];
        if (Object.keys(g).length === 0) delete (layer as Record<string, unknown>)[group];
      }
      if (Object.keys(layer).length === 0) delete node.style.states![state];
      if (node.style.states && Object.keys(node.style.states).length === 0) delete node.style.states;
    }),

  toggleNodeVisibility: (nodeId) => {
    const s = get();
    const node = s.document.nodes[nodeId];
    if (!node) return;
    const bp = s.activeBreakpoint;
    const cfg = s.site.meta.breakpoints;
    const path: [StyleGroup, string] = ["layout", "display"];
    if (isHiddenAt(node.style, bp, cfg)) {
      // Mostrar: restaurar el display heredado / por defecto / natural.
      const defaultDisplay = getDefinition(node.type)?.defaultStyle.base.layout?.display;
      const action = computeShowAction(node.style, bp, cfg, defaultDisplay);
      if ("reset" in action) s.resetStyleProp(nodeId, bp, path);
      else s.setStyleProp(nodeId, bp, path, action.set);
    } else {
      // Ocultar en la capa del breakpoint activo.
      s.setStyleProp(nodeId, bp, path, "none");
    }
  },
});
