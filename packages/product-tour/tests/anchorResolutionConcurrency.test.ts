import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * B19 / D23 / D24 → SUPERSEDED BY D35 — this file used to assert "a tour with missing anchors
 * costs ONE timeout window, not one per step", which relied on `start()` resolving every
 * eligible step's anchor up front (sequential `before()`, concurrent anchor waits). D35 removes
 * start-time anchor resolution ENTIRELY — `before()` now runs at step ACTIVATION (immediately
 * before the tour moves to that step; for the first step, immediately before `drive()`), and
 * each `DriveStep.element` is a function driver.js resolves lazily at drive time, with
 * driver.js's own `waitForElement`/`skipMissingElement` doing the waiting/skipping. There is
 * nothing left to overlap: no anchor wait of any kind happens inside `start()` any more, for
 * ANY step, so the old assertions ("N missing anchors cost ~1 timeout, not N") are not lowered
 * by this rewrite, they are simply about a code path that no longer exists.
 *
 * This file now asserts the NEW, STRICTLY STRONGER guarantee D35 makes: with several steps
 * whose anchors are missing, `start()` resolves without waiting for ANY anchor timeout at all —
 * proven below with fake timers (no timer is ever advanced) — and no step's `before()` has run
 * except the first eligible step's. Measured, not assumed: see the fake-timer assertions and
 * the literal `before()` call-order assertion in each test.
 *
 * Same conventions as `keyboardNavigation.test.ts` / `closeAndOverlayDismissal.test.ts`: REAL
 * driver.js@1.8.0 against happy-dom, no mocks, plain `document.body.innerHTML` fixtures with
 * `data-tour` anchors, `localStorage.clear()` in `afterEach`, `@/` alias imports.
 */

describe('createTour — no start-time anchor resolution at all (D35, supersedes D23/D24)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    vi.useRealTimers();
  });

  it('start() resolves with several missing anchors while NO timer is ever advanced — there is no start-time anchor wait to overlap', async () => {
    // Three steps, none of their anchors exist in the DOM. Under the old D23/D24 code this
    // would need real (or advanced fake) time to elapse — each step's `waitForAnchor()` used a
    // `setInterval`/timeout, and `start()` itself awaited a `Promise.all` of those waits before
    // resolving. Under D35 there is no anchor wait inside `start()` at all: the first step's
    // `before()` runs (there is none here), and `drive()` is called synchronously after that —
    // driver.js's OWN per-step `waitForElement` only kicks in later, when the tour actually
    // tries to highlight a step whose anchor is missing, which happens INSIDE `drive()`, not
    // inside anything `start()` awaits.
    const steps: TourStep[] = [
      { anchorKey: 'missing-1', popover: { title: 'Missing 1' }, waitForElementMs: 5000 },
      { anchorKey: 'missing-2', popover: { title: 'Missing 2' }, waitForElementMs: 5000 },
      { anchorKey: 'missing-3', popover: { title: 'Missing 3' }, waitForElementMs: 5000 },
    ];

    const tour = createTour({
      tourId: 'no-start-time-wait-tour',
      version: 1,
      storagePrefix: 'test:',
      steps,
    });

    const startPromise = tour.start();

    // The critical measurement: `start()` must resolve WITHOUT this test ever advancing the
    // fake clock (no `vi.advanceTimersByTime`/`vi.runAllTimers`/`vi.runOnlyPendingTimers` call
    // anywhere in this test). Under D35 there is no `setInterval`/`setTimeout`-based anchor
    // wait left inside `start()` for any step — the only asynchronous work `start()` still
    // does is `await import('driver.js')` (a real, one-time module-loader macrotask, unrelated
    // to anchors) and, for the first step, its `before()`. `vi.waitFor` here polls on REAL
    // timers under the hood for the assertion callback itself (vitest's own polling, not this
    // package's), while the fake clock installed by `vi.useFakeTimers()` above is never
    // advanced — proving that whatever `start()` is awaiting is not a fake timer, which is
    // exactly what an anchor-polling `setInterval`/timeout would have been pre-D35.
    await vi.waitFor(
      () => {
        expect(tour.isActive()).toBe(true);
      },
      { timeout: 2000, interval: 5 },
    );

    await startPromise;

    expect(tour.isActive()).toBe(true);

    tour.stop();
  });

  it('no step`s before() has run except the first eligible step`s, even though every anchor is missing', async () => {
    const callOrder: string[] = [];

    const steps: TourStep[] = [
      {
        anchorKey: 'missing-a',
        popover: { title: 'A' },
        waitForElementMs: 5000,
        before: () => {
          callOrder.push('a');
        },
      },
      {
        anchorKey: 'missing-b',
        popover: { title: 'B' },
        waitForElementMs: 5000,
        before: () => {
          callOrder.push('b');
        },
      },
      {
        anchorKey: 'missing-c',
        popover: { title: 'C' },
        waitForElementMs: 5000,
        before: () => {
          callOrder.push('c');
        },
      },
    ];

    const tour = createTour({
      tourId: 'before-order-tour',
      version: 1,
      storagePrefix: 'test:',
      steps,
    });

    await tour.start();

    // Pre-D35 (the old sequential-before/concurrent-wait code this file used to assert on),
    // this would already read ['a', 'b', 'c'] — ALL three `before()` hooks ran during
    // `start()`, before the first popover ever rendered (the exact bug T8 fixes: a later
    // step's precondition — opening a drawer, a command palette, etc. — was already applied
    // during the very first step). Under D35, only the FIRST eligible step's `before()` has
    // run by the time `start()` resolves.
    expect(callOrder).toEqual(['a']);

    tour.stop();
  });
});
