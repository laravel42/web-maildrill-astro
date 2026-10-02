import React, { createContext, startTransition, useContext } from 'react';
import { create, createStore, StoreApi } from 'zustand';

import {
  applyThemeBundle as applyThemeBundlePure,
  extractThemeBundlePayload,
  pickResponsive,
  type ThemeBundle,
  type ThemeBundlePayload,
  type ThemeJson,
} from '@eb/document-core';

import { DEFAULT_PRESET_COLORS } from '../../constants';
import { EMPTY_EMAIL_MESSAGE } from '../../getConfiguration/sample/empty-email-message';
import { BLOCKS_DEFAULT_CSS } from '../blocks/helpers/constants';

import { parseComponentTreeColumnSlotId } from './componentTreeColumnSlot';
import { TEditorBlock, TEditorConfiguration } from './core';
import { migrateDocument } from './migrateDocument';
import { getUndoRedoState, resetUndoRedoStore, updateUndoRedoState } from './UndoRedoStore';

// Inspector width when expanded. 385 crowded the canvas; 320 still fits the
// widest control rows (colour + swatch, paired number inputs) without wrapping.
// Homologado con Builder42 (`.pbx-body`, shell.css:
// `grid-template-columns: 312px 1fr 326px`) — antes 320px, ya muy
// cercano; 326px lo iguala exactamente al inspector real de Builder42.
export const lateralPanel = 326;
export const DEFAULT_IMAGE_PLACEHOLDER =
  'https://ddc4vowthkjlv.cloudfront.net/uploads/gallery/1/69cc1b1083b90.jpg';

const INSPECTOR_STORAGE_KEY = 'eb-inspector-drawer';

function readInspectorPreference(): { open: boolean; mode: 'full' | 'compact'; manual: boolean } {
  try {
    const raw = localStorage.getItem(INSPECTOR_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        open: typeof parsed.open === 'boolean' ? parsed.open : true,
        mode: parsed.mode === 'full' ? 'full' : 'compact',
        // Whether the user set the mode by hand. Once true, the automatic
        // compaction (left drawer open / narrow viewport) must not override
        // the user's choice.
        manual: parsed.manual === true,
      };
    }
  } catch {
    /* ignore */
  }
  // Compact on first run: the inspector opens as a 56px icon rail and
  // expands on demand, so the canvas gets the width by default. A stored
  // preference always wins over this.
  return { open: true, mode: 'compact', manual: false };
}

function saveInspectorPreference(open: boolean, mode: 'full' | 'compact', manual: boolean) {
  try {
    localStorage.setItem(INSPECTOR_STORAGE_KEY, JSON.stringify({ open, mode, manual }));
  } catch {
    /* ignore */
  }
}

/**
 * Sistema de auto-save independiente con debounce largo
 */
let autoSaveTimeout: ReturnType<typeof setTimeout> | null = null;
const AUTO_SAVE_DELAY = 2000; // 2 segundos

export function triggerAutoSave() {
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }

  autoSaveTimeout = setTimeout(() => {
    const event = new CustomEvent<boolean>('email-builder-auto-save', {
      detail: true,
    });
    window.dispatchEvent(event);
  }, AUTO_SAVE_DELAY);
}

type TValue = {
  document: TEditorConfiguration;
  selectedBlockId: string | null;
  selectedSidebarTab: 'block-configuration' | 'styles' | 'css';
  selectedMainTab: 'editor' | 'preview' | 'json' | 'html';
  selectedScreenSize: 'desktop' | 'mobile';
  windowWidth: number;
  inspectorDrawerOpen: boolean;
  inspectorDrawerMode: 'full' | 'compact';
  /**
   * True once the user set the inspector mode by hand (via the
   * InspectorHandle). While true, automatic compaction driven by the
   * left Components Library drawer or a narrow viewport must NOT change
   * `inspectorDrawerMode` — the user's manual choice wins and persists.
   */
  inspectorModeUserOverride: boolean;
  componentTreeOpen: boolean;
  samplesDrawerOpen: boolean;
  /** Whether the left-side Components Library drawer is open. Defaults to false; the user toggles it via the side handle. */
  componentsLibraryDrawerOpen: boolean;
  /**
   * Display mode of the Components Library drawer. `full` shows the
   * complete taxonomy (Blocks / Sections / Templates with search + sort);
   * `compact` collapses it to a narrow rail that lists only the built-in
   * base blocks. Mirrors the right InspectorDrawer's full/compact mode.
   */
  componentsLibraryDrawerMode: 'full' | 'compact';
  /**
   * Active category in the Components Library drawer (`blocks` |
   * `themes` | future taxonomy keys). Lifted to the store so the
   * inspector "Apply theme" affordance can open the drawer directly
   * on the Themes tab.
   */
  componentsLibraryDrawerCategory: string;
  inspectorDrawerWidth: number;
  devMode: boolean;
  /** Storage backend for Components Library Templates + Themes. */
  componentsStorageMode: 'backend' | 'local';
  /**
   * Monotonic counter bumped to force every Components Library tab to
   * refetch its listing. Used by the local seeder and the lazy
   * thumbnail generator to refresh the drawer after mutating
   * localStorage outside the React tree.
   */
  componentsLibraryRefreshNonce: number;
  /** When false, hides the "Save as template" button. Defaults to true. */
  templateSaving: boolean;
  /** When false, hides the Templates tab in the Components Library drawer. Defaults to true. */
  templateLibrary: boolean;
  /** When true, shows the "Save as theme" button in the root inspector panel. Defaults to false. */
  themeSaving: boolean;
  imageUploading: {
    uploading: boolean;
    id: string;
  };
  disableEdition: boolean;
  disableUpdate: boolean;
  minHeight: string;
  color: {
    primary: string;
    secondary: string;
  };
  galleryImages: boolean;
  imagePlaceholder: string;
  /** Show the URL field in the Image block picker's Upload tab. */
  imageUrlInput: boolean;
  /** Show the drag & drop / file upload zone in the Image block picker's Upload tab. */
  imageUploadInput: boolean;
  /** Show the URL field in the Background image picker's Upload tab. */
  backgroundUrlInput: boolean;
  /** Show the drag & drop / file upload zone in the Background image picker's Upload tab. */
  backgroundUploadInput: boolean;
  darkMode: boolean;
  colorPicker: {
    paletteColors: string[];
    isLocked: boolean;
  };
  tour: boolean;
  /**
   * Bumped by `requestTourRestart()` to ask the mounted tour controller to
   * relaunch the guided tour on demand (CommandPalette entry, header help
   * button). See `useTourRestartNonce`.
   */
  tourRestartNonce: number;
  stickyHeader: boolean;
  heightContent: string;
  containerGrow: boolean;
  notionTextInlineEditingBlockId: string | null;
  /** Bloque bajo el cursor en el canvas; prioridad sobre la barra del seleccionado (salvo arrastre). */
  canvasHoveredBlockId: string | null;
  highlightColor: string;
  showVersion: boolean;
  /**
   * Id of the theme currently "selected" — either a preset id
   * (e.g. `classic-light`) or a saved library theme UUID. Set when a
   * theme is applied via `applyThemePreset`; cleared to `null` the
   * moment the user edits the global theme (root globals or per-block
   * overrides) since the document no longer matches the applied theme.
   * Transient editor state — not persisted in the document JSON.
   */
  appliedThemeId: string | null;
};

const createInitialState = (): TValue => ({
  document: migrateDocument(JSON.parse(JSON.stringify(EMPTY_EMAIL_MESSAGE))),
  selectedBlockId: null,
  selectedSidebarTab: 'styles',
  selectedMainTab: 'editor',
  selectedScreenSize: 'desktop',
  windowWidth: 0,
  inspectorDrawerOpen: readInspectorPreference().open,
  inspectorDrawerMode: readInspectorPreference().mode,
  inspectorModeUserOverride: readInspectorPreference().manual,
  componentTreeOpen: false,
  samplesDrawerOpen: true,
  componentsLibraryDrawerOpen: false,
  componentsLibraryDrawerMode: 'full',
  // 'blocks' — 'sections' was the initial value from before Point 7
  // (EMAIL_BUILDER_TASKS.md) removed the standalone Sections tab; it is
  // no longer a valid category key (see CATEGORIES in
  // ComponentsLibraryDrawer.tsx), so defaulting to it would immediately
  // get normalized away on first read (T2, D28).
  componentsLibraryDrawerCategory: 'blocks',
  inspectorDrawerWidth: lateralPanel,
  devMode: false,
  componentsStorageMode: 'backend',
  componentsLibraryRefreshNonce: 0,
  templateSaving: true,
  templateLibrary: true,
  themeSaving: false,
  imageUploading: {
    uploading: false,
    id: '',
  },
  disableEdition: false,
  disableUpdate: false,
  minHeight: 'calc(100dvh - 65px)',
  color: {
    primary: '',
    secondary: '',
  },
  galleryImages: true,
  imagePlaceholder: DEFAULT_IMAGE_PLACEHOLDER,
  imageUrlInput: true,
  imageUploadInput: true,
  backgroundUrlInput: true,
  backgroundUploadInput: true,
  darkMode: true,
  colorPicker: {
    paletteColors: DEFAULT_PRESET_COLORS,
    isLocked: false,
  },
  tour: false,
  tourRestartNonce: 0,
  stickyHeader: true,
  heightContent: 'calc(100dvh - 4px)',
  containerGrow: true,
  notionTextInlineEditingBlockId: null,
  canvasHoveredBlockId: null,
  highlightColor: '#FF6B35', // Naranja por defecto
  showVersion: false,
  // Fresh documents ship with the Classic Light theme's values baked
  // into the seed root (see empty-email-message.ts) so previews render
  // correctly — but no theme card should show as "Selected" until the
  // user explicitly picks one. Point 9 (EMAIL_BUILDER_TASKS.md): start
  // with no theme marked as applied; save/apply/list themes work exactly
  // as before, they just don't preselect on load.
  appliedThemeId: null,
});

export const editorStateStore = create<TValue>(() => createInitialState());

export const createEditorStateStore = (initialState?: Partial<TValue>) => {
  const base = createInitialState();
  return createStore<TValue>(() => ({
    ...base,
    ...initialState,
    document: initialState?.document ? migrateDocument(initialState.document) : base.document,
  }));
};

const EditorStoreContext = createContext<StoreApi<TValue>>(editorStateStore);

export const EditorStoreProvider: React.FC<{
  store?: StoreApi<TValue>;
  children: React.ReactNode;
}> = ({ store = editorStateStore, children }) => (
  <EditorStoreContext.Provider value={store}>{children}</EditorStoreContext.Provider>
);

export function useBlockTypeSelected() {
  // VENDOR PATCH — upstream nests a second `editorStateStore(...)` call inside
  // this selector. zustand v5 dropped v4's implicit shallow equality, so that
  // subscribes again on every read and returns an unstable snapshot, which
  // makes useSyncExternalStore re-render forever ("Maximum update depth
  // exceeded" in <InspectorDrawer>). Read the id as its own subscription and
  // return a primitive, which is stable across reads.
  const selectedBlockId = editorStateStore((s) => s.selectedBlockId);
  return editorStateStore((s) => s.document[selectedBlockId || '']?.type ?? null);
}

export function useInspectorDrawerWidth() {
  return editorStateStore((s) => s.inspectorDrawerWidth);
}

export function setInspectorDrawerWidth(inspectorDrawerWidth: number) {
  return editorStateStore.setState({ inspectorDrawerWidth });
}

export function useWindowWidth() {
  return editorStateStore((s) => s.windowWidth);
}

export function setWindowWidth(windowWidth: number) {
  return editorStateStore.setState({ windowWidth });
}

export function useDevMode() {
  return editorStateStore((s) => s.devMode);
}

export function setDevMode(devMode: boolean) {
  return editorStateStore.setState({ devMode });
}

export function useComponentsStorageMode() {
  return editorStateStore((s) => s.componentsStorageMode);
}

export function setComponentsStorageMode(mode: 'backend' | 'local') {
  const state = editorStateStore.getState();
  if (state.componentsStorageMode === mode) return;
  // Bump the library refresh nonce so every Components Library tab refetches
  // its listing against the new storage backend.
  return editorStateStore.setState({
    componentsStorageMode: mode,
    componentsLibraryRefreshNonce: state.componentsLibraryRefreshNonce + 1,
  });
}

export function useComponentsLibraryRefreshNonce() {
  return editorStateStore((s) => s.componentsLibraryRefreshNonce);
}

/**
 * Force every Components Library tab to refetch. Safe to call from
 * outside React (e.g. the local seeder / lazy thumbnail generator).
 */
export function bumpComponentsLibraryRefresh() {
  return editorStateStore.setState((s) => ({
    componentsLibraryRefreshNonce: s.componentsLibraryRefreshNonce + 1,
  }));
}

export function useTemplateSaving() {
  return editorStateStore((s) => s.templateSaving);
}

export function setTemplateSaving(enabled: boolean) {
  return editorStateStore.setState({ templateSaving: enabled });
}

export function useTemplateLibrary() {
  return editorStateStore((s) => s.templateLibrary);
}

export function setTemplateLibrary(enabled: boolean) {
  return editorStateStore.setState({ templateLibrary: enabled });
}

export function useThemeSaving() {
  return editorStateStore((s) => s.themeSaving);
}

export function setThemeSaving(enabled: boolean) {
  return editorStateStore.setState({ themeSaving: enabled });
}

/**
 * Product tour (F4, docs/product-tour-driverjs-plan.md §4). `tour` is the
 * flag the host passes to enable/disable the guided tour entirely (default
 * `false` — see `createInitialState`); it existed since F1 with no
 * consumer. `tourRestartNonce` is bumped by `requestTourRestart()` to ask
 * the mounted tour controller (`src/tour/useEmailBuilderTour.ts`) to relaunch
 * the tour on demand — from the CommandPalette entry or the header help
 * button — without adding a second parallel "is the tour open" flag.
 */
export function useTour() {
  return editorStateStore((s) => s.tour);
}

export function setTour(enabled: boolean) {
  return editorStateStore.setState({ tour: enabled });
}

export function useTourRestartNonce() {
  return editorStateStore((s) => s.tourRestartNonce);
}

export function requestTourRestart() {
  editorStateStore.setState((s) => ({ tourRestartNonce: s.tourRestartNonce + 1 }));
}

/** Non-React accessor used by the Components Library storage helpers. */
export function getComponentsStorageMode(): 'backend' | 'local' {
  return editorStateStore.getState().componentsStorageMode;
}

/**
 * Components Library affordances (drawer, handle, save/apply actions for
 * Templates + Themes) are visible when dev mode is on OR when local
 * storage mode is explicitly enabled (so a backend-less host like a
 * landing page can expose them).
 */
export function useComponentsLibraryEnabled() {
  return editorStateStore((s) => s.devMode || s.componentsStorageMode === 'local');
}

export function useDocument() {
  return editorStateStore((s) => s.document);
}

// Selectores granulares para evitar re-renders innecesarios
export function useBlock(blockId: string): TEditorBlock | undefined {
  return editorStateStore((s) => s.document[blockId]);
}

export function useBlockType(blockId: string) {
  return editorStateStore((s) => s.document[blockId]?.type);
}

export function useIsBlockSelected(blockId: string) {
  return editorStateStore((s) => s.selectedBlockId === blockId);
}

export function useBlockExists(blockId: string) {
  return editorStateStore((s) => blockId in s.document);
}

/**
 * Hook que se suscribe solo a las props de un bloque específico
 * Evita re-renders cuando cambian otras partes del bloque
 */
export function useBlockProps<T = any>(blockId: string): T {
  return editorStateStore((state) => {
    const data = state.document[blockId]?.data;
    return (data && 'props' in data ? data.props : undefined) as T;
  });
}

/**
 * Hook para una prop específica de un bloque
 * Máxima granularidad: solo se actualiza cuando cambia ESA prop
 */
export function useBlockProp<T = any>(blockId: string, propName: string): T | undefined {
  return editorStateStore((state) => {
    const data = state.document[blockId]?.data;
    if (!data || !('props' in data)) return undefined as T;
    return (data.props as Record<string, T> | null | undefined)?.[propName];
  });
}

export function useSelectedBlockId() {
  return editorStateStore((s) => s.selectedBlockId);
}

/**
 * Id of the theme currently marked as "selected" (preset id or library
 * theme UUID), or `null` when none is selected. Consumed by the theme
 * presets menu and the Components Library Themes tab to render a
 * "selected" mark on the matching entry.
 */
export function useAppliedThemeId() {
  return editorStateStore((s) => s.appliedThemeId);
}

/** Record the applied theme id so the matching entry shows a "selected" mark. */
export function setAppliedThemeId(themeId: string | null) {
  if (editorStateStore.getState().appliedThemeId === themeId) return;
  editorStateStore.setState({ appliedThemeId: themeId });
}

/**
 * Clear the "selected theme" mark. Called whenever the user edits the
 * global theme (root globals or per-block-type overrides) — once the
 * document diverges from the applied theme, no entry should stay marked.
 */
export function clearAppliedTheme() {
  if (editorStateStore.getState().appliedThemeId === null) return;
  editorStateStore.setState({ appliedThemeId: null });
}

export function useCanvasHoveredBlockId() {
  return editorStateStore((s) => s.canvasHoveredBlockId);
}

export function setCanvasHoveredBlockId(blockId: string | null) {
  editorStateStore.setState({ canvasHoveredBlockId: blockId });
}

export function useNotionTextInlineEditingBlockId() {
  return editorStateStore((s) => s.notionTextInlineEditingBlockId);
}

export function setNotionTextInlineEditingBlockId(blockId: string | null) {
  const currentEditingId = editorStateStore.getState().notionTextInlineEditingBlockId;
  if (currentEditingId && currentEditingId !== blockId) {
    window.dispatchEvent(
      new CustomEvent('notion-text-force-save', {
        detail: { blockId: currentEditingId },
      }),
    );
  }
  return editorStateStore.setState({ notionTextInlineEditingBlockId: blockId });
}

/**
 * Hook para determinar si el canvas está en modo de edición enfocado
 * Retorna true si hay un bloque NotionText en modo edición inline
 */
export function useIsInFocusedEditingMode(): boolean {
  const notionTextInlineEditingBlockId = useNotionTextInlineEditingBlockId();
  return Boolean(notionTextInlineEditingBlockId);
}

/**
 * Hook para obtener el ID del bloque que está en modo edición
 * Retorna el ID del bloque en edición o null si no hay ninguno
 */
export function useEditingBlockId(): string | null {
  return useNotionTextInlineEditingBlockId();
}

/**
 * Hook para obtener el color de resaltado del indicador de edición
 * Retorna el color configurado (naranja por defecto)
 */
export function useHighlightColor(): string {
  return editorStateStore((s) => s.highlightColor);
}

/**
 * React Context that lets a renderer (e.g. `Reader` from
 * `@eb/email-builder` when invoked from `renderToStaticMarkup`) pin the
 * effective viewport for its subtree, regardless of what the editor's
 * Zustand store currently has in `selectedScreenSize`.
 *
 * - When the value is `null` (default), `useSelectedScreenSize` falls
 *   through to the store. Editor canvas, AI streaming preview, and any
 *   other consumer that follows the user's viewport toggle keep their
 *   existing behaviour.
 * - When the value is a viewport (`'desktop'` / `'mobile'`), the entire
 *   subtree under the provider sees that value — used by the HTML
 *   export to force `'desktop'` so the produced markup works in clients
 *   that strip `<style>` blocks.
 *
 * See L42-312 (Phase 4) and `skills/theme-system.md` for context.
 */
const ViewportOverrideContext = createContext<TValue['selectedScreenSize'] | null>(null);

export const ViewportOverrideProvider: React.FC<{
  value: TValue['selectedScreenSize'] | null;
  children: React.ReactNode;
}> = ({ value, children }) => (
  <ViewportOverrideContext.Provider value={value}>{children}</ViewportOverrideContext.Provider>
);

export function useSelectedScreenSize() {
  // Override (set by `<ViewportOverrideProvider>`) takes priority over
  // the store. Hooks must run unconditionally, so both are read every
  // render and we pick at the end.
  const override = useContext(ViewportOverrideContext);
  const stored = editorStateStore((s) => s.selectedScreenSize);
  return override ?? stored;
}

export function useSelectedMainTab() {
  return editorStateStore((s) => s.selectedMainTab);
}

export function setSelectedMainTab(selectedMainTab: TValue['selectedMainTab']) {
  if (selectedMainTab === 'preview') {
    setSelectedBlockId(null);
  }

  editorStateStore.setState({
    inspectorDrawerOpen: selectedMainTab === 'editor',
  });
  return editorStateStore.setState({ selectedMainTab });
}

export function useSelectedSidebarTab() {
  return editorStateStore((s) => s.selectedSidebarTab);
}

export function useInspectorDrawerOpen() {
  return editorStateStore((s) => s.inspectorDrawerOpen);
}

export function useComponentTreeOpen() {
  return editorStateStore((s) => s.componentTreeOpen);
}

export function toggleComponentTree() {
  editorStateStore.setState((s) => ({ componentTreeOpen: !s.componentTreeOpen }));
}

export function useSamplesDrawerOpen() {
  return editorStateStore((s) => s.samplesDrawerOpen);
}

export function useImageUploading() {
  return editorStateStore((s) => s.imageUploading);
}

export function useDisableEdition() {
  return editorStateStore((s) => s.disableEdition);
}

// ============================================================================
// UNDO/REDO — Patrón Snapshot Síncrono con Debounce de Entrada
// ============================================================================

// Debounce de ENTRADA: evita guardar cada micro-cambio al mismo bloque
let lastSnapshotBlockId: string | null = null;
let lastSnapshotTimestamp: number = 0;
const SAME_BLOCK_DEBOUNCE_MS = 400;

// Límite del stack
const MAX_HISTORY = 50;

// Flags de bloqueo — semánticas separadas para claridad
let isPerformingUndoRedo = false; // Bloquea snapshots durante undo/redo
let isInUndoTransaction = false; // Bloquea snapshots intermedios durante transacciones

/**
 * Registra un snapshot del documento ANTES de un cambio.
 * 100% síncrono. El debounce solo decide si crear un nuevo snapshot,
 * nunca difiere la operación.
 */
function pushSnapshot(documentBeforeChange: TValue['document'], blockId?: string | null) {
  if (isPerformingUndoRedo || isInUndoTransaction) return;

  const now = Date.now();
  const elapsed = now - lastSnapshotTimestamp;
  const isSameBlockDebounce =
    blockId && blockId === lastSnapshotBlockId && elapsed < SAME_BLOCK_DEBOUNCE_MS;

  if (isSameBlockDebounce) {
    if (getUndoRedoState().future.length > 0) {
      updateUndoRedoState({ future: [] });
    }
    return;
  }

  const snapshot = JSON.stringify(documentBeforeChange);
  const { past } = getUndoRedoState();
  if (past.length > 0 && past[past.length - 1] === snapshot) {
    return;
  }

  const newPast = [...past, snapshot].slice(-MAX_HISTORY);
  updateUndoRedoState({ past: newPast, future: [] });

  lastSnapshotBlockId = blockId ?? null;
  lastSnapshotTimestamp = now;
}

export function setSelectedBlockId(selectedBlockId: TValue['selectedBlockId']) {
  const currentEditingId = editorStateStore.getState().notionTextInlineEditingBlockId;

  // Solo salir del modo edición cuando se selecciona un bloque
  // DIFERENTE y CONCRETO. Si selectedBlockId es null (e.g. auto-save,
  // blur sin selección), NO interrumpir la edición en curso.
  if (currentEditingId && selectedBlockId !== null && currentEditingId !== selectedBlockId) {
    setNotionTextInlineEditingBlockId(null);
  }

  const type = editorStateStore.getState().document[selectedBlockId || '']?.type;
  const selectedSidebarTab = BLOCKS_DEFAULT_CSS.includes(type || null)
    ? 'styles'
    : 'block-configuration';
  const options: Partial<TValue> = {};
  if (selectedBlockId !== null && editorStateStore.getState().selectedMainTab === 'editor') {
    options.inspectorDrawerOpen = true;
  }

  return editorStateStore.setState({
    selectedBlockId,
    selectedSidebarTab,
    ...options,
  });
}

export function setSidebarTab(selectedSidebarTab: TValue['selectedSidebarTab']) {
  return editorStateStore.setState({ selectedSidebarTab });
}

export function resetDocument(document: TValue['document']) {
  // Migrar bloques CustomEditor a Wysiwyg para retrocompatibilidad
  const migratedDocument = migrateDocument(document);

  // Resetear historial de undo/redo (no tiene sentido hacer pushSnapshot
  // justo antes de un reset completo)
  resetUndoRedoStore();

  return editorStateStore.setState({
    document: migratedDocument,
    selectedSidebarTab: 'styles',
    selectedBlockId: null,
  });
}

/**
 * Agrupa múltiples actualizaciones en una sola entrada de undo/redo.
 * Toma un snapshot al inicio de la transacción y bloquea snapshots internos.
 */
export function withUndoTransaction<T>(fn: () => T): T {
  const originalDocument = editorStateStore.getState().document;
  isInUndoTransaction = true;
  let result: T;
  try {
    result = fn();
  } finally {
    isInUndoTransaction = false;
  }
  // Único snapshot para toda la transacción (null = no debounce por bloque)
  pushSnapshot(originalDocument, null);
  return result;
}

/**
 * No-op: en el sistema nuevo todo es síncrono, no hay nada que flushear.
 * Se mantiene como export para compatibilidad con App/index.tsx (beforeunload).
 */
export function flushUndoRedo() {
  // No-op — snapshots son síncronos, no hay pendientes.
}

// Re-exportar hooks desde UndoRedoStore
export { useCanUndo, useCanRedo, useStackUndo } from './UndoRedoStore';

/**
 * Undo: 100% síncrono. Pop del past, push al future.
 */
export function undoChange() {
  const { past, future } = getUndoRedoState();
  if (past.length === 0) return;

  isPerformingUndoRedo = true;
  try {
    const currentDocument = editorStateStore.getState().document;
    const currentSnapshot = JSON.stringify(currentDocument);

    const newPast = [...past];
    const snapshotToRestore = newPast.pop()!;

    const restoredDocument = JSON.parse(snapshotToRestore);

    updateUndoRedoState({
      past: newPast,
      future: [...future, currentSnapshot],
    });

    const selectedBlockId = editorStateStore.getState().selectedBlockId;
    const shouldClearSelection = selectedBlockId && !restoredDocument[selectedBlockId];

    editorStateStore.setState({
      document: restoredDocument,
      ...(shouldClearSelection ? { selectedBlockId: null } : {}),
    });
  } finally {
    isPerformingUndoRedo = false;
    lastSnapshotBlockId = null;
  }
}

/**
 * Redo: 100% síncrono. Pop del future, push al past.
 */
export function redoChange() {
  const { past, future } = getUndoRedoState();
  if (future.length === 0) return;

  isPerformingUndoRedo = true;
  try {
    const currentDocument = editorStateStore.getState().document;
    const currentSnapshot = JSON.stringify(currentDocument);

    const newFuture = [...future];
    const snapshotToRestore = newFuture.pop()!;

    const restoredDocument = JSON.parse(snapshotToRestore);

    updateUndoRedoState({
      past: [...past, currentSnapshot],
      future: newFuture,
    });

    const selectedBlockId = editorStateStore.getState().selectedBlockId;
    const shouldClearSelection = selectedBlockId && !restoredDocument[selectedBlockId];

    editorStateStore.setState({
      document: restoredDocument,
      ...(shouldClearSelection ? { selectedBlockId: null } : {}),
    });
  } finally {
    isPerformingUndoRedo = false;
    lastSnapshotBlockId = null;
  }
}

export function setDocument(document: TValue['document'], modified: boolean = true) {
  const originalDocument = editorStateStore.getState().document;
  const newDocument = {
    ...originalDocument,
    ...document,
  };

  // pushSnapshot síncrono ANTES del setState
  if (modified) {
    pushSnapshot(originalDocument);
  }

  const updateState = () => {
    editorStateStore.setState({ document: newDocument });

    // Disparar auto-save después de actualizar el estado
    triggerAutoSave();
  };

  // Si es una actualización urgente (modified=false), ejecutar inmediatamente
  // Si es una actualización normal, usar startTransition para no bloquear la UI
  if (modified) {
    startTransition(updateState);
    // Retornar el estado actual para mantener compatibilidad
    return editorStateStore.getState();
  } else {
    return updateState();
  }
}

export function toggleInspectorDrawerOpen() {
  const inspectorDrawerOpen = !editorStateStore.getState().inspectorDrawerOpen;
  return editorStateStore.setState({ inspectorDrawerOpen });
}

export function useInspectorDrawerMode() {
  return editorStateStore((s) => s.inspectorDrawerMode);
}

/**
 * Manual inspector mode change (triggered by the user via InspectorHandle).
 * Flags `inspectorModeUserOverride` so automatic compaction (left drawer /
 * narrow viewport) stops overriding the mode, and persists the choice.
 */
export function setInspectorDrawerMode(mode: 'full' | 'compact') {
  editorStateStore.setState({
    inspectorDrawerMode: mode,
    inspectorDrawerOpen: true,
    inspectorModeUserOverride: true,
  });
  saveInspectorPreference(true, mode, true);
}

/**
 * Automatic inspector mode change (viewport width / left drawer open-close).
 * No-op when the user has taken manual control — this never flips the
 * override flag nor persists, so it can never clobber a hand-set mode.
 */
export function setInspectorDrawerModeAuto(mode: 'full' | 'compact') {
  if (editorStateStore.getState().inspectorModeUserOverride) return;
  editorStateStore.setState({ inspectorDrawerMode: mode });
}

/**
 * Cycle through inspector states: full → compact → closed → full.
 * This is a manual user action, so it also takes over from automatic mode.
 */
export function cycleInspectorDrawerMode() {
  const { inspectorDrawerOpen, inspectorDrawerMode } = editorStateStore.getState();
  if (!inspectorDrawerOpen) {
    // closed → full
    editorStateStore.setState({
      inspectorDrawerOpen: true,
      inspectorDrawerMode: 'full',
      inspectorModeUserOverride: true,
    });
    saveInspectorPreference(true, 'full', true);
    return;
  }
  if (inspectorDrawerMode === 'full') {
    // full → compact
    editorStateStore.setState({ inspectorDrawerMode: 'compact', inspectorModeUserOverride: true });
    saveInspectorPreference(true, 'compact', true);
    return;
  }
  // compact → closed
  editorStateStore.setState({
    inspectorDrawerOpen: false,
    inspectorDrawerMode: 'full',
    inspectorModeUserOverride: true,
  });
  saveInspectorPreference(false, 'full', true);
}

export function toggleSamplesDrawerOpen() {
  const samplesDrawerOpen = !editorStateStore.getState().samplesDrawerOpen;
  return editorStateStore.setState({ samplesDrawerOpen });
}

export function useComponentsLibraryDrawerOpen() {
  return editorStateStore((s) => s.componentsLibraryDrawerOpen);
}

export function toggleComponentsLibraryDrawerOpen() {
  const { componentsLibraryDrawerOpen, inspectorDrawerOpen, inspectorModeUserOverride } =
    editorStateStore.getState();
  const next = !componentsLibraryDrawerOpen;
  const update: Partial<TValue> = { componentsLibraryDrawerOpen: next };
  if (next && inspectorDrawerOpen && !inspectorModeUserOverride) {
    update.inspectorDrawerMode = 'compact';
  } else if (!next) {
    const pref = readInspectorPreference();
    // Only restore the inspector when we're on the editor tab — it must
    // never appear in preview / html / json views.
    const isEditor = editorStateStore.getState().selectedMainTab === 'editor';
    update.inspectorDrawerOpen = isEditor && pref.open;
    // Respect a hand-set mode: never revert the user's manual choice.
    if (!inspectorModeUserOverride) {
      update.inspectorDrawerMode = pref.mode;
    }
  }
  return editorStateStore.setState(update);
}

export function setComponentsLibraryDrawerOpen(componentsLibraryDrawerOpen: boolean) {
  const { inspectorDrawerOpen, inspectorModeUserOverride } = editorStateStore.getState();
  const update: Partial<TValue> = { componentsLibraryDrawerOpen };
  if (componentsLibraryDrawerOpen && inspectorDrawerOpen && !inspectorModeUserOverride) {
    update.inspectorDrawerMode = 'compact';
  } else if (!componentsLibraryDrawerOpen) {
    const pref = readInspectorPreference();
    // Only restore the inspector when we're on the editor tab — it must
    // never appear in preview / html / json views.
    const isEditor = editorStateStore.getState().selectedMainTab === 'editor';
    update.inspectorDrawerOpen = isEditor && pref.open;
    // Respect a hand-set mode: never revert the user's manual choice.
    if (!inspectorModeUserOverride) {
      update.inspectorDrawerMode = pref.mode;
    }
  }
  return editorStateStore.setState(update);
}

export function useComponentsLibraryDrawerCategory() {
  return editorStateStore((s) => s.componentsLibraryDrawerCategory);
}

export function useComponentsLibraryDrawerMode() {
  return editorStateStore((s) => s.componentsLibraryDrawerMode);
}

/**
 * Switch the Components Library drawer between `full` (complete taxonomy)
 * and `compact` (narrow base-blocks rail). Mirrors the right
 * InspectorDrawer's full/compact toggle. Reachable only while the drawer
 * is open (the mode handle renders only then), so it never force-opens.
 */
export function setComponentsLibraryDrawerMode(mode: 'full' | 'compact') {
  if (editorStateStore.getState().componentsLibraryDrawerMode === mode) return;
  return editorStateStore.setState({ componentsLibraryDrawerMode: mode });
}

export function toggleComponentsLibraryDrawerMode() {
  const next =
    editorStateStore.getState().componentsLibraryDrawerMode === 'full' ? 'compact' : 'full';
  return editorStateStore.setState({ componentsLibraryDrawerMode: next });
}

export function setComponentsLibraryDrawerCategory(category: string) {
  return editorStateStore.setState({ componentsLibraryDrawerCategory: category });
}

/**
 * Open the Components Library drawer on a specific category in a
 * single set call. Used by the inspector "Apply theme" button and by
 * any future "open library on X" affordance.
 */
export function openComponentsLibraryDrawerOn(category: string) {
  const update: Partial<TValue> = {
    componentsLibraryDrawerOpen: true,
    componentsLibraryDrawerCategory: category,
  };
  if (editorStateStore.getState().inspectorDrawerOpen) {
    update.inspectorDrawerMode = 'compact';
  }
  return editorStateStore.setState(update);
}

export function setSelectedScreenSize(selectedScreenSize: TValue['selectedScreenSize']) {
  return editorStateStore.setState({ selectedScreenSize });
}

export function setImageUploading(uploading: boolean, id: string | null) {
  return editorStateStore.setState({ imageUploading: { uploading, id: id || '' } });
}

export function setDisableEdition(disableEdition: boolean) {
  return editorStateStore.setState({ disableEdition });
}
export function getParentColumnCount(blockId: string): number {
  const document = editorStateStore.getState().document;

  const findParentColumnsContainer = (currentId: string): number => {
    for (const [id, block] of Object.entries(document)) {
      if (block.type === 'ColumnsContainer') {
        const columns = block.data.props?.columns ?? [];
        for (const column of columns as { childrenIds: string[] }[]) {
          if (column.childrenIds.includes(currentId)) {
            return block.data.props?.columnsCount ?? 0;
          }
        }
      }
      const dataWithProps = block.data as { props?: { childrenIds?: string[] } };
      const blockProps =
        block.type !== 'EmailLayout' && dataWithProps.props ? dataWithProps.props : undefined;
      if (blockProps?.childrenIds?.includes(currentId)) {
        if (block.type === 'ColumnsContainer') {
          return block.data.props?.columnsCount ?? 0;
        }
        return findParentColumnsContainer(id);
      }
    }
    return 0;
  };

  return findParentColumnsContainer(blockId);
}
export function getParentColumn(blockId: string) {
  const document = editorStateStore.getState().document;

  const findParentColumn = (currentId: string): object | null => {
    for (const [id, block] of Object.entries(document)) {
      if (block.type === 'ColumnsContainer') {
        const columns = block.data.props?.columns ?? [];
        for (const column of columns as { childrenIds: string[] }[]) {
          if (column.childrenIds.includes(currentId)) {
            return block.data.props ?? null;
          }
        }
      }

      const dataWithProps = block.data as { props?: { childrenIds?: string[] } };
      const blockProps =
        block.type !== 'EmailLayout' && dataWithProps.props ? dataWithProps.props : undefined;
      if (blockProps?.childrenIds?.includes(currentId)) {
        if (block.type === 'ColumnsContainer') {
          return block.data.props ?? null;
        }
        return findParentColumn(id);
      }
    }
    return null;
  };

  return findParentColumn(blockId);
}

export function getWidthActualColumn(blockId: string) {
  const parentColumns = getParentColumn(blockId) as any;
  const columnPosition = parentColumns?.columns?.findIndex((column: any) =>
    column.childrenIds.includes(blockId),
  );
  if (columnPosition !== -1 && parentColumns?.fixedWidths) {
    return parentColumns?.fixedWidths[columnPosition];
  }
  return null;
}

export function getRootSnapshot() {
  return editorStateStore.getState().document.root.data;
}

// Selector reactivo para root data - se actualiza cuando cambia el documento
export function useRoot() {
  return editorStateStore((s) => s.document?.root?.data);
}

// Selector reactivo específico para linkGlobal - más granular, menos re-renders
export function useLinkGlobal() {
  return editorStateStore((s) => {
    const data = s.document?.root?.data;
    return data && 'linkGlobal' in data ? data.linkGlobal : undefined;
  });
}

// ============================================================================
// THEME — granular reads + atomic writes for `root.data.theme.blocks[type]`
// ============================================================================
//
// Phase 2c — Inspector Theme panel.
//
// The theme lives at `root.data.theme` (see `themeJsonSchema` in
// `@eb/document-core`). Resolution is wired by Phase 2b into
// `EditorBlock` and the Reader, so any value written here propagates
// to canvas and export without further plumbing.
//
// These helpers expose the slot at `theme.blocks[type].<style|props>.<key>`
// as if it were a regular block prop:
//
//   - `useThemeBlockOverride(type)`     — granular read of the whole override
//   - `useThemeOverrideValue(type, section, key)` — granular read of a single
//     key, with `Responsive<T>` collapsed by the active viewport so the
//     panel UI stays in sync with the editor's desktop/mobile toggle.
//   - `setThemeValue(type, section, key, value)`  — atomic write (lazy
//     creates `theme`, `theme.blocks`, `theme.blocks[type]`, etc.).
//   - `resetThemeValue(type, section, key)`        — remove the override
//     and prune empty parents so the saved JSON stays sparse.
//
// All writes go through `updateBlock('root', ...)`, which already
// integrates undo/redo and triggers auto-save.

export type ThemeSection = 'style' | 'props';

function readThemeBlockOverride(theme: ThemeJson | undefined | null, blockType: string) {
  return theme?.blocks?.[blockType] as
    { style?: Record<string, unknown>; props?: Record<string, unknown> } | undefined;
}

/**
 * Granular hook returning the entire `theme.blocks[type]` override slot
 * (or undefined when no override is set). Re-renders only when this
 * specific block-type override changes, not on unrelated root edits.
 */
export function useThemeBlockOverride(blockType: string) {
  return editorStateStore((s) => {
    const data = s.document?.root?.data as { theme?: ThemeJson } | undefined;
    return readThemeBlockOverride(data?.theme, blockType);
  });
}

/**
 * Granular hook for a single theme-overridable key. Returns the raw
 * value as stored in the theme (NOT collapsed by viewport). Useful when
 * the panel needs to render a `Responsive<T>` editor.
 */
export function useThemeOverrideRaw(
  blockType: string,
  section: ThemeSection,
  key: string,
): unknown {
  return editorStateStore((s) => {
    const data = s.document?.root?.data as { theme?: ThemeJson } | undefined;
    const override = readThemeBlockOverride(data?.theme, blockType);
    const sectionObj = override?.[section];
    if (!sectionObj || !Object.prototype.hasOwnProperty.call(sectionObj, key)) {
      return undefined;
    }
    return sectionObj[key];
  });
}

/**
 * Granular hook for a single theme-overridable key. The result is
 * collapsed to the active viewport when the value is a
 * `Responsive<T>` wrapper, so the input shows the right variant when
 * the user toggles desktop/mobile.
 */
export function useThemeOverrideValue<T = unknown>(
  blockType: string,
  section: ThemeSection,
  key: string,
): T | undefined {
  return editorStateStore((s) => {
    const data = s.document?.root?.data as { theme?: ThemeJson } | undefined;
    const override = readThemeBlockOverride(data?.theme, blockType);
    const sectionObj = override?.[section];
    if (!sectionObj || !Object.prototype.hasOwnProperty.call(sectionObj, key)) {
      return undefined;
    }
    return pickResponsive<T>(sectionObj[key], s.selectedScreenSize);
  });
}

/**
 * Atomic write to `root.data.theme.blocks[type][section][key]`. Lazily
 * creates parent objects when they don't exist. `null`/`undefined`
 * values are treated as "reset" to keep the saved JSON sparse — the
 * dedicated `resetThemeValue` helper is preferred for that case but
 * this guard prevents accidental dead writes.
 */
export function setThemeValue(
  blockType: string,
  section: ThemeSection,
  key: string,
  value: unknown,
) {
  if (value === undefined || value === null) {
    resetThemeValue(blockType, section, key);
    return;
  }

  // Editing the theme diverges the document from any applied preset /
  // library theme, so drop the "selected" mark.
  clearAppliedTheme();

  updateBlock('root', (block) => {
    if (block.type !== 'EmailLayout') return block;
    const data = (block.data ?? {}) as { theme?: ThemeJson } & Record<string, unknown>;
    const theme: ThemeJson = data.theme ? { ...data.theme } : {};
    const blocks = theme.blocks ? { ...theme.blocks } : {};
    const current =
      (blocks[blockType] as
        { style?: Record<string, unknown>; props?: Record<string, unknown> } | undefined) ?? {};
    const sectionObj = (current[section] as Record<string, unknown> | undefined) ?? {};

    if (sectionObj[key] === value) {
      return block;
    }

    const nextSection = { ...sectionObj, [key]: value };
    const nextBlock = { ...current, [section]: nextSection };
    blocks[blockType] = nextBlock;
    theme.blocks = blocks;

    return {
      ...block,
      data: {
        ...data,
        theme,
      },
    };
  });
}

/**
 * Remove a single theme override and prune empty parents. After a reset
 * the resolution chain falls through to the block schema's default
 * (level 3), preserving the "transparent" behavior of legacy documents.
 */
export function resetThemeValue(blockType: string, section: ThemeSection, key: string) {
  // A reset is still a manual edit of the theme — clear the mark.
  clearAppliedTheme();

  updateBlock('root', (block) => {
    if (block.type !== 'EmailLayout') return block;
    const data = (block.data ?? {}) as { theme?: ThemeJson } & Record<string, unknown>;
    const theme = data.theme;
    if (!theme?.blocks) return block;

    const blockOverride = theme.blocks[blockType] as
      { style?: Record<string, unknown>; props?: Record<string, unknown> } | undefined;
    const sectionObj = blockOverride?.[section];
    if (!sectionObj || !Object.prototype.hasOwnProperty.call(sectionObj, key)) {
      return block;
    }

    const nextSection = { ...sectionObj };
    delete nextSection[key];

    const nextBlocks = { ...theme.blocks } as NonNullable<ThemeJson['blocks']>;
    if (Object.keys(nextSection).length === 0) {
      // Prune empty section
      const nextBlockOverride = { ...blockOverride } as {
        style?: Record<string, unknown>;
        props?: Record<string, unknown>;
      };
      delete nextBlockOverride[section];
      if (Object.keys(nextBlockOverride).length === 0) {
        // Prune empty block-type override
        delete nextBlocks[blockType];
      } else {
        nextBlocks[blockType] = nextBlockOverride;
      }
    } else {
      nextBlocks[blockType] = { ...blockOverride, [section]: nextSection };
    }

    const nextTheme: ThemeJson =
      Object.keys(nextBlocks).length === 0 ? {} : { ...theme, blocks: nextBlocks };
    const nextData = { ...data } as Record<string, unknown>;
    if (Object.keys(nextTheme).length === 0) {
      delete nextData.theme;
    } else {
      nextData.theme = nextTheme;
    }

    return {
      ...block,
      data: nextData,
    } as typeof block;
  });
}

/**
 * Convenience hook bundling read + write + reset for a single field.
 * Designed for the inspector Theme panel rows so each field can stay
 * stateless and re-render only when its own value changes.
 */
export function useThemeField<T = unknown>(blockType: string, section: ThemeSection, key: string) {
  const value = useThemeOverrideValue<T>(blockType, section, key);
  const isOverridden = useThemeOverrideRaw(blockType, section, key) !== undefined;
  return {
    value,
    isOverridden,
    set: (next: unknown) => setThemeValue(blockType, section, key, next),
    reset: () => resetThemeValue(blockType, section, key),
  };
}

// ----------------------------------------------------------------------------
// THEME BUNDLES — L42-306
// ----------------------------------------------------------------------------
//
// A theme bundle is a portable snapshot of the EmailLayout root globals
// (canvasColor, textColor, fontFamily, …) AND the per-block-type theme
// overrides stored under `root.data.theme`. Bundles are persisted on the
// backend (`/dev/save-theme`) and shown in the Components Library
// drawer "Themes" tab so the user can build a small gallery of looks.
//
// `applyThemeBundle` is a SINGLE atomic write through `updateBlock('root',
// ...)` so the change collapses into one undo step regardless of how
// many globals + per-block overrides the bundle touches.

/**
 * Snapshot the current root globals + `theme.blocks` as a bundle
 * payload (no metadata). Callers wrap this with `name`/`description`
 * before sending to `/dev/save-theme`.
 */
export function buildCurrentThemeBundlePayload(): ThemeBundlePayload {
  const root = editorStateStore.getState().document?.root;
  if (!root) return {};
  return extractThemeBundlePayload(root.data);
}

/**
 * Apply a fetched bundle (or a freshly-built payload) to the live
 * document. Strict replacement — root globals and `theme.blocks` not
 * present in the bundle revert to schema defaults. Single undo step.
 *
 * Accepts either a full `ThemeBundle` (id + metadata + payload, what
 * the backend returns) or a bare `ThemeBundlePayload` (used by
 * `clearThemeBundle()` and tests).
 */
export function applyThemeBundle(bundle: ThemeBundle | ThemeBundlePayload): void {
  updateBlock('root', (block) => {
    if (block.type !== 'EmailLayout') return block;
    const nextData = applyThemeBundlePure(block.data, {
      globals: bundle.globals,
      blocks: bundle.blocks,
    });
    return {
      ...block,
      data: nextData,
    } as typeof block;
  });
}

/**
 * Remove the explicit per-block keys a theme override governs (both
 * `style` and `props` sections) so the theme value (resolution level 2)
 * wins over the block's own explicit value (level 1).
 */
function stripGovernedKeys<T extends { data: unknown }>(
  block: T,
  override: { style?: Record<string, unknown>; props?: Record<string, unknown> },
): T {
  const keys = new Set<string>();
  for (const section of ['style', 'props'] as const) {
    const o = override[section];
    if (o) Object.keys(o).forEach((k) => keys.add(k));
  }
  if (keys.size === 0) return block;

  const data = block.data as Record<string, unknown>;
  let nextData = data;
  for (const section of ['style', 'props'] as const) {
    const blockSection = nextData[section] as Record<string, unknown> | undefined;
    if (!blockSection || typeof blockSection !== 'object') continue;
    let nextSection = blockSection;
    for (const key of keys) {
      if (key in nextSection) {
        if (nextSection === blockSection) nextSection = { ...blockSection };
        delete nextSection[key];
      }
    }
    if (nextSection !== blockSection) {
      if (nextData === data) nextData = { ...data };
      nextData[section] = nextSection;
    }
  }
  return nextData === data ? block : ({ ...block, data: nextData } as T);
}

/**
 * Remove only the inline `color` declaration from every styled element
 * in a NotionText `props.html`, leaving `background-color` and other
 * declarations untouched. Lets manually-colored text fall back to the
 * theme's global `textColor` when a preset is applied.
 */
function stripInlineTextColor(html: string): string {
  if (!html || !html.includes('color')) return html;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let changed = false;
  doc.body.querySelectorAll('[style]').forEach((el) => {
    const style = el.getAttribute('style') ?? '';
    const kept = style
      .split(';')
      .filter((decl) => decl.split(':')[0]?.trim().toLowerCase() !== 'color')
      .join(';')
      .trim();
    if (kept !== style.trim()) {
      changed = true;
      if (kept) el.setAttribute('style', kept);
      else el.removeAttribute('style');
    }
  });
  return changed ? doc.body.innerHTML : html;
}

/**
 * Make a NotionText block inherit the theme's global `textColor`: clears
 * its block-level `style.color` (resolution level 1) AND strips inline
 * `color` from `props.html`, leaving backgrounds/highlights intact.
 */
function stripNotionTextColor<T extends { data: unknown }>(block: T): T {
  const data = block.data as {
    style?: Record<string, unknown> | null;
    props?: { html?: unknown } | null;
  };
  let nextData = data as Record<string, unknown>;
  let changed = false;

  const style = data?.style;
  if (style && style.color != null) {
    const restStyle = { ...style };
    delete restStyle.color;
    nextData = { ...nextData, style: restStyle };
    changed = true;
  }

  const html = (nextData.props as { html?: unknown } | null | undefined)?.html;
  if (typeof html === 'string') {
    const nextHtml = stripInlineTextColor(html);
    if (nextHtml !== html) {
      nextData = { ...nextData, props: { ...(nextData.props as object), html: nextHtml } };
      changed = true;
    }
  }

  return changed ? ({ ...block, data: nextData } as T) : block;
}

/**
 * Clean a single non-root block so the current theme wins over the
 * block's own explicit styling — the exact per-block transform
 * `applyThemePreset` runs across the whole document, reused by the
 * Components Library insert + live-preview paths so a saved component
 * adopts the destination/project theme.
 *
 *  - Strips the theme-governed keys (`theme.blocks[type]`, resolution
 *    level 1) so the theme override (level 2) surfaces.
 *  - For NotionText additionally clears block-level `style.color` AND
 *    inline `color` in `props.html`, so manually-coloured text inherits
 *    the theme's global `textColor`.
 *
 * No theme override for the block type → only the NotionText colour
 * pass applies. No theme at all → governed strip is a no-op (NotionText
 * colour is still normalised to inherit the document's global text
 * colour, matching `applyThemePreset`).
 */
export function stripBlockStylesForTheme<T extends TEditorBlock>(
  block: T,
  theme: ThemeJson | undefined,
): T {
  if (block.type === 'EmailLayout') return block;
  const override = theme?.blocks?.[block.type] as
    { style?: Record<string, unknown>; props?: Record<string, unknown> } | undefined;
  const cleared = override ? (stripGovernedKeys(block as any, override) as T) : block;
  return (cleared.type === 'NotionText' ? stripNotionTextColor(cleared as any) : cleared) as T;
}

/**
 * Apply a preset bundle with FULL override semantics (option A): like
 * `applyThemeBundle` it writes the root globals + `theme.blocks`, but it
 * ALSO strips the matching explicit per-block overrides (resolution
 * level 1) from every block so the theme value (level 2) wins even on
 * blocks the user already edited. NotionText additionally has its inline
 * text `color` stripped so manually-colored text inherits the theme.
 * Single `setDocument` → one undo step.
 */
export function applyThemePreset(bundle: ThemeBundlePayload, themeId?: string | null): void {
  const current = editorStateStore.getState().document;
  if (!current) return;
  const themeForStrip: ThemeJson | undefined = bundle.blocks
    ? { blocks: bundle.blocks }
    : undefined;

  const next = {} as typeof current;
  for (const [id, block] of Object.entries(current)) {
    if (block.type === 'EmailLayout') {
      next[id] = {
        ...block,
        data: applyThemeBundlePure(block.data, { globals: bundle.globals, blocks: bundle.blocks }),
      } as typeof block;
      continue;
    }
    next[id] = stripBlockStylesForTheme(block, themeForStrip);
  }
  setDocument(next, true);
  // Mark the applied theme so the presets menu / Themes tab can show a
  // "selected" mark. `setDocument` uses startTransition, but this flag
  // is independent UI state so it can land synchronously.
  setAppliedThemeId(themeId ?? null);
}

/**
 * Reset every root global + every per-block-type override to schema
 * defaults. Equivalent to applying an empty bundle. Reachable through
 * a future "Reset theme" affordance — included here so the API is
 * complete; v1 does not expose a UI button for it yet.
 */
export function clearThemeBundle(): void {
  applyThemeBundle({});
}

// ----------------------------------------------------------------------------
// TEMPLATE APPLY — L42-309 (Phase 9)
// ----------------------------------------------------------------------------
//
// A template is a full document — it carries the `EmailLayout` root and
// every descendant. Inserting a template REPLACES the entire current
// document with the template's blocks. Single undo step (one
// `pushSnapshot` of the prior document); autosave fires once.
//
// On disk the root block lives at id `component-{shortId}-1` (the
// regular renumbering convention). On apply we rename that first entry
// back to the literal `'root'` id so the rest of the editor — which
// always anchors at `document.root` — keeps working.

/**
 * Replace the current document with the supplied template subtree.
 * Returns true when the apply succeeded, false when the input array
 * was empty or the first block wasn't an EmailLayout (defensive — the
 * backend already rejects non-EmailLayout templates on save).
 *
 * Selection clears (`selectedBlockId = null`) so the inspector falls
 * back to the document-level "no block selected" view; that's where
 * the user came from to apply a template, and it avoids dangling
 * selection ids that no longer exist after the document swap.
 */
export function applyTemplateDocument(saved: TSavedComponentBlock[]): boolean {
  if (saved.length === 0) return false;
  const firstEntry = saved[0];
  if (!firstEntry || (firstEntry.block as TEditorBlock).type !== 'EmailLayout') {
    return false;
  }

  // Build a fresh id map, but force the first entry to `root`.
  const idMap = new Map<string, string>();
  idMap.set(firstEntry.id, 'root');
  for (const entry of saved.slice(1)) {
    if (typeof entry.id === 'string' && !idMap.has(entry.id)) {
      idMap.set(entry.id, generateNewBlockId());
    }
  }
  const remap = (oldId: string): string | null => idMap.get(oldId) ?? null;

  const nextDocument: TValue['document'] = {};
  for (const entry of saved) {
    const newId = idMap.get(entry.id);
    if (!newId) continue;
    const cloned = JSON.parse(JSON.stringify(entry.block)) as TEditorBlock;

    // Rewrite top-level `data.childrenIds` (used by EmailLayout) AND
    // `data.props.childrenIds` / `data.props.columns[].childrenIds`
    // (used by Container / ColumnsContainer).
    const data = (cloned as { data?: Record<string, unknown> }).data;
    if (data && typeof data === 'object') {
      const dataObj = data as Record<string, unknown>;
      if (Array.isArray(dataObj.childrenIds)) {
        dataObj.childrenIds = (dataObj.childrenIds as string[])
          .map((id) => remap(id))
          .filter((v): v is string => typeof v === 'string');
      }
      const props = dataObj.props;
      if (props && typeof props === 'object') {
        const propsObj = props as Record<string, unknown>;
        if (Array.isArray(propsObj.childrenIds)) {
          propsObj.childrenIds = (propsObj.childrenIds as string[])
            .map((id) => remap(id))
            .filter((v): v is string => typeof v === 'string');
        }
        if (Array.isArray(propsObj.columns)) {
          propsObj.columns = (propsObj.columns as Array<Record<string, unknown>>).map((col) => {
            const childIds = Array.isArray(col.childrenIds) ? (col.childrenIds as string[]) : [];
            return {
              ...col,
              childrenIds: childIds
                .map((id) => remap(id))
                .filter((v): v is string => typeof v === 'string'),
            };
          });
        }
      }
    }
    nextDocument[newId] = cloned;
  }

  // Bail out if the renumbering produced an empty document or lost
  // the root anchor — defensive; should never trigger in practice.
  if (!nextDocument.root || (nextDocument.root as TEditorBlock).type !== 'EmailLayout') {
    return false;
  }

  const original = editorStateStore.getState().document;
  pushSnapshot(original);
  // Normalize legacy block types (e.g. CustomEditor → NotionText). The
  // Reader migrates on the fly for previews, but the editor dictionary
  // only knows the current types, so the canvas needs them persisted.
  const migratedDocument = migrateDocument(nextDocument);
  startTransition(() => {
    editorStateStore.setState({ document: migratedDocument, selectedBlockId: null });
  });
  triggerAutoSave();
  return true;
}

export function useDisableUpdate() {
  return editorStateStore.getState().disableUpdate;
}

export function setMinHeight(minHeight: number) {
  return editorStateStore.setState({ minHeight: `${minHeight}px` });
}

export function getMinHeight() {
  return editorStateStore.getState().minHeight;
}

export function setColor(color: TValue['color']) {
  return editorStateStore.setState({ color });
}

export function getColor() {
  return editorStateStore.getState().color;
}
export function setGalleryImages(galleryImages: boolean) {
  return editorStateStore.setState({ galleryImages });
}
export function getGalleryImages() {
  return editorStateStore.getState().galleryImages;
}

export function setImagePlaceholder(imagePlaceholder?: string) {
  return editorStateStore.setState({ imagePlaceholder });
}
export function getImagePlaceholder() {
  return editorStateStore.getState().imagePlaceholder;
}

export function setImageUrlInput(imageUrlInput: boolean) {
  return editorStateStore.setState({ imageUrlInput });
}
export function getImageUrlInput() {
  return editorStateStore.getState().imageUrlInput;
}
export function useImageUrlInput() {
  return editorStateStore((s) => s.imageUrlInput);
}

export function setImageUploadInput(imageUploadInput: boolean) {
  return editorStateStore.setState({ imageUploadInput });
}
export function getImageUploadInput() {
  return editorStateStore.getState().imageUploadInput;
}
export function useImageUploadInput() {
  return editorStateStore((s) => s.imageUploadInput);
}

export function setBackgroundUrlInput(backgroundUrlInput: boolean) {
  return editorStateStore.setState({ backgroundUrlInput });
}
export function getBackgroundUrlInput() {
  return editorStateStore.getState().backgroundUrlInput;
}
export function useBackgroundUrlInput() {
  return editorStateStore((s) => s.backgroundUrlInput);
}

export function setBackgroundUploadInput(backgroundUploadInput: boolean) {
  return editorStateStore.setState({ backgroundUploadInput });
}
export function getBackgroundUploadInput() {
  return editorStateStore.getState().backgroundUploadInput;
}
export function useBackgroundUploadInput() {
  return editorStateStore((s) => s.backgroundUploadInput);
}

export function setDarkMode(darkMode: boolean) {
  return editorStateStore.setState({ darkMode });
}
export function getDarkMode() {
  return editorStateStore.getState().darkMode;
}

export function useStickyHeader() {
  return editorStateStore.getState().stickyHeader;
}

export function setStickyHeader(state: boolean) {
  return editorStateStore.setState({ stickyHeader: state });
}

export function useHeightContent() {
  return editorStateStore.getState().heightContent;
}

export function setHeightContent(state: string) {
  return editorStateStore.setState({ heightContent: state });
}

export function setContainerGrow(state: boolean) {
  return editorStateStore.setState({ containerGrow: state });
}

export function useContainerGrow() {
  return editorStateStore.getState().containerGrow;
}

export function setShowVersion(state: boolean) {
  return editorStateStore.setState({ showVersion: state });
}

export function useShowVersion() {
  return editorStateStore((s) => s.showVersion);
}

export function changeBlockPosition(
  actualId: string,
  draggedId: string,
  position: string,
  appendBlock: boolean = true,
) {
  if (
    isChildOf({
      draggedId: draggedId,
      targetId: actualId,
    })
  ) {
    console.warn('No se puede mover un elemento dentro de uno de sus propios hijos');
  }
  const document = editorStateStore.getState().document;

  const nDocument = JSON.parse(JSON.stringify({ ...document }));
  const removeChildren = (childrenIds: string[]) => {
    if (!childrenIds || actualId === draggedId) return childrenIds;
    const draggedIdIndex = childrenIds.indexOf(draggedId);
    if (draggedIdIndex < 0) return childrenIds;
    const newPositionChildrenIds = childrenIds.toSpliced(draggedIdIndex, 1);
    return newPositionChildrenIds;
  };

  const addChildren = (childrenIds: string[]) => {
    if (!childrenIds || actualId === draggedId) return childrenIds;
    const actualIdIndex = childrenIds.indexOf(actualId);
    if (actualIdIndex < 0) return childrenIds;

    const insertIndex = position === 'up' ? actualIdIndex : actualIdIndex + 1;

    const newPositionChildrenIds = childrenIds.toSpliced(insertIndex, 0, draggedId);
    return newPositionChildrenIds;
  };

  let toId: string | null;
  let fromId: string | null = null;

  for (const [id, b] of Object.entries(nDocument)) {
    const block = b as any;
    if (fromId) break;
    switch (block.type) {
      case 'EmailLayout':
        if (block.data.childrenIds?.length && block.data.childrenIds.includes(draggedId)) {
          fromId = id;
          nDocument[id] = {
            ...block,
            data: {
              ...block.data,
              childrenIds: removeChildren(block.data.childrenIds),
            },
          };
        }
        break;
      case 'Container':
        if (
          block.data.props?.childrenIds?.length &&
          block.data.props.childrenIds.includes(draggedId)
        ) {
          fromId = id;
          nDocument[id] = {
            ...block,
            data: {
              ...block.data,
              props: {
                ...block.data.props,
                childrenIds: removeChildren(block.data.props.childrenIds),
              },
            },
          };
        }
        break;
      case 'ColumnsContainer':
        if (block.data.props?.columns) {
          let foundInColumns = false;

          const updatedColumns = block.data.props.columns.map((c: any, index: number) => {
            if (c?.childrenIds?.includes(draggedId)) {
              fromId = `${id}-column-${index}`;
              foundInColumns = true;
              return {
                ...c,
                childrenIds: removeChildren(c.childrenIds),
              };
            }
            return c;
          });

          if (foundInColumns) {
            nDocument[id] = {
              ...block,
              data: {
                ...block.data,
                props: {
                  ...block.data.props,
                  columns: updatedColumns,
                },
              },
            };
          }
        }
        break;
      default:
        break;
    }
  }

  toId = null;
  if (appendBlock) {
    for (const [id, b] of Object.entries(nDocument)) {
      const block = b as any;
      if (toId) break;

      switch (block.type) {
        case 'EmailLayout':
          if (block.data.childrenIds?.length && block.data.childrenIds.includes(actualId)) {
            toId = id;
            nDocument[id] = {
              ...block,
              data: {
                ...block.data,
                childrenIds: addChildren(block.data.childrenIds),
              },
            };
          }
          break;
        case 'Container':
          if (
            block.data.props?.childrenIds?.length &&
            block.data.props.childrenIds.includes(actualId)
          ) {
            toId = id;
            nDocument[id] = {
              ...block,
              data: {
                ...block.data,
                props: {
                  ...block.data.props,
                  childrenIds: addChildren(block.data.props.childrenIds),
                },
              },
            };
          }
          break;
        case 'ColumnsContainer':
          if (block.data.props?.columns) {
            const treeColumnSlot = parseComponentTreeColumnSlotId(actualId);
            if (treeColumnSlot && treeColumnSlot.parentBlockId === id) {
              toId = id;
              const { columnIndex } = treeColumnSlot;
              const updatedColumns = block.data.props.columns.map((c: any, idx: number) => {
                if (idx !== columnIndex) return c;
                const ids = [...(c?.childrenIds || [])];
                const insertAt = position === 'up' ? 0 : ids.length;
                return { ...c, childrenIds: ids.toSpliced(insertAt, 0, draggedId) };
              });
              nDocument[id] = {
                ...block,
                data: {
                  ...block.data,
                  props: {
                    ...block.data.props,
                    columns: updatedColumns,
                  },
                },
              };
              break;
            }

            const updatedColumns = block.data.props.columns.map((c: any, index: number) => {
              if (c?.childrenIds?.includes(actualId)) {
                toId = `${id}-column-${index}`;

                return {
                  ...c,
                  childrenIds: addChildren(c.childrenIds),
                };
              }
              return c;
            });

            nDocument[id] = {
              ...block,
              data: {
                ...block.data,
                props: {
                  ...block.data.props,
                  columns: updatedColumns,
                },
              },
            };
          }
          break;
        default:
          break;
      }
    }
  }

  return setDocument(nDocument);
}

export function insertNewChildInColumn({
  parentId,
  blockId,
  indexArray,
}: {
  parentId: string;
  blockId: string;
  indexArray?: number;
}) {
  if (
    isChildOf({
      draggedId: blockId,
      targetId: parentId,
    })
  ) {
    console.warn('No se puede mover un elemento dentro de uno de sus propios hijos');
    return;
  }
  return withUndoTransaction(() => {
    changeBlockPosition('', blockId, 'down', false);
    const document = editorStateStore.getState().document;
    const nDocument = JSON.parse(JSON.stringify({ ...document }));

    if (!nDocument[parentId]) return;
    const block = nDocument[parentId] as any;

    const newChildrenIds = [...(block.data.props.columns || [])];

    newChildrenIds[indexArray || 0] = {
      childrenIds: [blockId],
    };

    nDocument[parentId] = {
      type: 'ColumnsContainer',
      data: {
        ...block.data,
        props: {
          ...block.data.props,
          columns: newChildrenIds,
        },
      },
    };
    return setDocument(nDocument);
  });
}

export function insertNewChildInContainer({
  parentId,
  blockId,
}: {
  parentId: string;
  blockId: string;
}) {
  if (
    isChildOf({
      draggedId: blockId,
      targetId: parentId,
    })
  ) {
    console.warn('No se puede mover un elemento dentro de uno de sus propios hijos');
    return;
  }

  return withUndoTransaction(() => {
    changeBlockPosition('', blockId, 'down', false);
    const document = editorStateStore.getState().document;
    const nDocument = JSON.parse(JSON.stringify({ ...document }));

    if (!nDocument[parentId]) return;

    const block = nDocument[parentId] as any;
    nDocument[parentId] = {
      type: 'Container',
      data: {
        ...block.data,
        props: {
          ...block.data.props,
          childrenIds: [blockId],
        },
      },
    };
    return setDocument(nDocument);
  });
}

export function isChildOf({
  draggedId,
  targetId,
}: {
  draggedId: string;
  targetId: string;
}): boolean {
  if (draggedId === targetId) return true;

  const columnSlot = parseComponentTreeColumnSlotId(targetId);
  const resolvedTargetId = columnSlot ? columnSlot.parentBlockId : targetId;
  if (draggedId === resolvedTargetId) return true;

  const document = editorStateStore.getState().document;

  function checkIfChildRecursively(parentId: string, searchTargetId: string): boolean {
    const block = document[parentId] as any;

    if (!block) return false;

    let childrenIds: string[] = [];

    switch (block.type) {
      case 'EmailLayout':
        childrenIds = block.data.childrenIds || [];
        break;
      case 'Container':
        childrenIds = block.data.props?.childrenIds || [];
        break;
      case 'ColumnsContainer':
        if (block.data.props?.columns) {
          block.data.props.columns.forEach((column: any) => {
            if (column?.childrenIds) {
              childrenIds = [...childrenIds, ...column.childrenIds];
            }
          });
        }
        break;
    }

    if (childrenIds.includes(searchTargetId)) {
      return true;
    }

    for (const childId of childrenIds) {
      if (checkIfChildRecursively(childId, searchTargetId)) {
        return true;
      }
    }

    return false;
  }

  return checkIfChildRecursively(draggedId, resolvedTargetId);
}

// Add new functions to manage color picker state
export function useColorPickerState() {
  return editorStateStore((s) => s.colorPicker);
}

export function setColorPickerState(state: Partial<TValue['colorPicker']>) {
  editorStateStore.setState((s) => ({
    colorPicker: {
      ...s.colorPicker,
      ...state,
    },
  }));
}

/**
 * Actualiza un bloque específico sin tocar el resto del documento.
 * pushSnapshot síncrono ANTES del setState. Sin microtasks, sin race conditions.
 */
export function updateBlock(blockId: string, updater: (block: any) => any) {
  if (isPerformingUndoRedo) return;
  const currentDocument = editorStateStore.getState().document;
  const currentBlock = currentDocument[blockId];

  if (!currentBlock) {
    console.warn(`Block ${blockId} not found`);
    return;
  }

  const updatedBlock = updater(currentBlock);

  if (currentBlock === updatedBlock) return;

  const updatedDocument = {
    ...currentDocument,
    [blockId]: updatedBlock,
  };

  pushSnapshot(currentDocument, blockId);

  startTransition(() => {
    editorStateStore.setState({ document: updatedDocument });
  });

  triggerAutoSave();
}

/**
 * Actualiza un bloque de forma síncrona (sin startTransition).
 * Usar cuando el store debe reflejar el cambio de inmediato (ej. persistir WYSIWYG
 * al salir de edición inline, para que el panel lateral no muestre datos desactualizados).
 */
export function updateBlockSync(blockId: string, updater: (block: any) => any) {
  if (isPerformingUndoRedo) return;
  const currentDocument = editorStateStore.getState().document;
  const currentBlock = currentDocument[blockId];

  if (!currentBlock) {
    console.warn(`Block ${blockId} not found`);
    return;
  }

  const updatedBlock = updater(currentBlock);
  if (currentBlock === updatedBlock) return;

  const updatedDocument = {
    ...currentDocument,
    [blockId]: updatedBlock,
  };

  pushSnapshot(currentDocument, blockId);

  editorStateStore.setState({ document: updatedDocument });
  triggerAutoSave();
}

/**
 * Actualiza las props de un bloque específico
 */
export function updateBlockProps(blockId: string, newProps: object | ((props: any) => any)) {
  updateBlock(blockId, (block) => {
    const updatedProps =
      typeof newProps === 'function'
        ? newProps(block.data.props)
        : { ...block.data.props, ...newProps };

    return {
      ...block,
      data: {
        ...block.data,
        props: updatedProps,
      },
    };
  });
}

/**
 * Actualiza las props de un bloque de forma síncrona.
 * Usar al persistir contenido WYSIWYG inline para que el panel lateral
 * y el canvas vean el mismo valor de inmediato.
 */
export function updateBlockPropsSync(blockId: string, newProps: object | ((props: any) => any)) {
  updateBlockSync(blockId, (block) => {
    const updatedProps =
      typeof newProps === 'function'
        ? newProps(block.data.props)
        : { ...block.data.props, ...newProps };

    return {
      ...block,
      data: {
        ...block.data,
        props: updatedProps,
      },
    };
  });
}

/**
 * Actualiza un campo específico de las props de un bloque
 */
export function updateBlockProp(blockId: string, propName: string, value: any) {
  updateBlock(blockId, (block) => ({
    ...block,
    data: {
      ...block.data,
      props: {
        ...block.data.props,
        [propName]: value,
      },
    },
  }));
}

/**
 * Añade un nuevo bloque hijo y actualiza childrenIds del padre en una sola actualización.
 * Usado por EmailLayout y Container para evitar useDocument() en onChange.
 */
export function insertChildAndUpdateParent(
  parentBlockId: string,
  newBlockId: string,
  newBlock: TEditorBlock,
  newChildrenIds: string[],
) {
  const originalDocument = editorStateStore.getState().document;
  const parent = originalDocument[parentBlockId] as any;
  if (!parent) return;
  const updatedParent =
    parent.type === 'EmailLayout'
      ? { ...parent, data: { ...parent.data, childrenIds: newChildrenIds } }
      : {
          ...parent,
          data: {
            ...parent.data,
            props: { ...parent.data?.props, childrenIds: newChildrenIds },
          },
        };
  const newDocument = {
    ...originalDocument,
    [newBlockId]: newBlock,
    [parentBlockId]: updatedParent,
  };

  // Snapshot síncrono ANTES del setState
  pushSnapshot(originalDocument);

  startTransition(() => {
    editorStateStore.setState({ document: newDocument });
  });
  triggerAutoSave();
}

/**
 * Añade un bloque y actualiza childrenIds de una columna en ColumnsContainer en una sola actualización.
 */
export function updateColumnAndAddBlock(
  parentBlockId: string,
  columnIndex: number,
  newBlockId: string,
  newBlock: TEditorBlock,
  newChildrenIds: string[],
) {
  const originalDocument = editorStateStore.getState().document;
  const parent = originalDocument[parentBlockId] as any;
  if (!parent?.data?.props?.columns) return;
  const columns = [...(parent.data.props.columns || [])];
  const column = columns[columnIndex];
  if (!column) return;
  columns[columnIndex] = { ...column, childrenIds: newChildrenIds };
  const updatedParent = {
    ...parent,
    data: {
      ...parent.data,
      props: {
        ...parent.data.props,
        columns,
      },
    },
  };
  const newDocument = {
    ...originalDocument,
    [newBlockId]: newBlock,
    [parentBlockId]: updatedParent,
  };

  // Snapshot síncrono ANTES del setState
  pushSnapshot(originalDocument);

  startTransition(() => {
    editorStateStore.setState({ document: newDocument });
  });
  triggerAutoSave();
}

function generateNewBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
}

function cloneChildrenBlocksForDuplicate(
  nDocument: Record<string, TEditorBlock>,
  childrenIds: string[],
): string[] {
  const newChildrenIds: string[] = [];

  for (const childId of childrenIds) {
    const childBlock = { ...nDocument[childId] } as TEditorBlock;
    const newChildId = generateNewBlockId();

    nDocument[newChildId] = {
      ...childBlock,
      data: {
        ...childBlock.data,
        props: { ...(childBlock.data as { props?: object }).props },
      },
    } as TEditorBlock;

    if (childBlock.type === 'Container' || childBlock.type === 'ColumnsContainer') {
      const grandChildrenIds =
        (childBlock.data as { props?: { childrenIds?: string[] } }).props?.childrenIds || [];
      (nDocument[newChildId].data as { props: Record<string, unknown> }).props.childrenIds =
        cloneChildrenBlocksForDuplicate(nDocument, grandChildrenIds);

      if (childBlock.type === 'ColumnsContainer') {
        const columns =
          (childBlock.data as { props?: { columns?: unknown[] } }).props?.columns || [];
        (nDocument[newChildId].data as { props: Record<string, unknown> }).props.columns =
          cloneColumnsForDuplicate(nDocument, columns);
      }
    }

    newChildrenIds.push(newChildId);
  }

  return newChildrenIds;
}

function cloneColumnsForDuplicate(nDocument: Record<string, TEditorBlock>, columns: any[]): any[] {
  return columns.map((column) => {
    const newColumn = { ...column };
    const columnChildrenIds = column.childrenIds || [];
    newColumn.childrenIds = cloneChildrenBlocksForDuplicate(nDocument, columnChildrenIds);
    return newColumn;
  });
}

/**
 * Duplica un bloque (incl. hijos de Container/ColumnsContainer) e inserta la copia antes del original en la misma lista padre.
 */
export function duplicateBlock(blockId: string) {
  const document = editorStateStore.getState().document;
  const nDocument = JSON.parse(JSON.stringify({ ...document })) as Record<string, TEditorBlock>;
  const newParentId = generateNewBlockId();
  const parentBlock = nDocument[blockId] as TEditorBlock;

  nDocument[newParentId] = JSON.parse(JSON.stringify(parentBlock));

  if (parentBlock.type === 'Container') {
    const childrenIds =
      (parentBlock.data as { props?: { childrenIds?: string[] } }).props?.childrenIds || [];
    if (childrenIds.length > 0) {
      (nDocument[newParentId].data as { props: { childrenIds: string[] } }).props.childrenIds =
        cloneChildrenBlocksForDuplicate(nDocument, childrenIds);
    }
  } else if (parentBlock.type === 'ColumnsContainer') {
    const columns = (parentBlock.data as { props?: { columns?: any[] } }).props?.columns || [];
    (nDocument[newParentId].data as { props: { columns: any[] } }).props.columns =
      cloneColumnsForDuplicate(nDocument, columns);
  }

  const rootBlk = nDocument.root;
  const rootChildren = rootBlk?.type === 'EmailLayout' ? (rootBlk.data.childrenIds ?? []) : [];
  const originalBlockIndexInRoot = rootChildren.findIndex((child: string) => child === blockId);

  if (rootBlk?.type === 'EmailLayout' && originalBlockIndexInRoot >= 0) {
    const nextRootChildren = [...rootChildren];
    nextRootChildren.splice(originalBlockIndexInRoot, 0, newParentId);
    rootBlk.data.childrenIds = nextRootChildren;
  } else {
    for (const [, b] of Object.entries(nDocument) as [string, TEditorBlock][]) {
      if (b.type === 'Container') {
        const list = b.data.props?.childrenIds;
        const originalBlockIndex = list?.findIndex((child: string) => child === blockId) ?? -1;
        if (originalBlockIndex >= 0 && list) {
          const next = [...list];
          next.splice(originalBlockIndex, 0, newParentId);
          b.data.props!.childrenIds = next;
          break;
        }
      }
      if (b.type === 'ColumnsContainer') {
        b.data.props?.columns?.forEach((column: { childrenIds: string[] }) => {
          const originalBlockIndex = column.childrenIds.findIndex(
            (child: string) => child === blockId,
          );
          if (originalBlockIndex >= 0) {
            column.childrenIds.splice(originalBlockIndex, 0, newParentId);
          }
        });
      }
    }
  }

  setDocument(nDocument as TValue['document']);
  setSelectedBlockId(newParentId);
}

// ============================================================================
// Components Library — saved component subtree insertion
// ============================================================================
//
// A saved component is an array of `{ id, block }` entries served by
// `GET /dev/sections/:role/:id`. The IDs used inside that NDJSON file
// (e.g. `component-{slug}-1`) are deterministic on disk so the AI splice
// machinery can reference them, but they MUST be remapped to fresh runtime
// IDs before being inserted into a live document — otherwise we collide
// with existing blocks (and saved-twice components would clash with each
// other).
//
// `buildRenamedSubtreeFromSaved` walks the array once: assigns a fresh id
// per entry, deep-clones each block, and rewrites `props.childrenIds` and
// `props.columns[].childrenIds` to point at the new ids. Unknown id refs
// (referenced but not present in the saved array) are dropped — same
// policy as the backend's `renumberBlocks` to keep the subtree internally
// consistent.

export type TSavedComponentBlock = { id: string; block: TEditorBlock };

function buildRenamedSubtreeFromSaved(saved: TSavedComponentBlock[]): {
  rootId: string | null;
  subtree: Record<string, TEditorBlock>;
} {
  if (saved.length === 0) return { rootId: null, subtree: {} };

  const idMap = new Map<string, string>();
  for (const entry of saved) {
    if (typeof entry.id === 'string' && !idMap.has(entry.id)) {
      idMap.set(entry.id, generateNewBlockId());
    }
  }
  const remap = (oldId: string): string | null => idMap.get(oldId) ?? null;

  const subtree: Record<string, TEditorBlock> = {};
  for (const entry of saved) {
    const newId = idMap.get(entry.id);
    if (!newId) continue;
    const cloned = JSON.parse(JSON.stringify(entry.block)) as TEditorBlock;
    const data = (cloned as { data?: Record<string, unknown> }).data;
    if (data && typeof data === 'object') {
      const props = (data as { props?: Record<string, unknown> }).props;
      if (props && typeof props === 'object') {
        const propsObj = props as Record<string, unknown>;
        if (Array.isArray(propsObj.childrenIds)) {
          propsObj.childrenIds = (propsObj.childrenIds as string[])
            .map((id) => remap(id))
            .filter((v): v is string => typeof v === 'string');
        }
        if (Array.isArray(propsObj.columns)) {
          propsObj.columns = (propsObj.columns as Array<Record<string, unknown>>).map((col) => {
            const childIds = Array.isArray(col.childrenIds) ? (col.childrenIds as string[]) : [];
            return {
              ...col,
              childrenIds: childIds
                .map((id) => remap(id))
                .filter((v): v is string => typeof v === 'string'),
            };
          });
        }
      }
    }
    // Insert the pre-made block VERBATIM — as created, with its own
    // colours and styling. The destination document's theme is
    // intentionally NOT applied here (requirement: library blocks keep
    // the exact look they were saved with when inserted, matching their
    // card thumbnail and hover preview). `childrenIds` / `columns`
    // rewritten above are preserved.
    subtree[newId] = cloned;
  }

  return { rootId: idMap.get(saved[0].id) ?? null, subtree };
}

type LocateResult =
  | { kind: 'root'; siblings: string[]; idx: number }
  | { kind: 'container'; parentId: string; siblings: string[]; idx: number }
  | { kind: 'column'; parentId: string; columnIndex: number; siblings: string[]; idx: number }
  | null;

function locateSibling(document: TValue['document'], siblingBlockId: string): LocateResult {
  const rootBlk = document.root;
  if (rootBlk?.type === 'EmailLayout') {
    const rootChildren = rootBlk.data.childrenIds ?? [];
    const idx = rootChildren.indexOf(siblingBlockId);
    if (idx >= 0) return { kind: 'root', siblings: rootChildren, idx };
  }
  for (const [id, b] of Object.entries(document)) {
    const block = b as TEditorBlock;
    if (block.type === 'Container') {
      const children = block.data.props?.childrenIds ?? [];
      const idx = children.indexOf(siblingBlockId);
      if (idx >= 0) return { kind: 'container', parentId: id, siblings: children, idx };
    }
    if (block.type === 'ColumnsContainer') {
      const columns = block.data.props?.columns ?? [];
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const col = columns[colIdx] as { childrenIds?: string[] };
        const colChildren = col.childrenIds ?? [];
        const idx = colChildren.indexOf(siblingBlockId);
        if (idx >= 0) {
          return { kind: 'column', parentId: id, columnIndex: colIdx, siblings: colChildren, idx };
        }
      }
    }
  }
  return null;
}

function commitInsertSavedComponent(
  original: TValue['document'],
  subtree: Record<string, TEditorBlock>,
  parentUpdate: { id: string; nextBlock: TEditorBlock },
  rootId: string,
): string {
  const newDocument: TValue['document'] = {
    ...original,
    ...subtree,
    [parentUpdate.id]: parentUpdate.nextBlock as TValue['document'][string],
  };

  pushSnapshot(original);

  startTransition(() => {
    editorStateStore.setState({ document: newDocument });
  });
  triggerAutoSave();
  setSelectedBlockId(rootId);
  return rootId;
}

/**
 * Insert a saved component subtree right after the given sibling. Returns
 * the new root id of the inserted subtree, or null if the sibling could
 * not be located (or the saved array was empty).
 */
export function insertSavedComponentAfterSibling(
  siblingBlockId: string,
  saved: TSavedComponentBlock[],
): string | null {
  const { rootId, subtree } = buildRenamedSubtreeFromSaved(saved);
  if (!rootId) return null;

  const original = editorStateStore.getState().document;
  const located = locateSibling(original, siblingBlockId);
  if (!located) return null;

  const nextSiblings = [...located.siblings];
  nextSiblings.splice(located.idx + 1, 0, rootId);

  if (located.kind === 'root') {
    const parent = original.root;
    if (!parent || parent.type !== 'EmailLayout') return null;
    const nextBlock = {
      ...parent,
      data: { ...parent.data, childrenIds: nextSiblings },
    } as TEditorBlock;
    return commitInsertSavedComponent(original, subtree, { id: 'root', nextBlock }, rootId);
  }

  if (located.kind === 'container') {
    const parent = original[located.parentId];
    if (!parent || parent.type !== 'Container') return null;
    const nextBlock = {
      ...parent,
      data: { ...parent.data, props: { ...parent.data.props, childrenIds: nextSiblings } },
    } as TEditorBlock;
    return commitInsertSavedComponent(
      original,
      subtree,
      { id: located.parentId, nextBlock },
      rootId,
    );
  }

  // column
  const parent = original[located.parentId];
  if (!parent || parent.type !== 'ColumnsContainer') return null;
  const cols = (parent.data.props?.columns ?? []) as Array<Record<string, unknown>>;
  const nextCols = cols.map((c, i) =>
    i === located.columnIndex ? { ...c, childrenIds: nextSiblings } : c,
  );
  const nextBlock = {
    ...parent,
    data: { ...parent.data, props: { ...parent.data.props, columns: nextCols } },
  } as TEditorBlock;
  return commitInsertSavedComponent(original, subtree, { id: located.parentId, nextBlock }, rootId);
}

/**
 * Insert a saved component subtree right before the given sibling.
 * Mirrors {@link insertSavedComponentAfterSibling} but uses the sibling's
 * own index as the insertion point.
 */
export function insertSavedComponentBeforeSibling(
  siblingBlockId: string,
  saved: TSavedComponentBlock[],
): string | null {
  const { rootId, subtree } = buildRenamedSubtreeFromSaved(saved);
  if (!rootId) return null;

  const original = editorStateStore.getState().document;
  const located = locateSibling(original, siblingBlockId);
  if (!located) return null;

  const nextSiblings = [...located.siblings];
  nextSiblings.splice(located.idx, 0, rootId);

  if (located.kind === 'root') {
    const parent = original.root;
    if (!parent || parent.type !== 'EmailLayout') return null;
    const nextBlock = {
      ...parent,
      data: { ...parent.data, childrenIds: nextSiblings },
    } as TEditorBlock;
    return commitInsertSavedComponent(original, subtree, { id: 'root', nextBlock }, rootId);
  }

  if (located.kind === 'container') {
    const parent = original[located.parentId];
    if (!parent || parent.type !== 'Container') return null;
    const nextBlock = {
      ...parent,
      data: { ...parent.data, props: { ...parent.data.props, childrenIds: nextSiblings } },
    } as TEditorBlock;
    return commitInsertSavedComponent(
      original,
      subtree,
      { id: located.parentId, nextBlock },
      rootId,
    );
  }

  // column
  const parent = original[located.parentId];
  if (!parent || parent.type !== 'ColumnsContainer') return null;
  const cols = (parent.data.props?.columns ?? []) as Array<Record<string, unknown>>;
  const nextCols = cols.map((c, i) =>
    i === located.columnIndex ? { ...c, childrenIds: nextSiblings } : c,
  );
  const nextBlock = {
    ...parent,
    data: { ...parent.data, props: { ...parent.data.props, columns: nextCols } },
  } as TEditorBlock;
  return commitInsertSavedComponent(original, subtree, { id: located.parentId, nextBlock }, rootId);
}

/**
 * Append a saved component subtree to the end of a parent's children list.
 *
 * - When `parentId === 'root'` (EmailLayout) the root is `parent.data.childrenIds`.
 * - When the parent is a Container the root is `parent.data.props.childrenIds`.
 * - When the parent is a ColumnsContainer pass `columnIndex` to choose
 *   which column receives the new subtree; without it nothing is inserted.
 *
 * Returns the new root id, or null if the parent does not exist / is the
 * wrong type / saved array is empty.
 */
export function appendSavedComponentToParent(
  parentId: string,
  saved: TSavedComponentBlock[],
  columnIndex?: number,
): string | null {
  const { rootId, subtree } = buildRenamedSubtreeFromSaved(saved);
  if (!rootId) return null;

  const original = editorStateStore.getState().document;
  const parent = original[parentId];
  if (!parent) return null;

  if (parent.type === 'EmailLayout') {
    const children = parent.data.childrenIds ?? [];
    const nextChildren = [...children, rootId];
    const nextBlock = {
      ...parent,
      data: { ...parent.data, childrenIds: nextChildren },
    } as TEditorBlock;
    return commitInsertSavedComponent(original, subtree, { id: parentId, nextBlock }, rootId);
  }

  if (parent.type === 'Container') {
    const children = parent.data.props?.childrenIds ?? [];
    const nextChildren = [...children, rootId];
    const nextBlock = {
      ...parent,
      data: { ...parent.data, props: { ...parent.data.props, childrenIds: nextChildren } },
    } as TEditorBlock;
    return commitInsertSavedComponent(original, subtree, { id: parentId, nextBlock }, rootId);
  }

  if (parent.type === 'ColumnsContainer') {
    if (typeof columnIndex !== 'number') return null;
    const cols = (parent.data.props?.columns ?? []) as Array<Record<string, unknown>>;
    if (columnIndex < 0 || columnIndex >= cols.length) return null;
    const nextCols = cols.map((c, i) => {
      if (i !== columnIndex) return c;
      const colChildren = Array.isArray(c.childrenIds) ? (c.childrenIds as string[]) : [];
      return { ...c, childrenIds: [...colChildren, rootId] };
    });
    const nextBlock = {
      ...parent,
      data: { ...parent.data, props: { ...parent.data.props, columns: nextCols } },
    } as TEditorBlock;
    return commitInsertSavedComponent(original, subtree, { id: parentId, nextBlock }, rootId);
  }

  return null;
}

/**
 * Wrap a freshly-instantiated built-in block (from `BUTTONS[i].block()`
 * in `App/ComponentsLibrary/builtInBlocks.tsx`) as a one-node
 * `TSavedComponentBlock[]` so it can flow through the same
 * renumber/commit pipeline as saved-component subtrees. The temporary
 * id is discarded — `buildRenamedSubtreeFromSaved` (used internally by
 * every `insertSavedComponent*` / `appendSavedComponentToParent` call)
 * always mints a fresh id via `generateNewBlockId`.
 */
function wrapBuiltInBlock(block: TEditorBlock): TSavedComponentBlock[] {
  return [{ id: generateNewBlockId(), block }];
}

/**
 * Insert a fresh built-in block (Text, Button, Image, …) right after
 * the given sibling. Thin wrapper around
 * {@link insertSavedComponentAfterSibling} — see that function for the
 * insertion semantics. Returns the new block's id, or null if the
 * sibling could not be located.
 */
export function insertBuiltInBlockAfterSibling(
  siblingBlockId: string,
  block: TEditorBlock,
): string | null {
  return insertSavedComponentAfterSibling(siblingBlockId, wrapBuiltInBlock(block));
}

/**
 * Insert a fresh built-in block right before the given sibling. Thin
 * wrapper around {@link insertSavedComponentBeforeSibling}.
 */
export function insertBuiltInBlockBeforeSibling(
  siblingBlockId: string,
  block: TEditorBlock,
): string | null {
  return insertSavedComponentBeforeSibling(siblingBlockId, wrapBuiltInBlock(block));
}

/**
 * Append a fresh built-in block to the end of a parent's children list
 * (root, Container, or a ColumnsContainer column via `columnIndex`).
 * Thin wrapper around {@link appendSavedComponentToParent} — used for
 * click-to-insert from the Blocks tab (empty canvas → root, or "insert
 * at end" convenience) and empty-canvas drops.
 */
export function appendBuiltInBlockToParent(
  parentId: string,
  block: TEditorBlock,
  columnIndex?: number,
): string | null {
  return appendSavedComponentToParent(parentId, wrapBuiltInBlock(block), columnIndex);
}

/**
 * Inserta un bloque nuevo justo después del bloque indicado (mismo padre: EmailLayout, Container o celda de columnas).
 */
export function insertBlockAfterSibling(
  siblingBlockId: string,
  newBlock: TEditorBlock,
): string | null {
  const newBlockId = generateNewBlockId();
  const document = editorStateStore.getState().document;

  const rootBlk = document.root;
  const rootChildren = rootBlk?.type === 'EmailLayout' ? (rootBlk.data.childrenIds ?? []) : [];
  const idxInRoot = rootChildren.indexOf(siblingBlockId);
  if (rootBlk?.type === 'EmailLayout' && idxInRoot >= 0) {
    const next = [...rootChildren];
    next.splice(idxInRoot + 1, 0, newBlockId);
    insertChildAndUpdateParent('root', newBlockId, newBlock, next);
    return newBlockId;
  }

  for (const [id, b] of Object.entries(document)) {
    const block = b as TEditorBlock;
    if (block.type === 'Container') {
      const children = block.data.props?.childrenIds ?? [];
      const idx = children.indexOf(siblingBlockId);
      if (idx >= 0) {
        const next = [...children];
        next.splice(idx + 1, 0, newBlockId);
        insertChildAndUpdateParent(id, newBlockId, newBlock, next);
        return newBlockId;
      }
    }
    if (block.type === 'ColumnsContainer') {
      const columns = block.data.props?.columns ?? [];
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const col = columns[colIdx] as { childrenIds?: string[] };
        const colChildren = col.childrenIds ?? [];
        const idx = colChildren.indexOf(siblingBlockId);
        if (idx >= 0) {
          const next = [...colChildren];
          next.splice(idx + 1, 0, newBlockId);
          updateColumnAndAddBlock(id, colIdx, newBlockId, newBlock, next);
          return newBlockId;
        }
      }
    }
  }

  return null;
}

/**
 * Inserta un bloque nuevo justo antes del bloque indicado (mismo padre: EmailLayout, Container o celda de columnas).
 */
export function insertBlockBeforeSibling(
  siblingBlockId: string,
  newBlock: TEditorBlock,
): string | null {
  const newBlockId = generateNewBlockId();
  const document = editorStateStore.getState().document;

  const rootBlk = document.root;
  const rootChildren = rootBlk?.type === 'EmailLayout' ? (rootBlk.data.childrenIds ?? []) : [];
  const idxInRoot = rootChildren.indexOf(siblingBlockId);
  if (rootBlk?.type === 'EmailLayout' && idxInRoot >= 0) {
    const next = [...rootChildren];
    next.splice(idxInRoot, 0, newBlockId);
    insertChildAndUpdateParent('root', newBlockId, newBlock, next);
    return newBlockId;
  }

  for (const [id, b] of Object.entries(document)) {
    const block = b as TEditorBlock;
    if (block.type === 'Container') {
      const children = block.data.props?.childrenIds ?? [];
      const idx = children.indexOf(siblingBlockId);
      if (idx >= 0) {
        const next = [...children];
        next.splice(idx, 0, newBlockId);
        insertChildAndUpdateParent(id, newBlockId, newBlock, next);
        return newBlockId;
      }
    }
    if (block.type === 'ColumnsContainer') {
      const columns = block.data.props?.columns ?? [];
      for (let colIdx = 0; colIdx < columns.length; colIdx++) {
        const col = columns[colIdx] as { childrenIds?: string[] };
        const colChildren = col.childrenIds ?? [];
        const idx = colChildren.indexOf(siblingBlockId);
        if (idx >= 0) {
          const next = [...colChildren];
          next.splice(idx, 0, newBlockId);
          updateColumnAndAddBlock(id, colIdx, newBlockId, newBlock, next);
          return newBlockId;
        }
      }
    }
  }

  return null;
}

/**
 * Aplica varias actualizaciones de bloques al documento en una sola escritura.
 * Para callbacks que construyen el nuevo estado con getState() (ej. ColumnsContainer).
 */
export function applyBlockUpdates(updates: Record<string, TEditorBlock>) {
  const originalDocument = editorStateStore.getState().document;
  const newDocument = { ...originalDocument, ...updates };

  // Snapshot síncrono ANTES del setState
  pushSnapshot(originalDocument);

  startTransition(() => {
    editorStateStore.setState({ document: newDocument });
  });
  triggerAutoSave();
}
