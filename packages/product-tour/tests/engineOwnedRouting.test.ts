import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * T7a — D44/D45/D45b/D47: the engine, not driver.js, owns Next/Done routing and step skipping.
 *
 * Before this task, driver.js@1.8.0's own `skipMissingElement`/`waitForElement` handling
 * (`F()`/`I()`/`L()`/`B()`/`m()`, all verified reading `dist/driver.js.mjs`) could unilaterally
 * decide — SYNCHRONOUSLY, at the instant a step tried to highlight — that "no further step is
 * reachable" and route a Next-button click into `onDoneClick` (ending and persisting the tour)
 * instead of this package's `onNextClick`, or silently hop past a missing-anchor step one index
 * at a time inside its own `m()`. Under D44 every `DriveStep` now fixes
 * `skipMissingElement: false` unconditionally, so driver.js itself can never again decide any of
 * that — `transitionTo()`/`start()` resolve the target index themselves (D45/D45b) via their own
 * candidate walk (`before()` + `waitForStepAnchor()` per candidate), and only ever call
 * `driverInstance.moveTo(index)`/`drive(index)` with an index the ENGINE already vetted.
 *
 * These tests are written to FAIL against the pre-T7a implementation (verified by restoring
 * `createTour.ts` from `git show a959d44:packages/product-tour/src/createTour.ts` and running
 * this file alone — see the task's DONE WHEN item 5). Same conventions as
 * `stepActivation.test.ts`/`waitForStepAnchor.test.ts`: real driver.js@1.8.0 against happy-dom,
 * no mocks, `@/` alias imports, `localStorage.clear()` in `afterEach`.
 */

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForOverlay(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (document.querySelector('.driver-overlay')) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function popoverTitle(): string | null | undefined {
  return document.querySelector('.driver-popover-title')?.textContent;
}

function clickNextButton() {
  const btn = document.querySelector('.driver-popover-next-btn');
  if (!(btn instanceof HTMLElement)) throw new Error('next button not found');
  btn.click();
}

/** Polls until `predicate()` is true or `timeoutMs` elapses. Never throws — the caller asserts. */
async function waitUntil(predicate: () => boolean, timeoutMs: number, intervalMs = 15): Promise<void> {
  const startedAt = Date.now();
  while (!predicate() && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

describe('createTour — the engine owns Next-button routing (T7a, D44/D45)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('(a) a Next-button CLICK on a step whose following anchors are all missing does not complete/destroy the tour — it advances to the step whose anchor DOES exist', async () => {
    // Three steps: "first" (anchor present), "missing-middle" (anchor never appears, short
    // budget), "third" (anchor present, further away). Pre-T7a, driver.js's own F()/I() would
    // decide — synchronously, the instant the Next click tried to route — that nothing forward
    // of "first" is reachable "yet" within its own retry loop and could end up calling
    // onDoneClick instead of this package's onNextClick, completing/destroying the tour instead
    // of landing on "third". Under D44/D45 that path is structurally impossible: the engine
    // itself walks candidates and lands on "third".
    document.body.innerHTML = '<button data-tour="first">first</button><button data-tour="third">third</button>';
    const onEvent = vi.fn();
    const log: string[] = [];
    const steps: TourStep[] = [
      { anchorKey: 'first', popover: { title: 'First' } },
      {
        anchorKey: 'missing-middle-1',
        popover: { title: 'Missing Middle 1' },
        waitForElementMs: 40,
        before: () => {
          log.push('before(missing-1)');
        },
      },
      {
        anchorKey: 'missing-middle-2',
        popover: { title: 'Missing Middle 2' },
        waitForElementMs: 40,
        before: () => {
          log.push('before(missing-2)');
        },
      },
      { anchorKey: 'third', popover: { title: 'Third' } },
    ];

    const tour = createTour({ tourId: 'next-click-skip-id', version: 1, storagePrefix: 'test:', steps, onEvent, forceAnimate: false });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('First');
    onEvent.mockClear();

    clickNextButton();
    await waitUntil(() => popoverTitle() === 'Third', 3000);

    expect(popoverTitle()).toBe('Third');
    expect(tour.isActive()).toBe(true);
    expect(document.querySelectorAll('.driver-popover').length).toBe(1);

    // Both consecutive missing-anchor candidates were individually evaluated by the ENGINE's
    // own walk (before() ran for each, so it could check each one's anchor in turn) — this is
    // only true when THIS PACKAGE is the one walking past them one at a time. Pre-T7a,
    // `transitionTo()` only ever ran `before()` for a single fixed `intendedIndex`
    // (`activeIndex + 1`) and relied on driver.js's OWN internal skip-hop to walk past any
    // FURTHER missing steps — that internal hop never calls this package's `TourStep.before()`
    // at all, so `before(missing-2)` would never have appeared in `log` pre-fix.
    expect(log).toContain('before(missing-1)');
    expect(log).toContain('before(missing-2)');

    // Neither tour_completed nor tour_dismissed may have fired for this click — it was a
    // genuine advance to a reachable step, not a termination.
    const completedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_completed');
    const dismissedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_dismissed');
    expect(completedCalls).toHaveLength(0);
    expect(dismissedCalls).toHaveLength(0);

    tour.stop();
  });
});

describe('createTour — the engine owns step skipping (T7a, D45)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('(b) a step whose anchor never appears within its own waitForElementMs is skipped WITHOUT running its after(), and the tour lands on the following step', async () => {
    // Two CONSECUTIVE missing-anchor steps between "first" and "third". This shape is the one
    // that actually distinguishes engine-owned skipping from driver.js's own: pre-T7a,
    // `transitionTo()` only ever ran `before()`/`waitForStepAnchor()` for a single fixed
    // `intendedIndex` (the immediate next one) and then relied on driver.js's OWN internal
    // skip-hop (`m()`, re-entering itself without the `retry` flag) to walk past any FURTHER
    // missing steps — that internal hop never calls `TourStep.before()`/`after()` for those
    // further steps at all. A lone missing step (this file's single-step variant) happens to
    // produce the same observable outcome under both the pre-fix reconciliation loop and the
    // post-fix engine walk, so it does not actually distinguish them — two consecutive missing
    // steps does.
    document.body.innerHTML = '<button data-tour="first">first</button><button data-tour="third">third</button>';
    const log: string[] = [];
    const steps: TourStep[] = [
      {
        anchorKey: 'first',
        popover: { title: 'First' },
        before: () => {
          log.push('before(first)');
        },
        after: () => {
          log.push('after(first)');
        },
      },
      {
        anchorKey: 'missing-middle-1',
        popover: { title: 'Missing Middle 1' },
        waitForElementMs: 40,
        before: () => {
          log.push('before(missing-1)');
        },
        after: () => {
          // Must NEVER run — this step is never activated, only evaluated and skipped.
          log.push('after(missing-1)');
        },
      },
      {
        anchorKey: 'missing-middle-2',
        popover: { title: 'Missing Middle 2' },
        waitForElementMs: 40,
        before: () => {
          log.push('before(missing-2)');
        },
        after: () => {
          // Must NEVER run — this step is never activated, only evaluated and skipped.
          log.push('after(missing-2)');
        },
      },
      {
        anchorKey: 'third',
        popover: { title: 'Third' },
        before: () => {
          log.push('before(third)');
        },
      },
    ];

    const tour = createTour({ tourId: 'engine-skip-no-after-id', version: 1, storagePrefix: 'test:', steps, forceAnimate: false });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('First');
    log.length = 0;

    clickNextButton();
    await waitUntil(() => popoverTitle() === 'Third', 3000);

    expect(popoverTitle()).toBe('Third');
    // Both skipped steps' before() DID run (the engine has to evaluate each candidate in turn
    // to know its anchor is missing) but neither's after() must ever run — neither was ever
    // activated.
    expect(log).toContain('before(missing-1)');
    expect(log).toContain('before(missing-2)');
    expect(log).not.toContain('after(missing-1)');
    expect(log).not.toContain('after(missing-2)');
    expect(log).toContain('before(third)');
    // after(first) ran exactly once (the outgoing step of the transition).
    expect(log.filter((entry) => entry === 'after(first)')).toHaveLength(1);

    tour.stop();
  });
});

describe('createTour — walking forward off the end completes the tour exactly once (T7a, D45)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('(c) advancing past the last activatable step emits tour_completed exactly once, persists completion, destroys the instance, and never also emits tour_dismissed', async () => {
    // Only "first" has a real anchor. "missing-1"/"missing-2" never appear and are skippable
    // (default skipMissingElement), so walking forward from "first" exhausts the array with
    // nothing left to land on — this is a genuine end-of-tour, not a dead middle step. TWO
    // consecutive missing steps (not one) so this test actually distinguishes the engine's own
    // walk from driver.js's internal skip-hop, same reasoning as test (b) above: pre-T7a,
    // `transitionTo()` only ran `before()` for the single fixed `intendedIndex` and then
    // depended on driver.js's own internal hop (which never calls `TourStep.before()`) to reach
    // the end — so `before(missing-2)` would never have appeared in `log` pre-fix.
    document.body.innerHTML = '<button data-tour="first">first</button>';
    const onEvent = vi.fn();
    const log: string[] = [];
    const steps: TourStep[] = [
      { anchorKey: 'first', popover: { title: 'First' } },
      {
        anchorKey: 'missing-1',
        popover: { title: 'Missing 1' },
        waitForElementMs: 30,
        before: () => {
          log.push('before(missing-1)');
        },
      },
      {
        anchorKey: 'missing-2',
        popover: { title: 'Missing 2' },
        waitForElementMs: 30,
        before: () => {
          log.push('before(missing-2)');
        },
      },
    ];

    const tour = createTour({
      tourId: 'walk-off-end-id',
      version: 5,
      storagePrefix: 'my-app:',
      steps,
      onEvent,
      forceAnimate: false,
    });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('First');
    onEvent.mockClear();

    clickNextButton();
    await waitUntil(() => tour.isActive() === false, 2000);

    expect(tour.isActive()).toBe(false);
    expect(document.querySelectorAll('.driver-popover').length).toBe(0);
    // Both trailing candidates were individually evaluated by the engine's own walk before it
    // concluded the direction was exhausted.
    expect(log).toContain('before(missing-1)');
    expect(log).toContain('before(missing-2)');

    const completedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_completed');
    expect(completedCalls).toHaveLength(1);
    const dismissedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_dismissed');
    expect(dismissedCalls).toHaveLength(0);

    const raw = localStorage.getItem('my-app:walk-off-end-id');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ seen: true, completed: true, version: 5 });
  });
});

describe('createTour — start() skips leading missing-anchor steps and drives the first activatable index (T7a, D45b)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('(d) start() with two missing leading anchors drives directly to the third (first activatable) step, without ever showing an orphan popover for the first two', async () => {
    document.body.innerHTML = '<button data-tour="third">third</button>';
    const log: string[] = [];
    const steps: TourStep[] = [
      {
        anchorKey: 'missing-1',
        popover: { title: 'Missing 1' },
        waitForElementMs: 30,
        before: () => {
          log.push('before(missing-1)');
        },
        after: () => {
          log.push('after(missing-1)');
        },
      },
      {
        anchorKey: 'missing-2',
        popover: { title: 'Missing 2' },
        waitForElementMs: 30,
        before: () => {
          log.push('before(missing-2)');
        },
        after: () => {
          log.push('after(missing-2)');
        },
      },
      {
        anchorKey: 'third',
        popover: { title: 'Third' },
        before: () => {
          log.push('before(third)');
        },
      },
    ];

    const onEvent = vi.fn();
    const tour = createTour({
      tourId: 'start-skip-leading-id',
      version: 1,
      storagePrefix: 'test:',
      steps,
      onEvent,
      forceAnimate: false,
    });

    await tour.start();
    await waitForOverlay();

    expect(popoverTitle()).toBe('Third');
    expect(tour.isActive()).toBe(true);
    // Both leading candidates were evaluated (before() ran, to check their anchors) but neither
    // was ever activated (after() must never run for a step the engine only skipped).
    expect(log).toContain('before(missing-1)');
    expect(log).toContain('before(missing-2)');
    expect(log).not.toContain('after(missing-1)');
    expect(log).not.toContain('after(missing-2)');
    expect(log).toContain('before(third)');

    // tour_step_viewed for the driven step must report index 2 (third), not 0.
    const viewedCalls = onEvent.mock.calls
      .map(([evt]) => evt)
      .filter((evt) => evt.event === 'tour_step_viewed');
    await waitUntil(() => viewedCalls.length > 0 || onEvent.mock.calls.some(([e]) => e.event === 'tour_step_viewed'), 1000);
    const allViewed = onEvent.mock.calls.map(([evt]) => evt).filter((evt) => evt.event === 'tour_step_viewed');
    expect(allViewed.length).toBeGreaterThan(0);
    expect(allViewed.at(-1)?.stepIndex).toBe(2);

    tour.stop();
  });

  it('(d.2) start() with EVERY anchor missing does not drive, does not claim completion, and leaves no Escape guard attached', async () => {
    document.body.innerHTML = '';
    const onEvent = vi.fn();
    const steps: TourStep[] = [
      { anchorKey: 'missing-1', popover: { title: 'Missing 1' }, waitForElementMs: 30 },
      { anchorKey: 'missing-2', popover: { title: 'Missing 2' }, waitForElementMs: 30 },
    ];

    const tour = createTour({
      tourId: 'start-nothing-activatable-id',
      version: 1,
      storagePrefix: 'test:',
      steps,
      onEvent,
      forceAnimate: false,
    });

    await tour.start();
    await flushMicrotasks();

    expect(tour.isActive()).toBe(false);
    expect(document.querySelectorAll('.driver-popover').length).toBe(0);

    // No completion, no dismissal — this run never activated anything, so it must not be
    // reported as either outcome.
    const completedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_completed');
    const dismissedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_dismissed');
    expect(completedCalls).toHaveLength(0);
    expect(dismissedCalls).toHaveLength(0);
    // persistence.markSeen must not have run either — this run never really "started".
    expect(localStorage.getItem('test:start-nothing-activatable-id')).toBeNull();

    // No leaked capture-phase Escape guard: dispatching Escape must not be intercepted (a
    // leaked guard would call driverInstance?.isActive() — false — and return early either
    // way, so the strongest observable proof is that a host listener still receives the key).
    const hostListener = vi.fn();
    window.addEventListener('keydown', hostListener);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(hostListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', hostListener);
  });
});
