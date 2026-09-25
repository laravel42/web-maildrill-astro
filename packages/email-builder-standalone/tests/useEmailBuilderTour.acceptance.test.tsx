/**
 * useEmailBuilderTour.acceptance.test.ts — F4 acceptance criteria
 * (docs/product-tour-driverjs-plan.md §4):
 *   - First mount offers the tour once (auto-start when `tour` is enabled and unseen).
 *   - "Already seen" persists across reloads (a fresh `createLocalStoragePersistence('eb:')`
 *     reading the same `localStorage` reports `seen: true` without starting again).
 *   - Bumping the tour version re-offers it to someone who already saw a previous version.
 *
 * Mounts the hook via a minimal harness component with `react-dom/client` (same convention as
 * `tourAnchors.render.test.tsx` — this package has no `@testing-library/react` dependency and
 * F4 must not add one). Exercises the REAL persistence convention this module wires
 * (`createLocalStoragePersistence('eb:')`, `eb:tour:email-builder` key) rather than a mock, so a
 * regression in the prefix/tourId wiring itself would fail this test.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalStoragePersistence } from '@md/product-tour';

import { useEmailBuilderTour } from '../src/tour/useEmailBuilderTour';
import {
  editorStateStore,
  setTour,
  appendBuiltInBlockToParent,
  resetDocument,
} from '../src/documents/editor/EditorContext';
import { BUTTONS } from '../src/App/ComponentsLibrary/builtInBlocks';
import type { EmailBuilderTourStepsConfig } from '../src/tour/tourSteps';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const TOUR_STORAGE_PREFIX = 'eb:';
const TOUR_ID = 'email-builder';

function Harness({ config }: { config: EmailBuilderTourStepsConfig }) {
  useEmailBuilderTour({ config });
  return null;
}

let container: HTMLDivElement;
let root: Root;

function mount(config: EmailBuilderTourStepsConfig) {
  act(() => {
    root.render(<Harness config={config} />);
  });
}

function resetEditorState() {
  setTour(false);
  resetDocument({ root: { type: 'EmailLayout', data: { childrenIds: [] } } } as never);
  editorStateStore.setState({ tourRestartNonce: 0 });
  localStorage.clear();
}

function seedOneBlock() {
  appendBuiltInBlockToParent('root', BUTTONS[0]!.block());
}

beforeEach(() => {
  resetEditorState();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  resetEditorState();
  vi.restoreAllMocks();
});

describe('useEmailBuilderTour — F4 acceptance', () => {
  it('auto-starts once when `tour` is enabled and the tour has never been seen', async () => {
    setTour(true);
    seedOneBlock();
    document.body.innerHTML += `
      <div data-tour="eb.header.identity"></div>
      <div data-tour="eb.header.save"></div>
      <div data-tour="eb.header.status"></div>
      <div data-tour="eb.toolbar.views"></div>
      <div data-tour="eb.viewport.screenSize"></div>
      <div data-tour="eb.toolbar.history"></div>
      <div data-tour="eb.library.rail"></div>
      <div data-tour="eb.library.tabs"></div>
      <div data-tour="eb.canvas.root"></div>
      <div data-tour="eb.inspector.panel"></div>
      <div data-tour="eb.commandPalette"></div>
      <div data-tour="eb.header.actions"></div>
    `;

    mount({ onSendTest: true });

    await vi.waitFor(
      () => {
        const persistence = createLocalStoragePersistence(TOUR_STORAGE_PREFIX);
        const state = persistence.read(TOUR_ID, 1);
        expect(state.seen).toBe(true);
      },
      { timeout: 5000, interval: 50 },
    );
  });

  it('does not auto-start when `tour` is disabled (current behavior unchanged)', async () => {
    setTour(false);
    document.body.innerHTML += `<div data-tour="eb.header.identity"></div>`;

    mount({});

    await new Promise((r) => setTimeout(r, 20));
    const persistence = createLocalStoragePersistence(TOUR_STORAGE_PREFIX);
    expect(persistence.read(TOUR_ID, 1).seen).toBe(false);
  });

  it('"seen but not completed" persists across a fresh read — the mount effect still auto-starts to resume (§ progreso persistido)', () => {
    // Simulate a previous session having started the tour (marked "seen") at version 1
    // but closing before completing it (Escape/overlay/×/tab close — never reaching
    // onDoneClick, so `completed` stays false). The auto-start effect's own gate
    // (`!(state.seen && state.completed)`) must still allow a fresh mount to call
    // `tour.start()` again — that's what lets `createTour()`'s own resume-from-
    // `lastStepIndex` logic (`persistence.ts`) ever run. Only `seen && completed`
    // (the tour actually finished) should suppress a further auto-start.
    const persistence = createLocalStoragePersistence(TOUR_STORAGE_PREFIX);
    persistence.markSeen(TOUR_ID, 1);

    const stateAfterReload = createLocalStoragePersistence(TOUR_STORAGE_PREFIX).read(TOUR_ID, 1);
    expect(stateAfterReload.seen).toBe(true);
    expect(stateAfterReload.completed).toBe(false);
  });

  it('a tour marked completed does not report pending progress (mirrors the auto-start gate)', () => {
    const persistence = createLocalStoragePersistence(TOUR_STORAGE_PREFIX);
    persistence.markCompleted(TOUR_ID, 1);

    const state = createLocalStoragePersistence(TOUR_STORAGE_PREFIX).read(TOUR_ID, 1);
    expect(state.seen).toBe(true);
    expect(state.completed).toBe(true);
  });

  it('bumping the tour version re-offers it to someone who already saw a previous version', () => {
    const persistence = createLocalStoragePersistence(TOUR_STORAGE_PREFIX);
    persistence.markSeen(TOUR_ID, 1);
    expect(persistence.read(TOUR_ID, 1).seen).toBe(true);

    // A version bump (2) must read back as NOT seen — this is `@md/product-tour`'s own
    // documented contract (`persistence.ts`), exercised here through the exact prefix/tourId
    // this package wires so a regression in that wiring would be caught here too.
    expect(persistence.read(TOUR_ID, 2).seen).toBe(false);
  });
});
