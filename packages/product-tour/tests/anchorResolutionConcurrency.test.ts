import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * B19 / D23 / D24 → SUPERSEDED BY D35 — this file used to assert "a tour with missing anchors
 * costs ONE timeout window, not one per step", which relied on `start()` resolving every
 * eligible step's anchor up front (sequential `before()`, concurrent anchor waits). D35 removes
 * start-time anchor resolution ENTIRELY — `before()` now runs at step ACTIVATION (immediately
 * before the tour moves to that step; for the first step, immediately before `drive()`), and
 * each `DriveStep.element` is a function driver.js resolves lazily at drive time.
 *
 * D43 (supersedes the "no anchor wait inside start() at all" half of this file's original
 * claim, NOT D35 itself): driver.js@1.8.0's own `waitForElement` is dead config — it is never
 * read anywhere in the bundle (verified reading `dist/driver.js.mjs`) — so `start()` now waits,
 * bounded by the FIRST step's own `waitForElementMs`, for that one step's anchor after its
 * `before()` and before `drive()` (`waitForStepAnchor()` in `createTour.ts`). This is still a
 * PER-STEP wait, not a return to D23/D24: only the step being activated is ever waited for
 * (here, step 0), never the rest of the eligible steps up front. Both tests below stamp the
 * FIRST step's anchor into the DOM so that D43's wait resolves synchronously (no timer
 * involved), and leave every other step's anchor missing — proving the guarantee this file has
 * always been about: `start()` never waits for, or runs `before()` for, any step beyond the one
 * it is actually activating.
 *
 * This file asserts the guarantee D35+D43 together make: with several steps whose anchors are
 * missing (all but the first), `start()` resolves without ever advancing a fake timer — proven
 * below with fake timers (no timer is ever advanced) — and no step's `before()` has run except
 * the first eligible step's. Measured, not assumed: see the fake-timer assertions and the
 * literal `before()` call-order assertion in each test.
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
    // Three steps. Under D43 (this file's current contract — see the class doc comment above),
    // `start()` waits for the FIRST step's anchor (bounded by its own `waitForElementMs`) after
    // its `before()` and before `drive()` — so the first step's anchor is stamped into the DOM
    // up front here, resolving that wait SYNCHRONOUSLY, with zero timer involved. The other two
    // steps' anchors stay missing: D43 only ever waits for the step being ACTIVATED (first here,
    // or whichever step `transitionTo()` is moving to later) — never for steps further ahead,
    // which is exactly the guarantee this test still proves: no anchor wait for steps 2/3
    // happens inside `start()`, and the fake clock is never advanced.
    document.body.innerHTML = '<div data-tour="missing-1"></div>';
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

    // The critical measurement: `start()` must resolve WITHOUT this test ever CALLING a fake-
    // clock-advance API itself (no `vi.advanceTimersByTime`/`vi.runAllTimers`/
    // `vi.runOnlyPendingTimers` anywhere in this test). Under D35 there is no
    // `setInterval`/`setTimeout`-based ANCHOR wait left inside `start()` for any step beyond the
    // one it activates — the asynchronous work `start()` still does is `await
    // import('driver.js')` (a real, one-time module-loader macrotask, unrelated to anchors),
    // the first step's `before()`, and — under D50b — a real, time-separated rect-settle wait
    // (`waitForRectToSettle()`, ~50ms-interval polling, bounded to the step's own
    // `waitForElementMs` before `drive()` and to `D50_POST_MOVE_SETTLE_BUDGET_MS` (~400ms) right
    // after it) that DOES use a real `setTimeout` under the fake-timer installation from
    // `beforeEach()`. `vi.waitFor`/`vi.waitUntil` poll on REAL wall-clock time under the hood
    // for their own callback re-checks and, as an accepted side effect of that real-time
    // polling, nudge Sinon's installed fake clock forward by the same real elapsed amount (see
    // https://github.com/vitest-dev/vitest/pull/6802) — so a `setTimeout` scheduled against the
    // fake clock still eventually fires as real time passes, with NO test code ever calling an
    // explicit advance API. That is what both `vi.waitFor` calls below do: the fake clock is
    // never advanced BY THIS TEST, only nudged forward by vitest's own real-time polling
    // machinery — proving `start()`'s remaining awaits are driven by genuine timers, not a
    // resurrected anchor-polling loop this file exists to rule out.
    await vi.waitFor(
      () => {
        expect(tour.isActive()).toBe(true);
      },
      { timeout: 2000, interval: 5 },
    );

    // D50b: `start()` itself does not resolve until AFTER the post-drive settle wait
    // (`moveAndRefreshIfMoved()`, bounded to `D50_POST_MOVE_SETTLE_BUDGET_MS` ~400ms) completes
    // — `tour.isActive()` above already flips true earlier (synchronously inside `drive()`,
    // before that wait even starts), so a bare `await startPromise` right after would have
    // nothing left driving the fake clock forward and would hang. `vi.waitFor` here keeps
    // nudging the same fake clock via real-time polling until `startPromise` itself settles.
    await vi.waitFor(
      async () => {
        await startPromise;
      },
      { timeout: 2000, interval: 5 },
    );

    expect(tour.isActive()).toBe(true);

    tour.stop();
  });

  it('no step`s before() has run except the first eligible step`s, even though every anchor is missing', async () => {
    const callOrder: string[] = [];

    // Same D43 shape as the test above: the first step's anchor is stamped into the DOM so its
    // post-`before()` wait resolves synchronously; steps b/c stay missing, and nothing here
    // reaches them — `start()` only ever activates the first step.
    document.body.innerHTML = '<div data-tour="missing-a"></div>';
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

    // D50b: `start()` now includes a real, time-separated rect-settle wait after `drive()`
    // (`moveAndRefreshIfMoved()`, bounded to ~400ms) — a bare `await tour.start()` under the
    // fake timers this file installs would hang (nothing nudges the fake clock forward). Start
    // the call ONCE, then poll its settlement via `vi.waitFor`, whose own real-time polling
    // nudges the same fake clock forward as real time passes (see the longer comment on the
    // test above) — never calling `tour.start()` more than once.
    const startPromise = tour.start();
    await vi.waitFor(
      async () => {
        await startPromise;
      },
      { timeout: 2000, interval: 5 },
    );

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
