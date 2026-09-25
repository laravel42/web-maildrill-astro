import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * B16 / D15 — "every close path destroys the tour, and each close emits exactly one event".
 *
 * These tests exercise `onDestroyStarted` and `onDoneClick` through REAL DOM interactions
 * against the real `driver.js@1.8.0` package (no mocks — same setup as
 * `singleInstanceRegistry.test.ts`/`createTour.test.ts`): clicking driver.js's own
 * `.driver-popover-close-btn` and clicking its `.driver-overlay` path element, exactly the two
 * paths the task's e2e coverage exercises in the browser, reproduced here at the engine level
 * without Playwright.
 *
 * Pre-fix, both of these bit: driver.js hands the ENTIRE close responsibility to a configured
 * `onDestroyStarted` and does not tear down anything itself (verified by reading
 * `driver.js@1.8.0`'s `dist/driver.js.mjs`, function `h(e=!0)`: `if(e && a){ a(...); return }`).
 * The pre-fix `onDestroyStarted` in `createTour.ts` only emitted `tour_dismissed` and returned
 * — so `.driver-popover`/`.driver-overlay` stayed mounted and `isActive()` stayed `true`. The
 * commented-out failures below are what running this suite against that pre-fix code produced.
 */

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * driver.js paints its `.driver-overlay` SVG (and runs its highlight transition) inside a
 * `window.requestAnimationFrame` callback rather than synchronously during `drive()`/`m()` —
 * a bare `setTimeout(0)` microtask flush is not enough to observe it under happy-dom (verified
 * by execution: the overlay was absent after `flushMicrotasks()` alone, present after this).
 * `waitForOverlay()` polls briefly instead of hard-coding a duration.
 */
async function waitForOverlay(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (document.querySelector('.driver-overlay')) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function clickCloseButton() {
  const btn = document.querySelector('.driver-popover-close-btn');
  if (!(btn instanceof HTMLElement)) throw new Error('close button not found');
  btn.click();
}

function clickOverlay() {
  const path = document.querySelector('.driver-overlay path');
  if (!(path instanceof SVGPathElement)) throw new Error('overlay path not found');
  // driver.js's overlay click listener is registered for pointerdown/mousedown/pointerup/
  // mouseup/click (see `n()`/`e` in driver.js.mjs) and checks `t.target.tagName===\`path\`` —
  // a plain `click()` on the path element is enough to trigger it, same as a real pointer
  // click on the rendered overlay (no `force`, no synthetic coordinates needed at this layer).
  path.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('createTour — onDestroyStarted closes the tour (D15): the popover close button', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('clicking driver.js\'s own close button (×) destroys the instance and emits exactly ONE tour_dismissed', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const onEvent = vi.fn();
    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'A' } },
      { anchorKey: 'b', popover: { title: 'B' } },
    ];
    const tour = createTour({ tourId: 'close-btn-id', version: 1, storagePrefix: 'test:', steps, onEvent });

    await tour.start();
    await waitForOverlay();
    expect(tour.isActive()).toBe(true);
    expect(document.querySelectorAll('.driver-popover').length).toBe(1);
    expect(document.querySelectorAll('.driver-overlay').length).toBe(1);

    clickCloseButton();
    await flushMicrotasks();

    // Pre-fix (onDestroyStarted only emitted and returned, per the stale "re-entrancy" comment):
    // these three assertions failed —
    //   expect(received).toBe(false) // Object.is equality: isActive() stayed `true`
    //   expect(received).toBe(0)     // .driver-popover count stayed 1
    //   expect(received).toBe(0)     // .driver-overlay count stayed 1
    // — because driver.js had handed close responsibility to `onDestroyStarted` and nothing
    // ever called `destroy()`.
    expect(tour.isActive(), 'the tour is destroyed after the close button is clicked').toBe(false);
    expect(document.querySelectorAll('.driver-popover').length, 'popover removed').toBe(0);
    expect(document.querySelectorAll('.driver-overlay').length, 'overlay removed').toBe(0);

    // Exactly ONE tour_dismissed — not zero (pre-fix bug), not two (double-emission risk if
    // both onDestroyStarted and some other path fired for the same close).
    const dismissedCalls = onEvent.mock.calls.filter(
      ([evt]) => evt.event === 'tour_dismissed',
    );
    expect(dismissedCalls, 'exactly one tour_dismissed for this close').toHaveLength(1);
    const [dismissedCall] = dismissedCalls;
    expect(dismissedCall?.[0]).toMatchObject({
      event: 'tour_dismissed',
      tourId: 'close-btn-id',
      stepIndex: 0,
      totalSteps: 2,
    });
  });

  it('clicking the overlay (overlayClickBehavior: close) destroys the instance and emits exactly ONE tour_dismissed', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const onEvent = vi.fn();
    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'A' } },
      { anchorKey: 'b', popover: { title: 'B' } },
    ];
    const tour = createTour({ tourId: 'overlay-click-id', version: 1, storagePrefix: 'test:', steps, onEvent });

    await tour.start();
    await waitForOverlay();
    expect(tour.isActive()).toBe(true);
    expect(document.querySelectorAll('.driver-overlay').length).toBe(1);

    clickOverlay();
    await flushMicrotasks();

    // Pre-fix: identical failure mode to the close-button case above — the overlay click also
    // routes through `onDestroyStarted` (driver.js's `overlayClick` handler calls the same
    // internal `h()` teardown function with `e` defaulted to `true`), so it was broken the
    // same way: isActive() stayed true, popover/overlay counts stayed 1.
    expect(tour.isActive(), 'the tour is destroyed after the overlay is clicked').toBe(false);
    expect(document.querySelectorAll('.driver-popover').length, 'popover removed').toBe(0);
    expect(document.querySelectorAll('.driver-overlay').length, 'overlay removed').toBe(0);

    const dismissedCalls = onEvent.mock.calls.filter(
      ([evt]) => evt.event === 'tour_dismissed',
    );
    expect(dismissedCalls, 'exactly one tour_dismissed for this close').toHaveLength(1);
    const [dismissedCall] = dismissedCalls;
    expect(dismissedCall?.[0]).toMatchObject({
      event: 'tour_dismissed',
      tourId: 'overlay-click-id',
      stepIndex: 0,
      totalSteps: 2,
    });
  });

  it('closing on the LAST step via the close button does not emit tour_dismissed (matches the existing wasLastStep gating)', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const onEvent = vi.fn();
    const steps: TourStep[] = [{ anchorKey: 'a', popover: { title: 'Only step' } }];
    const tour = createTour({ tourId: 'close-btn-last-step-id', version: 1, storagePrefix: 'test:', steps, onEvent });

    await tour.start();
    expect(tour.isActive()).toBe(true);

    clickCloseButton();
    await flushMicrotasks();

    expect(tour.isActive()).toBe(false);
    expect(document.querySelectorAll('.driver-popover').length).toBe(0);
    const dismissedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_dismissed');
    expect(dismissedCalls, 'no dismissal reported when the close happens on the last step').toHaveLength(0);
  });
});

describe('createTour — Escape still emits exactly ONE tour_dismissed (not two) after the D15 fix', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('an Escape dismissal emits exactly one tour_dismissed and isActive() reads false afterwards', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const onEvent = vi.fn();
    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'A' } },
      { anchorKey: 'b', popover: { title: 'B' } },
    ];
    const tour = createTour({ tourId: 'escape-single-emit-id', version: 1, storagePrefix: 'test:', steps, onEvent });

    await tour.start();
    expect(tour.isActive()).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );

    expect(tour.isActive(), 'isActive() reads false after Escape').toBe(false);
    expect(document.querySelectorAll('.driver-popover').length).toBe(0);

    // The critical D15 invariant this test protects: our own capture-phase Escape guard
    // (`dismissActiveInstance()`) emits `tour_dismissed` and calls `destroy()`. Because
    // `stopPropagation()` runs in capture phase, driver.js's own (bubble-phase, unreachable)
    // Escape handler — which would otherwise also route through the now-destroying
    // `onDestroyStarted` — never sees the key. One close, one path, one event.
    const dismissedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_dismissed');
    expect(dismissedCalls, 'exactly one tour_dismissed for the Escape close — not two').toHaveLength(1);
    const [dismissedCall] = dismissedCalls;
    expect(dismissedCall?.[0]).toMatchObject({
      event: 'tour_dismissed',
      tourId: 'escape-single-emit-id',
      stepIndex: 0,
      totalSteps: 2,
    });
  });
});

describe('createTour — "Done" still emits only tour_completed, never tour_dismissed (D15)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('clicking the real Done button emits tour_completed and no tour_dismissed, and isActive() reads false', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const onEvent = vi.fn();
    const steps: TourStep[] = [{ anchorKey: 'a', popover: { title: 'Only step' } }];
    const tour = createTour({ tourId: 'done-no-dismiss-id', version: 1, storagePrefix: 'test:', steps, onEvent });

    await tour.start();
    expect(tour.isActive()).toBe(true);

    const doneBtn = document.querySelector('.driver-popover-next-btn.driver-popover-done-btn');
    if (!(doneBtn instanceof HTMLElement)) throw new Error('done button not found');
    doneBtn.click();
    await flushMicrotasks();

    expect(tour.isActive(), 'isActive() reads false after Done').toBe(false);
    expect(document.querySelectorAll('.driver-popover').length).toBe(0);

    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tour_completed', tourId: 'done-no-dismiss-id' }),
    );
    const dismissedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_dismissed');
    expect(dismissedCalls, 'Done must never also emit tour_dismissed').toHaveLength(0);
  });
});
