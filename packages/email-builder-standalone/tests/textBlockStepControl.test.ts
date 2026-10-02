/**
 * textBlockStepControl.test.ts — casos puros de `findFirstNotionTextBlockId` y casos de
 * guardia para `enterInspectorTabsStep`/`leaveInspectorTabsStep` (T6).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  enterInspectorTabsStep,
  findFirstNotionTextBlockId,
  hasNotionTextBlock,
  leaveInspectorTabsStep,
  resetTextBlockStepGuard,
} from '../src/tour/textBlockStepControl';
import {
  editorStateStore,
  resetDocument,
  setSelectedBlockId,
  setSidebarTab,
} from '../src/documents/editor/EditorContext';

function resetEditorState() {
  resetDocument({
    root: { type: 'EmailLayout', data: { childrenIds: [] } },
  } as never);
  setSelectedBlockId(null);
}

beforeEach(() => {
  resetEditorState();
  resetTextBlockStepGuard();
});

afterEach(() => {
  resetEditorState();
  resetTextBlockStepGuard();
});

describe('findFirstNotionTextBlockId', () => {
  it('encuentra el bloque en el orden de los hijos del root', () => {
    const document = {
      root: { type: 'EmailLayout', data: { childrenIds: ['a', 'b'] } },
      a: { type: 'Divider' },
      b: { type: 'NotionText' },
    };
    expect(findFirstNotionTextBlockId(document)).toBe('b');
  });

  it('prefiere el primer NotionText en el orden de childrenIds, no el orden de claves', () => {
    const document = {
      root: { type: 'EmailLayout', data: { childrenIds: ['b', 'a'] } },
      a: { type: 'NotionText' },
      b: { type: 'NotionText' },
    };
    expect(findFirstNotionTextBlockId(document)).toBe('b');
  });

  it('encuentra un NotionText anidado (no hijo directo del root)', () => {
    const document = {
      root: { type: 'EmailLayout', data: { childrenIds: ['columns'] } },
      columns: { type: 'ColumnsContainer', data: { childrenIds: undefined } },
      nestedText: { type: 'NotionText' },
    };
    expect(findFirstNotionTextBlockId(document)).toBe('nestedText');
  });

  it('devuelve null cuando no hay ningún NotionText', () => {
    const document = {
      root: { type: 'EmailLayout', data: { childrenIds: ['a'] } },
      a: { type: 'Divider' },
    };
    expect(findFirstNotionTextBlockId(document)).toBeNull();
  });

  it('no lanza con un documento sin root', () => {
    const document = { a: { type: 'NotionText' } } as any;
    expect(() => findFirstNotionTextBlockId(document)).not.toThrow();
    expect(findFirstNotionTextBlockId(document)).toBe('a');
  });

  it('no lanza cuando childrenIds no es un array', () => {
    const document = {
      root: { type: 'EmailLayout', data: { childrenIds: 'not-an-array' } },
      a: { type: 'NotionText' },
    } as any;
    expect(() => findFirstNotionTextBlockId(document)).not.toThrow();
    expect(findFirstNotionTextBlockId(document)).toBe('a');
  });

  it('no lanza cuando un id de childrenIds no apunta a nada', () => {
    const document = {
      root: { type: 'EmailLayout', data: { childrenIds: ['ghost', 'b'] } },
      b: { type: 'NotionText' },
    };
    expect(() => findFirstNotionTextBlockId(document)).not.toThrow();
    expect(findFirstNotionTextBlockId(document)).toBe('b');
  });

  it('no lanza con un documento completamente vacío', () => {
    expect(() => findFirstNotionTextBlockId({})).not.toThrow();
    expect(findFirstNotionTextBlockId({})).toBeNull();
  });
});

describe('hasNotionTextBlock', () => {
  it('es false en un documento vacío', () => {
    expect(hasNotionTextBlock()).toBe(false);
  });

  it('es true cuando el documento tiene un bloque NotionText', () => {
    resetDocument({
      root: { type: 'EmailLayout', data: { childrenIds: ['text-1'] } },
      'text-1': { type: 'NotionText', data: { props: { html: '<p>Hi</p>' } } },
    } as never);
    expect(hasNotionTextBlock()).toBe(true);
  });
});

describe('enterInspectorTabsStep / leaveInspectorTabsStep', () => {
  beforeEach(() => {
    resetDocument({
      root: { type: 'EmailLayout', data: { childrenIds: ['text-1'] } },
      'text-1': { type: 'NotionText', data: { props: { html: '<p>Hi</p>' } } },
    } as never);
  });

  it('abre el inspector en modo full, en la pestaña Content, y selecciona el bloque de texto', () => {
    enterInspectorTabsStep();
    const state = editorStateStore.getState();
    expect(state.inspectorDrawerOpen).toBe(true);
    expect(state.inspectorDrawerMode).toBe('full');
    expect(state.selectedSidebarTab).toBe('block-configuration');
    expect(state.selectedBlockId).toBe('text-1');
  });

  it('no modifica inspectorModeUserOverride', () => {
    const initialOverride = editorStateStore.getState().inspectorModeUserOverride;
    enterInspectorTabsStep();
    expect(editorStateStore.getState().inspectorModeUserOverride).toBe(initialOverride);
    leaveInspectorTabsStep();
    expect(editorStateStore.getState().inspectorModeUserOverride).toBe(initialOverride);
  });

  it('toma el snapshot una sola vez: una segunda llamada a enter sin leave no lo sobrescribe', () => {
    editorStateStore.setState({ inspectorDrawerOpen: false, inspectorDrawerMode: 'compact' });
    setSidebarTab('css');

    enterInspectorTabsStep(); // snapshot: { open: false, mode: 'compact', tab: 'css' }

    // Simular que el usuario cambia el modo mientras el paso está activo — si el snapshot se
    // retomara aquí, el leave restauraría 'full' en vez del estado original.
    editorStateStore.setState({ inspectorDrawerMode: 'full' });
    enterInspectorTabsStep(); // no debe re-tomar el snapshot

    leaveInspectorTabsStep();

    const state = editorStateStore.getState();
    expect(state.inspectorDrawerOpen).toBe(false);
    expect(state.inspectorDrawerMode).toBe('compact');
    expect(state.selectedSidebarTab).toBe('css');
  });

  it('restaura el open/mode/tab previos al salir', () => {
    editorStateStore.setState({ inspectorDrawerOpen: false, inspectorDrawerMode: 'compact' });
    setSidebarTab('styles');

    enterInspectorTabsStep();
    leaveInspectorTabsStep();

    const state = editorStateStore.getState();
    expect(state.inspectorDrawerOpen).toBe(false);
    expect(state.inspectorDrawerMode).toBe('compact');
    expect(state.selectedSidebarTab).toBe('styles');
  });

  it('leave es un no-op seguro cuando no hay nada que restaurar', () => {
    expect(() => leaveInspectorTabsStep()).not.toThrow();
    // Llamarlo dos veces seguidas también debe ser seguro (idempotente).
    expect(() => leaveInspectorTabsStep()).not.toThrow();
  });

  it('enter y leave son seguros de llamar dos veces', () => {
    expect(() => {
      enterInspectorTabsStep();
      enterInspectorTabsStep();
      leaveInspectorTabsStep();
      leaveInspectorTabsStep();
    }).not.toThrow();
  });
});
