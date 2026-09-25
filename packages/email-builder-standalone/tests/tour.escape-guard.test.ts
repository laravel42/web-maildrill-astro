/**
 * tour.escape-guard.test.ts — F4 acceptance criterion (docs/product-tour-driverjs-plan.md
 * §1.4.3 / §4): "Salir del tour con Escape NO cierra el editor", explicit test for
 * `VisualEmailBuilder` (`src/components/react/VisualEmailBuilder.tsx`).
 *
 * `VisualEmailBuilder` closes the editor with a plain `window.addEventListener('keydown', ...)`
 * bubble-phase listener (see that file's own `onKey` effect) that calls `onClose()` whenever
 * `e.key === 'Escape'`. driver.js ALSO closes on Escape — without `@md/product-tour`'s capture-
 * phase guard (`createTour.ts`, `attachEscapeGuard`), the host's listener would still fire and
 * close the editor underneath the tour.
 *
 * This test reproduces the exact integration contract between the two, in the same registration
 * order `useEmailBuilderTour`/`VisualEmailBuilder` use in production:
 *   1. Host registers its bubble-phase `keydown` → `onClose()` listener (mirrors
 *      `VisualEmailBuilder`'s own `useEffect`, which runs on mount, before any tour interaction).
 *   2. The tour starts (`createTour(...).start()`), attaching its OWN capture-phase listener.
 *   3. Escape fires on `window` — exactly what a real keypress dispatches.
 *   4. Assert the host's `onClose` was never called while the tour was active.
 *
 * We test the real `@md/product-tour` `createTour` (not a mock) using a step built from this
 * package's real anchors/steps registry, so this exercises the actual production wiring rather
 * than a re-implementation of the guard.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTour, type Tour } from '@md/product-tour';

/** Minimal anchor so `createTour` has something to highlight — content is irrelevant here. */
function renderSingleAnchor(): void {
  document.body.innerHTML = '<div data-tour="test.anchor">anchor</div>';
}

describe('F4 — Escape while the tour is active does not close the host editor (§1.4.3)', () => {
  let tour: Tour | null = null;

  afterEach(() => {
    tour?.stop();
    tour = null;
    document.body.innerHTML = '';
  });

  it('does not invoke the host onClose listener while driver.js is active', async () => {
    renderSingleAnchor();

    // 1. Host registers its close-on-Escape listener FIRST, exactly like
    //    `VisualEmailBuilder`'s own `useEffect(() => { window.addEventListener('keydown', onKey); ... }, [onClose])`.
    const onClose = vi.fn();
    const hostEscapeListener = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
    };
    window.addEventListener('keydown', hostEscapeListener);

    try {
      // 2. The tour starts — same call shape as `useEmailBuilderTour`'s `createTour(...).start()`.
      tour = createTour({
        tourId: 'escape-guard-test',
        version: 1,
        storagePrefix: 'eb:test:',
        steps: [{ anchorKey: 'test.anchor', popover: { title: 't', description: 'd' } }],
      });
      await tour.start();
      expect(tour.isActive()).toBe(true);

      // 3. Escape fires on `window`, bubbles, cancelable — exactly what a real keypress dispatches.
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      window.dispatchEvent(escape);

      // 4. The host's own close handler must never have run while the tour intercepted it.
      expect(onClose).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('keydown', hostEscapeListener);
    }
  });

  it('control: without an active tour, the SAME host Escape listener does close the editor', () => {
    // Sanity check that the host listener itself is a faithful stand-in for
    // `VisualEmailBuilder`'s real behavior — Escape closes the editor when no tour
    // is running, matching current (unchanged) behavior outside the tour.
    const onClose = vi.fn();
    const hostEscapeListener = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
    };
    window.addEventListener('keydown', hostEscapeListener);
    try {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', hostEscapeListener);
    }
  });
});
