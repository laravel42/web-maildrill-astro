/**
 * componentsLibraryCategory.test.ts — covers D28 (T2): the Components Library
 * drawer's active tab lives in the editor store instead of a local `useState`,
 * so it can be driven from outside React (a tour `before()` hook).
 *
 * Two independent surfaces are verified:
 *   - `resolveLibraryCategory` — the pure, DOM-free normalization function
 *     exported by `ComponentsLibraryDrawer.tsx` (no rendering involved).
 *   - The store round-trip on `EditorContext` itself — `componentsLibraryDrawerCategory`
 *     defaults to `'blocks'` and `setComponentsLibraryDrawerCategory` persists a new value,
 *     all without mounting the drawer component.
 */
import { describe, expect, it } from 'vitest';

import { resolveLibraryCategory } from '../src/App/ComponentsLibrary/ComponentsLibraryDrawer';
import {
  editorStateStore,
  setComponentsLibraryDrawerCategory,
} from '../src/documents/editor/EditorContext';

describe('resolveLibraryCategory', () => {
  it('keeps the stored value when it is present in the visible set', () => {
    expect(resolveLibraryCategory('templates', ['blocks', 'templates'])).toBe('templates');
  });

  it('falls back to the first visible key when the stored tab is hidden', () => {
    // Templates tab hidden (templateLibrary disabled) while it was the last selected tab.
    expect(resolveLibraryCategory('templates', ['blocks'])).toBe('blocks');
  });

  it('falls back to the first visible key for the legacy dead default ("sections")', () => {
    // 'sections' predates Point 7 (EMAIL_BUILDER_TASKS.md) — no longer a valid CATEGORIES key.
    expect(resolveLibraryCategory('sections', ['blocks', 'templates'])).toBe('blocks');
  });

  it('falls back to the first visible key when stored is null', () => {
    expect(resolveLibraryCategory(null, ['blocks', 'templates'])).toBe('blocks');
  });

  it('falls back to the first visible key when stored is undefined', () => {
    expect(resolveLibraryCategory(undefined, ['templates', 'blocks'])).toBe('templates');
  });

  it('returns "blocks" when visibleKeys is empty, regardless of stored', () => {
    expect(resolveLibraryCategory('templates', [])).toBe('blocks');
    expect(resolveLibraryCategory(null, [])).toBe('blocks');
  });
});

describe('componentsLibraryDrawerCategory store round-trip', () => {
  it('defaults to "blocks" (T2: no longer the legacy "sections")', () => {
    expect(editorStateStore.getState().componentsLibraryDrawerCategory).toBe('blocks');
  });

  it('persists a new category via setComponentsLibraryDrawerCategory', () => {
    setComponentsLibraryDrawerCategory('templates');
    expect(editorStateStore.getState().componentsLibraryDrawerCategory).toBe('templates');

    // Restore the default so this test doesn't leak state into other suites
    // sharing the same module-level store instance.
    setComponentsLibraryDrawerCategory('blocks');
    expect(editorStateStore.getState().componentsLibraryDrawerCategory).toBe('blocks');
  });
});
