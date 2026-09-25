/**
 * libraryStepGuard.test.ts — verifica la guardia compartida de los 4 pasos de librería
 * consecutivos del tour (`enterLibraryStep` / `leaveLibraryStep` / `flushLibraryStepRestore` /
 * `resetLibraryStepGuard`, §D33 de tourSteps.ts): el drawer se abre una sola vez al entrar en
 * el primer paso de librería y se restaura una sola vez al salir del último, sin parpadear
 * entre pasos de librería consecutivos.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  enterLibraryStep,
  flushLibraryStepRestore,
  leaveLibraryStep,
  resetLibraryStepGuard,
} from '../src/tour/tourSteps';
import {
  editorStateStore,
  resetDocument,
  setComponentsLibraryDrawerCategory,
  setComponentsLibraryDrawerOpen,
  setSelectedBlockId,
} from '../src/documents/editor/EditorContext';

function resetEditorState() {
  resetDocument({
    root: { type: 'EmailLayout', data: { childrenIds: [] } },
  } as never);
  setSelectedBlockId(null);
  setComponentsLibraryDrawerOpen(false);
  setComponentsLibraryDrawerCategory('blocks');
}

beforeEach(() => {
  vi.useFakeTimers();
  resetEditorState();
  resetLibraryStepGuard();
});

afterEach(() => {
  resetLibraryStepGuard();
  resetEditorState();
  vi.useRealTimers();
});

describe('enterLibraryStep', () => {
  it('toma la foto una sola vez y abre el drawer en el tab pedido', () => {
    setComponentsLibraryDrawerOpen(false);
    setComponentsLibraryDrawerCategory('blocks');

    enterLibraryStep('blocks');

    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(true);
    expect(editorStateStore.getState().componentsLibraryDrawerCategory).toBe('blocks');
  });

  it('entrar en un segundo paso de librería no pisa la foto y cancela el restore pendiente', () => {
    setComponentsLibraryDrawerOpen(false);
    setComponentsLibraryDrawerCategory('blocks');

    enterLibraryStep('blocks');
    leaveLibraryStep();
    enterLibraryStep('blocks');

    vi.runAllTimers();

    // El drawer nunca se cierra entre dos pasos de librería consecutivos: si la foto se
    // hubiera vuelto a tomar en el segundo `enterLibraryStep` (con el drawer ya abierto por
    // el primer paso), el restore programado por el `leaveLibraryStep` cancelado ya no
    // podría cerrarlo de todos modos — pero la garantía real es que el restore de
    // `leaveLibraryStep` se cancela, así que corriendo los timers no pasa nada.
    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(true);
  });

  it('es seguro llamarlo dos veces seguidas', () => {
    enterLibraryStep('blocks');
    expect(() => enterLibraryStep('blocks')).not.toThrow();
    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(true);
  });
});

describe('leaveLibraryStep + flushLibraryStepRestore / timers', () => {
  it('un solo leaveLibraryStep, tras correr los timers, restaura open y category originales', () => {
    setComponentsLibraryDrawerOpen(false);
    setComponentsLibraryDrawerCategory('blocks');

    enterLibraryStep('templates');
    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(true);
    expect(editorStateStore.getState().componentsLibraryDrawerCategory).toBe('templates');

    leaveLibraryStep();
    vi.runAllTimers();

    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(false);
    expect(editorStateStore.getState().componentsLibraryDrawerCategory).toBe('blocks');
  });

  it('un drawer que ya estaba abierto en Templates antes del tour queda exactamente igual', () => {
    setComponentsLibraryDrawerOpen(true);
    setComponentsLibraryDrawerCategory('templates');

    enterLibraryStep('blocks');
    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(true);
    expect(editorStateStore.getState().componentsLibraryDrawerCategory).toBe('blocks');

    leaveLibraryStep();
    vi.runAllTimers();

    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(true);
    expect(editorStateStore.getState().componentsLibraryDrawerCategory).toBe('templates');
  });

  it('flushLibraryStepRestore sin nada pendiente es un no-op', () => {
    setComponentsLibraryDrawerOpen(false);
    setComponentsLibraryDrawerCategory('blocks');

    expect(() => flushLibraryStepRestore()).not.toThrow();

    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(false);
    expect(editorStateStore.getState().componentsLibraryDrawerCategory).toBe('blocks');
  });

  it('flushLibraryStepRestore aplica el restore de inmediato sin esperar los timers', () => {
    setComponentsLibraryDrawerOpen(false);
    setComponentsLibraryDrawerCategory('blocks');

    enterLibraryStep('templates');
    leaveLibraryStep();
    flushLibraryStepRestore();

    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(false);
    expect(editorStateStore.getState().componentsLibraryDrawerCategory).toBe('blocks');
  });

  it('es seguro llamar leaveLibraryStep dos veces seguidas', () => {
    enterLibraryStep('blocks');
    leaveLibraryStep();
    expect(() => leaveLibraryStep()).not.toThrow();
    vi.runAllTimers();
    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(false);
  });

  it('es seguro llamar flushLibraryStepRestore dos veces seguidas', () => {
    enterLibraryStep('blocks');
    leaveLibraryStep();
    flushLibraryStepRestore();
    expect(() => flushLibraryStepRestore()).not.toThrow();
  });

  it('leaveLibraryStep sin ninguna foto (sin enterLibraryStep previo) es un no-op', () => {
    setComponentsLibraryDrawerOpen(false);
    setComponentsLibraryDrawerCategory('blocks');

    expect(() => leaveLibraryStep()).not.toThrow();
    vi.runAllTimers();

    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(false);
  });
});

describe('resetLibraryStepGuard', () => {
  it('descarta la foto y el timer pendiente sin tocar el store', () => {
    setComponentsLibraryDrawerOpen(false);
    setComponentsLibraryDrawerCategory('blocks');

    enterLibraryStep('templates');
    leaveLibraryStep();
    resetLibraryStepGuard();
    vi.runAllTimers();

    // Sin foto que restaurar, el estado se queda como lo dejó enterLibraryStep.
    expect(editorStateStore.getState().componentsLibraryDrawerOpen).toBe(true);
    expect(editorStateStore.getState().componentsLibraryDrawerCategory).toBe('templates');
  });

  it('es seguro llamarlo dos veces seguidas', () => {
    resetLibraryStepGuard();
    expect(() => resetLibraryStepGuard()).not.toThrow();
  });
});
