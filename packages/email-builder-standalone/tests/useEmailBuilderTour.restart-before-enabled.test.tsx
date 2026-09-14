/**
 * useEmailBuilderTour.restart-before-enabled.test.tsx — regression coverage for the
 * restart-nonce ordering bug found while reviewing B7B8's diff (see the module doc in
 * `useEmailBuilderTour.ts` for the full account).
 *
 * The restart-nonce effect used to mark `lastHandledRestartNonce.current` as handled
 * BEFORE checking `tourEnabled`:
 *
 *   if (restartNonce === lastHandledRestartNonce.current) return;
 *   lastHandledRestartNonce.current = restartNonce;   // marked handled...
 *   if (!tourEnabled) return;                          // ...then dropped
 *
 * That meant a restart requested WHILE `tourEnabled` was still `false` got consumed and
 * silently dropped: when the flag later flipped to `true`, the effect re-ran (its
 * dependency array includes `tourEnabled`), saw the nonce already "handled", and
 * returned without ever starting the tour. This test reproduces exactly that sequence —
 * `requestTourRestart()` called before `setTour(true)` — against the REAL hook and the
 * REAL `EditorContext` store (no mocked `createTour`), the same harness convention as
 * `useEmailBuilderTour.acceptance.test.tsx`.
 */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useEmailBuilderTour } from '../src/tour/useEmailBuilderTour';
import {
  editorStateStore,
  setTour,
  requestTourRestart,
  resetDocument,
} from '../src/documents/editor/EditorContext';
import type { EmailBuilderTourStepsConfig } from '../src/tour/tourSteps';
import { createLocalStoragePersistence } from '@md/product-tour';

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

beforeEach(() => {
  resetEditorState();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  document.body.innerHTML += `
    <div data-tour="eb.header.identity"></div>
    <div data-tour="eb.toolbar.views"></div>
    <div data-tour="eb.toolbar.history"></div>
    <div data-tour="eb.library.rail"></div>
    <div data-tour="eb.library.tabs"></div>
    <div data-tour="eb.canvas.root"></div>
    <div data-tour="eb.inspector.panel"></div>
    <div data-tour="eb.commandPalette"></div>
    <div data-tour="eb.header.actions"></div>
  `;
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  resetEditorState();
  vi.restoreAllMocks();
});

describe('useEmailBuilderTour — restart requested before `tourEnabled` survives the gate', () => {
  it('fires the tour once `tourEnabled` flips true, even though the restart was requested while it was still false', async () => {
    // Tour starts disabled AND already marked "seen" (mounting alone must never
    // auto-start it — only the explicit restart request under test may).
    setTour(false);
    createLocalStoragePersistence(TOUR_STORAGE_PREFIX).markSeen(TOUR_ID, 1);
    mount({ onSendTest: true });

    // A restart is requested while `tourEnabled` is still false — e.g. a palette/help
    // click that races ahead of the host flipping the `tour` flag on.
    act(() => {
      requestTourRestart();
    });

    // Now the host enables the tour — the SAME nonce bump must still be honored.
    act(() => {
      setTour(true);
    });

    await vi.waitFor(
      () => {
        const popover = document.querySelector('.driver-popover');
        expect(popover).not.toBeNull();
      },
      { timeout: 5000, interval: 50 },
    );
  });
});
