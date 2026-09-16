/**
 * UI-state del editor (docs/27 §4.1): selección de nodo, edición inline de
 * texto (Tiptap), overlay de edición de modal, breakpoint activo, vista
 * (`ViewMode`), idioma de contenido activo (`editingLocale`) y la petición
 * one-shot de tab del panel de configuración del sitio (`SiteTab`).
 *
 * Ninguno de estos campos entra al historial de zundo (`partialize: (s) =>
 * ({ document: s.document })` en `documentStore.ts`): es estado transitorio
 * de la sesión de edición, no parte del documento/sitio versionado. Esta es
 * la última slice de dominio extraída del store (docs/27 Fase 15) — con ella
 * `documentStore.ts` queda reducido a la composición del `create()`.
 */
import type { Editor as TiptapEditorInstance } from "@tiptap/react";

import type { Breakpoint, NodeId, StyleState } from "../../model/types";
import { initialSite } from "./core";
import type { SliceCreator } from "./types";

/** Vistas del header (PLAN §6). */
export type ViewMode = "edit" | "preview" | "code" | "json";

/**
 * Tabs del panel de configuración del sitio (`SiteSettingsPanel`). Vive aquí
 * porque el store guarda el UI-state `requestedSiteTab` (una petición one-shot
 * de "abrir la config del sitio en esta tab", emitida desde otros paneles
 * como el de Interactividad).
 */
export type SiteTab =
  | "layers"
  | "pages"
  | "languages"
  | "themes"
  | "seo"
  | "publish"
  | "settings";

/**
 * Tab activa del sidebar izquierdo (`Sidebar.tsx`): "Componentes", "Tokens" o
 * "Plantillas". Vive aquí (en vez de un `useState` local del componente) para
 * que código que corre FUERA de React — p. ej. el `before()` de un paso del
 * tour guiado — pueda cambiarla.
 */
export type SideTab = "components" | "tokens" | "templates";

export interface UiSlice {
  selectedId: NodeId | null;
  activeBreakpoint: Breakpoint;
  view: ViewMode;
  /**
   * Nodo `text` actualmente en edición inline en el canvas (Tiptap montado,
   * `contentEditable` real). `null` = ningún nodo en edición (pinta HTML
   * estático). Distinto de `selectedId`: un nodo puede estar seleccionado
   * (outline azul) sin estar en edición — se entra a edición con un segundo
   * click sobre un nodo ya seleccionado. UI-state: no entra a zundo, igual
   * que `selectedId`.
   */
  editingTextNodeId: NodeId | null;
  /**
   * Instancia de Tiptap del nodo actualmente en edición (docs/12 §B.11), o
   * `null` si no hay ninguno. La publica `Text.stub.tsx` (`TextEditingView`,
   * vía `onReady`/`onDestroy` de `TiptapEditor`) y la consume `TextToolbar`
   * (montada en `Canvas.tsx`, mismo patrón que `SelectionHandle`) para leer
   * el estado activo (`editor.isActive('bold')`) y ejecutar comandos sin que
   * ninguno de los dos necesite conocer al otro directamente. UI-state puro:
   * no entra a zundo, no se serializa, no es parte de `BuilderSite`.
   */
  activeTiptapEditor: TiptapEditorInstance | null;
  /**
   * Modal cuyo contenido se está editando en el OVERLAY del canvas (docs/20
   * §4.2), o `null`. UI-state (no entra a zundo): se abre al insertar un modal
   * o desde la burbuja de elementos no-visibles, y se cierra por X/backdrop/
   * Escape. El canvas renderiza el subárbol del modal como superficie editable.
   */
  editingModalId: NodeId | null;
  /**
   * Estado de interacción que se está PREVISUALIZANDO en el Inspector, POR NODO
   * seleccionado (`InspectorForm` → `StyleSection` → selector "Estado"). Mapa
   * `nodeId -> state` (`"hover" | "selected" | "pressed"`). Solo presente
   * mientras el usuario edita ese estado en el Inspector: `NodeRenderer` lo lee
   * y (a) lo PROPAGA como `RenderContext.previewState` para que el componente
   * pueda ajustar su render (p. ej. `icon` pinta el glifo alternativo cuando
   * `pressed` y hay `pressedName`); (b) si es `"pressed"`, fija `aria-pressed`
   * en el `rootProps` del nodo seleccionado para que la regla CSS del estado
   * (`T9`, `[aria-pressed="true"]`) aplique en vivo sin tocar el documento
   * (P1: UI-state, no entra a zundo, no se serializa). Al cambiar de nodo se
   * limpia la entrada del nodo anterior (`select()` resetea el preview del
   * nodo previo). Ausente del documento serializado.
   */
  previewStateBySelectedId: Record<NodeId, StyleState>;
  /**
   * Idioma de CONTENIDO activo en el editor (docs/12 §B.6). Análogo al
   * breakpoint activo: define qué CAPA de contenido se edita. Default =
   * `site.meta.defaultLang`. NO es lo mismo que el idioma del editor (i18next,
   * dimensión A) — son independientes. UI-state: no entra a zundo.
   */
  editingLocale: string;

  /**
   * Petición one-shot para abrir el panel de configuración del sitio
   * (`SiteSettingsPanel`) en una tab concreta, o `null` = sin petición
   * pendiente. UI-state (no entra a zundo ni se serializa). La emite
   * `openSiteSettings(tab)` — p. ej. el control `theme-select` del panel de
   * Interactividad, cuando el sitio aún no tiene temas y hay que mandar al
   * usuario a crearlos. `SiteSettingsPanel` la consume (abre esa tab) y la
   * limpia con `clearRequestedSiteTab`.
   */
  requestedSiteTab: SiteTab | null;

  /**
   * Tab activa del sidebar izquierdo (`SideTab`). UI-state (no entra a
   * zundo ni se serializa) — ver doc del tipo `SideTab` arriba.
   */
  sidebarTab: SideTab;

  // UI
  select: (id: NodeId | null) => void;
  /** Entra en modo edición inline de texto para `id` (docs/12 §B.11). */
  startEditingText: (id: NodeId) => void;
  /** Sale del modo edición inline de texto (blur, Escape, click fuera). */
  stopEditingText: () => void;
  /** Publica/limpia la instancia de Tiptap activa (docs/12 §B.11). */
  setActiveTiptapEditor: (editor: TiptapEditorInstance | null) => void;
  /** Abre el overlay de edición del modal `id` (docs/20 §4.2) y lo selecciona. */
  openModalEditor: (id: NodeId) => void;
  /** Cierra el overlay de edición del modal. */
  closeModalEditor: () => void;
  // Preview en vivo del estado de interacción seleccionado en el Inspector.
  /** Fija (o limpia con `null`) el estado previsualizado para el nodo. */
  setPreviewState: (nodeId: NodeId, state: StyleState | null) => void;
  setActiveBreakpoint: (bp: Breakpoint) => void;
  setView: (view: ViewMode) => void;
  /** Cambia el idioma de contenido activo (docs/12 §B.6). */
  setEditingLocale: (locale: string) => void;
  /**
   * Deselecciona el nodo activo (muestra `SiteSettingsPanel`) y pide abrirlo en
   * `tab`. Atajo para "llevar al usuario a la configuración del sitio" desde
   * otro panel (p. ej. el control `theme-select` cuando no hay temas).
   */
  openSiteSettings: (tab: SiteTab) => void;
  /** Limpia la petición pendiente de tab (la consume `SiteSettingsPanel`). */
  clearRequestedSiteTab: () => void;
  /** Cambia la tab activa del sidebar izquierdo (`SideTab`). */
  setSidebarTab: (tab: SideTab) => void;
}

export const createUiSlice: SliceCreator<UiSlice> = (set) => ({
  selectedId: null,
  editingTextNodeId: null,
  activeTiptapEditor: null,
  editingModalId: null,
  previewStateBySelectedId: {},
  // Canvas frame starts at Desktop (xl / 1280). Style cascade stays mobile-first;
  // this is only which viewport the editor opens on.
  activeBreakpoint: "xl",
  view: "edit",
  editingLocale: initialSite.meta.defaultLang,
  requestedSiteTab: null,
  sidebarTab: "components",

  select: (id) =>
    set((s) => {
      // Lock de selección durante pick & insert (docs/24 §9 decisión #4):
      // mientras se está colocando algo, no se puede navegar/seleccionar
      // otro nodo — el usuario debe confirmar o cancelar primero.
      if (s.pickInsert) return;
      // Captura el id anterior ANTES de mutar `selectedId` para limpiar
      // correctamente el `previewState` del nodo que se está abandonando.
      const previousId = s.selectedId;
      // Cambiar de selección (o deseleccionar) siempre sale de edición de
      // texto: el modo edición solo tiene sentido sobre el nodo `text`
      // seleccionado (segundo click), nunca sobre otro nodo distinto.
      s.selectedId = id;
      if (s.editingTextNodeId !== id) {
        s.editingTextNodeId = null;
        s.activeTiptapEditor = null;
      }
      // Limpia el previewState del nodo anterior: el estado previsualizado
      // pertenece al nodo SELECCIONADO, no al documento. Al cambiar de nodo
      // (o deseleccionar) vuelve a "Normal" implícito.
      if (previousId !== null && previousId !== id) {
        delete s.previewStateBySelectedId[previousId];
      }
    }),
  setPreviewState: (nodeId, state) =>
    set((s) => {
      if (state === null) {
        delete s.previewStateBySelectedId[nodeId];
      } else {
        s.previewStateBySelectedId[nodeId] = state;
      }
    }),
  startEditingText: (id) =>
    set((s) => {
      s.selectedId = id;
      s.editingTextNodeId = id;
    }),
  stopEditingText: () => set({ editingTextNodeId: null, activeTiptapEditor: null }),
  setActiveTiptapEditor: (editor) => set({ activeTiptapEditor: editor }),
  openModalEditor: (id) => set({ editingModalId: id, selectedId: id }),
  closeModalEditor: () => set({ editingModalId: null }),
  setActiveBreakpoint: (bp) => set({ activeBreakpoint: bp }),
  setView: (view) => set({ view }),
  setEditingLocale: (locale) => set({ editingLocale: locale }),
  openSiteSettings: (tab) =>
    set((s) => {
      // Igual que `select(null)`: sale de edición de texto y deselecciona
      // (así el Inspector muestra `SiteSettingsPanel`). Respeta el lock de
      // pick & insert (no navegar mientras se coloca algo).
      if (s.pickInsert) return;
      s.selectedId = null;
      s.editingTextNodeId = null;
      s.activeTiptapEditor = null;
      s.requestedSiteTab = tab;
    }),
  clearRequestedSiteTab: () => set({ requestedSiteTab: null }),
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
});
