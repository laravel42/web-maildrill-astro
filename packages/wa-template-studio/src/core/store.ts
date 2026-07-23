import { create } from 'zustand';

import { getBlockPlugin, getButtonPlugin } from './registry';
import {
  newId,
  type BlockInstance,
  type ButtonInstance,
  type TemplateCategory,
  type TemplateDoc,
} from './types';

/**
 * Studio state. The document is treated as immutable — every mutation
 * replaces it wholesale and pushes the previous value onto the undo
 * stack (structural sharing keeps this cheap; docs are tiny). UI state
 * (selection, panels, preview device) lives beside it and is never
 * part of history.
 */

export type PreviewDevice = 'mobile' | 'desktop';
export type Selection =
  | { kind: 'none' }
  | { kind: 'template' }
  | { kind: 'block'; slot: 'header' | 'body' | 'footer'; id: string }
  | { kind: 'button'; id: string };

const MAX_HISTORY = 100;
const DRAFT_KEY = 'wa-studio:draft';
const AUTOSAVE_DELAY = 1200;

export function emptyDoc(): TemplateDoc {
  const bodyPlugin = getBlockPlugin('body');
  return {
    name: '',
    language: 'en_US',
    category: 'MARKETING',
    blocks: {
      header: null,
      body: { id: newId('body'), type: 'body', data: bodyPlugin ? bodyPlugin.defaults() : { text: '', variables: {} } },
      footer: null,
      buttons: [],
    },
  };
}

interface StudioState {
  doc: TemplateDoc;
  past: TemplateDoc[];
  future: TemplateDoc[];
  selection: Selection;
  previewDark: boolean;
  previewDevice: PreviewDevice;
  librarySearch: string;
  /** Autosave indicator: idle → saving → saved. */
  saveState: 'idle' | 'saving' | 'saved';
}

export const useStudio = create<StudioState>(() => ({
  doc: emptyDoc(),
  past: [],
  future: [],
  selection: { kind: 'template' },
  previewDark: false,
  previewDevice: 'mobile',
  librarySearch: '',
  saveState: 'idle',
}));

// ---------------------------------------------------------------------------
// Autosave (drafts in localStorage; host apps can subscribe instead)
// ---------------------------------------------------------------------------

let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutosave() {
  if (typeof window === 'undefined') return;
  useStudio.setState({ saveState: 'saving' });
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(useStudio.getState().doc));
      useStudio.setState({ saveState: 'saved' });
    } catch {
      useStudio.setState({ saveState: 'idle' });
    }
  }, AUTOSAVE_DELAY);
}

export function loadDraft(): TemplateDoc | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as TemplateDoc) : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window !== 'undefined') window.localStorage.removeItem(DRAFT_KEY);
}

// ---------------------------------------------------------------------------
// Document mutations (all undoable)
// ---------------------------------------------------------------------------

function commit(next: TemplateDoc) {
  const { doc, past } = useStudio.getState();
  useStudio.setState({
    doc: next,
    past: [...past.slice(-(MAX_HISTORY - 1)), doc],
    future: [],
  });
  scheduleAutosave();
}

export function replaceDoc(next: TemplateDoc, options: { resetHistory?: boolean } = {}) {
  if (options.resetHistory) {
    useStudio.setState({ doc: next, past: [], future: [], selection: { kind: 'template' } });
    scheduleAutosave();
  } else {
    commit(next);
  }
}

export function setTemplateField(field: 'name' | 'language', value: string) {
  const doc = useStudio.getState().doc;
  commit({ ...doc, [field]: value });
}

export function setCategory(category: TemplateCategory) {
  const doc = useStudio.getState().doc;
  // Never silently delete content on a category switch — validation
  // flags incompatible blocks and the user resolves them explicitly.
  commit({ ...doc, category });
}

/** Place (or replace) a slot block from a plugin type. */
export function placeBlock(slot: 'header' | 'body' | 'footer', pluginType: string) {
  const plugin = getBlockPlugin(pluginType);
  if (!plugin || plugin.slot !== slot) return;
  const doc = useStudio.getState().doc;
  const instance: BlockInstance = { id: newId(slot), type: pluginType, data: plugin.defaults() };
  commit({ ...doc, blocks: { ...doc.blocks, [slot]: instance } });
  useStudio.setState({ selection: { kind: 'block', slot, id: instance.id } });
}

export function removeBlock(slot: 'header' | 'footer') {
  const doc = useStudio.getState().doc;
  if (!doc.blocks[slot]) return;
  commit({ ...doc, blocks: { ...doc.blocks, [slot]: null } });
  useStudio.setState({ selection: { kind: 'template' } });
}

export function updateBlockData(slot: 'header' | 'body' | 'footer', data: unknown) {
  const doc = useStudio.getState().doc;
  const instance = doc.blocks[slot];
  if (!instance) return;
  commit({ ...doc, blocks: { ...doc.blocks, [slot]: { ...instance, data } } });
}

export function addButton(pluginType: string): string | null {
  const plugin = getButtonPlugin(pluginType);
  if (!plugin) return null;
  const doc = useStudio.getState().doc;
  const instance: ButtonInstance = { id: newId('btn'), type: pluginType, data: plugin.defaults() };
  commit({ ...doc, blocks: { ...doc.blocks, buttons: [...doc.blocks.buttons, instance] } });
  useStudio.setState({ selection: { kind: 'button', id: instance.id } });
  return instance.id;
}

export function updateButtonData(id: string, data: unknown) {
  const doc = useStudio.getState().doc;
  commit({
    ...doc,
    blocks: {
      ...doc.blocks,
      buttons: doc.blocks.buttons.map((b) => (b.id === id ? { ...b, data } : b)),
    },
  });
}

export function removeButton(id: string) {
  const doc = useStudio.getState().doc;
  commit({
    ...doc,
    blocks: { ...doc.blocks, buttons: doc.blocks.buttons.filter((b) => b.id !== id) },
  });
  const selection = useStudio.getState().selection;
  if (selection.kind === 'button' && selection.id === id) {
    useStudio.setState({ selection: { kind: 'template' } });
  }
}

export function reorderButtons(fromIndex: number, toIndex: number) {
  const doc = useStudio.getState().doc;
  const buttons = [...doc.blocks.buttons];
  const moved = buttons.splice(fromIndex, 1)[0];
  if (!moved) return;
  buttons.splice(toIndex, 0, moved);
  commit({ ...doc, blocks: { ...doc.blocks, buttons } });
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------

export function undo() {
  const { doc, past, future } = useStudio.getState();
  const prev = past[past.length - 1];
  if (!prev) return;
  useStudio.setState({
    doc: prev,
    past: past.slice(0, -1),
    future: [doc, ...future].slice(0, MAX_HISTORY),
  });
  scheduleAutosave();
}

export function redo() {
  const { doc, past, future } = useStudio.getState();
  const next = future[0];
  if (!next) return;
  useStudio.setState({
    doc: next,
    past: [...past, doc].slice(-MAX_HISTORY),
    future: future.slice(1),
  });
  scheduleAutosave();
}

// ---------------------------------------------------------------------------
// UI state
// ---------------------------------------------------------------------------

export function select(selection: Selection) {
  useStudio.setState({ selection });
}

export function setPreviewDark(previewDark: boolean) {
  useStudio.setState({ previewDark });
}

export function setPreviewDevice(previewDevice: PreviewDevice) {
  useStudio.setState({ previewDevice });
}

export function setLibrarySearch(librarySearch: string) {
  useStudio.setState({ librarySearch });
}
