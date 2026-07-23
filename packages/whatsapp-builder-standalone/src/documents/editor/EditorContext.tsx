import { create } from 'zustand';

import { getEmptyWhatsAppMessage } from '../../getConfiguration';
import {
  SECTION_ORDER,
  type SectionType,
  type TWhatsAppBlock,
  type TWhatsAppConfiguration,
} from '../schemas';

/**
 * Editor state store — mirrors the email builder's `EditorContext`
 * architecture (module-global zustand store + granular hooks + action
 * functions) reduced to WhatsApp's needs: no themes, no columns, no
 * component library storage, a fixed section order instead of free
 * nesting.
 */

export const AUTO_SAVE_EVENT = 'whatsapp-builder-auto-save';
const AUTO_SAVE_DELAY = 2000;
const MAX_HISTORY = 50;

type TValue = {
  document: TWhatsAppConfiguration;
  selectedBlockId: string | null;
  selectedMainTab: 'editor' | 'preview' | 'json';
  inspectorDrawerOpen: boolean;
  paletteOpen: boolean;
  darkMode: boolean;
  businessName: string;
  disableEdition: boolean;
  undoStack: TWhatsAppConfiguration[];
  redoStack: TWhatsAppConfiguration[];
};

const createInitialState = (): TValue => ({
  document: getEmptyWhatsAppMessage(),
  selectedBlockId: null,
  selectedMainTab: 'editor',
  inspectorDrawerOpen: true,
  paletteOpen: true,
  darkMode: false,
  businessName: 'Maildrill',
  disableEdition: false,
  undoStack: [],
  redoStack: [],
});

export const editorStateStore = create<TValue>(() => createInitialState());

// ---------------------------------------------------------------------------
// Autosave — debounce mutations into a window CustomEvent the public
// component listens to (same bridge the email builder uses).
// ---------------------------------------------------------------------------

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

function triggerAutoSave() {
  if (typeof window === 'undefined') return;
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    window.dispatchEvent(
      new CustomEvent(AUTO_SAVE_EVENT, { detail: { document: editorStateStore.getState().document } })
    );
  }, AUTO_SAVE_DELAY);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

export function useDocument() {
  return editorStateStore((s) => s.document);
}

export function useBlock(id: string | null): TWhatsAppBlock | undefined {
  return editorStateStore((s) => (id ? s.document[id] : undefined));
}

export function useSelectedBlockId() {
  return editorStateStore((s) => s.selectedBlockId);
}

export function useSelectedMainTab() {
  return editorStateStore((s) => s.selectedMainTab);
}

export function useInspectorDrawerOpen() {
  return editorStateStore((s) => s.inspectorDrawerOpen);
}

export function usePaletteOpen() {
  return editorStateStore((s) => s.paletteOpen);
}

export function useDarkMode() {
  return editorStateStore((s) => s.darkMode);
}

export function useBusinessName() {
  return editorStateStore((s) => s.businessName);
}

export function useDisableEdition() {
  return editorStateStore((s) => s.disableEdition);
}

export function useCanUndo() {
  return editorStateStore((s) => s.undoStack.length > 0);
}

export function useCanRedo() {
  return editorStateStore((s) => s.redoStack.length > 0);
}

const EMPTY_IDS: string[] = [];

/** Ordered section ids from the root (defensive against a broken root). */
export function useRootChildrenIds(): string[] {
  return editorStateStore((s) => {
    const root = s.document.root;
    // Stable EMPTY_IDS fallback so the selector doesn't return a fresh
    // array identity on every call (zustand re-render loop guard).
    return (root && root.type === 'WhatsAppMessage' ? root.data.childrenIds : undefined) ?? EMPTY_IDS;
  });
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function pushSnapshot(state: TValue): Pick<TValue, 'undoStack' | 'redoStack'> {
  return {
    undoStack: [...state.undoStack.slice(-(MAX_HISTORY - 1)), state.document],
    redoStack: [],
  };
}

export function setSelectedMainTab(tab: TValue['selectedMainTab']) {
  editorStateStore.setState({ selectedMainTab: tab });
}

export function setSelectedBlockId(id: string | null) {
  editorStateStore.setState(id !== null ? { selectedBlockId: id, inspectorDrawerOpen: true } : { selectedBlockId: id });
}

export function toggleInspectorDrawerOpen() {
  editorStateStore.setState((s) => ({ inspectorDrawerOpen: !s.inspectorDrawerOpen }));
}

export function togglePaletteOpen() {
  editorStateStore.setState((s) => ({ paletteOpen: !s.paletteOpen }));
}

export function setDarkMode(darkMode: boolean) {
  editorStateStore.setState({ darkMode });
}

export function setBusinessName(businessName: string) {
  editorStateStore.setState({ businessName });
}

export function setDisableEdition(disableEdition: boolean) {
  editorStateStore.setState({ disableEdition });
}

/** Merge blocks into the document (undoable) and schedule autosave. */
export function setDocument(document: TWhatsAppConfiguration, modified = true) {
  editorStateStore.setState((s) => ({
    document: { ...s.document, ...document },
    ...(modified ? pushSnapshot(s) : {}),
  }));
  if (modified) triggerAutoSave();
}

/** Replace the whole document, clearing history/selection (load path). */
export function resetDocument(document: TWhatsAppConfiguration) {
  editorStateStore.setState({
    document,
    selectedBlockId: null,
    undoStack: [],
    redoStack: [],
  });
}

/** Update one block's data through an updater (undoable). */
export function updateBlockData<T extends TWhatsAppBlock>(id: string, updater: (block: T) => T['data']) {
  const s = editorStateStore.getState();
  const block = s.document[id] as T | undefined;
  if (!block) return;
  const nextData = updater(block);
  editorStateStore.setState({
    document: { ...s.document, [id]: { ...block, data: nextData } as TWhatsAppBlock },
    ...pushSnapshot(s),
  });
  triggerAutoSave();
}

let blockCounter = 0;

export function generateNewBlockId(type: SectionType): string {
  blockCounter += 1;
  return `block-${type.toLowerCase()}-${Date.now()}-${blockCounter}`;
}

/**
 * Add a section of `type` (one instance max — no-op if present),
 * inserted at its canonical position (header → body → footer → buttons).
 * Returns the new block id, or the existing one when already present.
 */
export function addSection(type: SectionType, block: TWhatsAppBlock): string | null {
  const s = editorStateStore.getState();
  const root = s.document.root;
  if (!root || root.type !== 'WhatsAppMessage') return null;

  const currentIds = root.data.childrenIds ?? [];
  const existing = currentIds.find((id) => s.document[id]?.type === type);
  if (existing) return existing;

  const id = generateNewBlockId(type);
  const childrenIds = [...currentIds, id].sort((a, b) => {
    const ta = a === id ? type : (s.document[a]?.type as SectionType);
    const tb = b === id ? type : (s.document[b]?.type as SectionType);
    return (SECTION_ORDER[ta] ?? 99) - (SECTION_ORDER[tb] ?? 99);
  });

  editorStateStore.setState({
    document: {
      ...s.document,
      [id]: block,
      root: { ...root, data: { ...root.data, childrenIds } },
    },
    selectedBlockId: id,
    inspectorDrawerOpen: true,
    ...pushSnapshot(s),
  });
  triggerAutoSave();
  return id;
}

/** Remove a section block (the root itself can't be removed). */
export function removeBlock(id: string) {
  const s = editorStateStore.getState();
  const root = s.document.root;
  if (id === 'root' || !root || root.type !== 'WhatsAppMessage' || !s.document[id]) return;

  const document = { ...s.document };
  delete document[id];
  document.root = {
    ...root,
    data: { ...root.data, childrenIds: (root.data.childrenIds ?? []).filter((c) => c !== id) },
  };

  editorStateStore.setState({
    document,
    selectedBlockId: s.selectedBlockId === id ? null : s.selectedBlockId,
    ...pushSnapshot(s),
  });
  triggerAutoSave();
}

export function undoChange() {
  const s = editorStateStore.getState();
  const prev = s.undoStack[s.undoStack.length - 1];
  if (!prev) return;
  editorStateStore.setState({
    document: prev,
    undoStack: s.undoStack.slice(0, -1),
    redoStack: [...s.redoStack, s.document].slice(-MAX_HISTORY),
    selectedBlockId: null,
  });
  triggerAutoSave();
}

export function redoChange() {
  const s = editorStateStore.getState();
  const next = s.redoStack[s.redoStack.length - 1];
  if (!next) return;
  editorStateStore.setState({
    document: next,
    redoStack: s.redoStack.slice(0, -1),
    undoStack: [...s.undoStack, s.document].slice(-MAX_HISTORY),
    selectedBlockId: null,
  });
  triggerAutoSave();
}
