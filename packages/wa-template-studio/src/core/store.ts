import { create } from 'zustand';

import {
  galleryTemplateToDoc,
  normalizeGalleryCatalog,
  pickGalleryText,
  type GalleryCategory,
  type GalleryTemplate,
  type RawGalleryCatalog,
} from '@/presets/gallery';
import { getBlockPlugin, getButtonPlugin } from './registry';
import {
  newId,
  type BlockInstance,
  type ButtonInstance,
  type PreviewSheet,
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
export type PreviewMode = 'edit' | 'interact';
export type Selection =
  | { kind: 'none' }
  | { kind: 'template' }
  | { kind: 'block'; slot: 'header' | 'body' | 'footer'; id: string }
  | { kind: 'button'; id: string };

/** One outgoing bubble produced by tapping a quick reply in Test mode. */
export interface PreviewReply {
  id: string;
  text: string;
}

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
  /** Edit = click selects; Interact = the preview behaves like WhatsApp. */
  previewMode: PreviewMode;
  /** `false` = compact library rail; `true` = full searchable library. */
  libraryOpen: boolean;
  /** Inspector sidebar width mode. */
  inspectorMode: 'full' | 'compact';
  /** Ready-made templates for the inspector's default state (host-provided). */
  galleryTemplates: GalleryCategory[];
  /**
   * Id of the gallery template the current doc was built from (or null). Lets
   * the body copy re-localize when the language changes, until it's edited.
   */
  activeTemplateId: string | null;
  /** Test-mode conversation state (never part of undo history). */
  previewReplies: PreviewReply[];
  previewSheet: PreviewSheet | null;
  previewToast: string | null;
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
  previewMode: 'edit',
  libraryOpen: false,
  inspectorMode: 'full',
  galleryTemplates: [],
  activeTemplateId: null,
  previewReplies: [],
  previewSheet: null,
  previewToast: null,
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
    useStudio.setState({
      doc: next,
      past: [],
      future: [],
      selection: { kind: 'template' },
      activeTemplateId: null,
    });
    scheduleAutosave();
  } else {
    commit(next);
    useStudio.setState({ activeTemplateId: null });
  }
}

/** Find a gallery template by id across all catalog groups. */
function findGalleryTemplate(id: string | null): GalleryTemplate | null {
  if (!id) return null;
  for (const group of useStudio.getState().galleryTemplates) {
    const found = group.templates.find((t) => t.id === id);
    if (found) return found;
  }
  return null;
}

/**
 * When the language changes, refresh the body copy to the applied gallery
 * template's translation for that language — but only while the body is still
 * the template's untouched copy, so manual edits are never discarded.
 */
function relocalizeForLanguage(
  doc: TemplateDoc,
  language: string,
  activeTemplateId: string | null,
): TemplateDoc {
  const next: TemplateDoc = { ...doc, language };
  const template = findGalleryTemplate(activeTemplateId);
  const body = next.blocks.body;
  // Authentication bodies are Meta-generated (no free text to translate).
  if (!template || template.category === 'AUTHENTICATION' || body.type !== 'body') {
    return next;
  }
  const data = body.data as { text?: string; variables?: unknown };
  const currentText = data.text ?? '';
  // Untouched = still exactly the copy we injected for the previous language.
  if (currentText !== pickGalleryText(template, doc.language)) return next;
  const localized = pickGalleryText(template, language);
  if (localized === currentText) return next;
  return {
    ...next,
    blocks: {
      ...next.blocks,
      body: { ...body, data: { ...data, text: localized } },
    },
  };
}

export function setTemplateField(field: 'name' | 'language', value: string) {
  const { doc, activeTemplateId } = useStudio.getState();
  if (field === 'language' && value !== doc.language) {
    commit(relocalizeForLanguage(doc, value, activeTemplateId));
    return;
  }
  commit({ ...doc, [field]: value });
}

/**
 * Apply a ready-made gallery template (undoable). Remembers which template it
 * was so switching languages afterward re-localizes the body copy in place.
 */
export function applyGalleryTemplate(template: GalleryTemplate) {
  const doc = useStudio.getState().doc;
  commit(galleryTemplateToDoc(template, doc));
  useStudio.setState({ activeTemplateId: template.id, selection: { kind: 'template' } });
}

export function setCategory(category: TemplateCategory) {
  const doc = useStudio.getState().doc;
  // Never silently delete content on a category switch — validation
  // flags incompatible blocks and the user resolves them explicitly.
  commit({ ...doc, category });
}

/** Category switch with auth slot presets (shared by TopBar + host header). */
export function changeTemplateCategory(category: TemplateCategory) {
  const previous = useStudio.getState().doc.category;
  setCategory(category);
  if (category === 'AUTHENTICATION') {
    placeBlock('body', 'body-auth');
    placeBlock('footer', 'footer-auth');
  } else if (previous === 'AUTHENTICATION') {
    placeBlock('body', 'body');
  }
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
  // Clicking an editable region (block/button) in the preview reveals the
  // inspector so its properties are immediately editable. Background/template
  // clicks leave the inspector as-is (they don't force it open).
  const editable = selection.kind === 'block' || selection.kind === 'button';
  useStudio.setState(editable ? { selection, inspectorMode: 'full' } : { selection });
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

export function toggleLibraryOpen() {
  useStudio.setState((s) => ({ libraryOpen: !s.libraryOpen }));
}

export function setLibraryOpen(libraryOpen: boolean) {
  useStudio.setState({ libraryOpen });
}

export function setInspectorMode(inspectorMode: 'full' | 'compact') {
  useStudio.setState({ inspectorMode });
}

/** Load the host-provided template gallery (normalized into the domain model). */
export function setGalleryCatalog(raw: RawGalleryCatalog | null | undefined) {
  useStudio.setState({ galleryTemplates: normalizeGalleryCatalog(raw) });
}

export function toggleInspectorMode() {
  useStudio.setState((s) => ({
    inspectorMode: s.inspectorMode === 'full' ? 'compact' : 'full',
  }));
}

// ---------------------------------------------------------------------------
// Test-mode interactions
// ---------------------------------------------------------------------------

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function setPreviewMode(previewMode: PreviewMode) {
  // Entering/leaving Test mode starts a fresh conversation.
  useStudio.setState({
    previewMode,
    previewReplies: [],
    previewSheet: null,
    previewToast: null,
    ...(previewMode === 'interact' ? { selection: { kind: 'none' as const } } : {}),
  });
}

export function pushPreviewReply(text: string) {
  useStudio.setState((s) => ({
    previewReplies: [...s.previewReplies, { id: newId('reply'), text }],
  }));
}

export function openPreviewSheet(previewSheet: PreviewSheet) {
  useStudio.setState({ previewSheet });
}

export function closePreviewSheet() {
  useStudio.setState({ previewSheet: null });
}

export function showPreviewToast(previewToast: string) {
  useStudio.setState({ previewToast });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => useStudio.setState({ previewToast: null }), 1800);
}

export function resetPreviewInteractions() {
  useStudio.setState({ previewReplies: [], previewSheet: null, previewToast: null });
}
