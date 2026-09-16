import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * T8 / D35 — "each step's before() runs when the tour reaches it, not at start()".
 *
 * This is the regression suite for the reported bug: opening the email editor tour immediately
 * opened the command palette / library drawer / inspector, because `start()` used to `await`
 * every eligible step's `before()` up front, before the first popover ever rendered. These
 * tests prove the fix directly against `createTour` with real driver.js@1.8.0 against
 * happy-dom (no mocks) — same conventions as `keyboardNavigation.test.ts` / `createTour.test.ts`:
 * `waitForOverlay()` polling (driver.js paints inside `requestAnimationFrame`), plain
 * `document.body.innerHTML` fixtures with `data-tour` anchors, `localStorage.clear()` in
 * `afterEach`, `@/` alias imports.
 */

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function waitForOverlay(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (document.querySelector('.driver-overlay')) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * Polls `onEvent` (a `vi.fn()` spy) for `tour_step_viewed` calls — `onHighlighted` (its source)
 * fires after driver.js paints, same timing reason `waitForOverlay()` polls rather than
 * assuming readiness once `start()`/an arrow dispatch resolves.
 */
async function waitForStepViewedEvents(
  onEvent: ReturnType<typeof vi.fn>,
): Promise<Array<{ event: string; stepIndex?: number }>> {
  for (let i = 0; i < 60; i++) {
    const viewed = (onEvent.mock.calls as Array<[{ event: string; stepIndex?: number }]>)
      .map(([evt]) => evt)
      .filter((evt) => evt.event === 'tour_step_viewed');
    if (viewed.length > 0) return viewed;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  return [];
}

function popoverTitle(): string | null | undefined {
  return document.querySelector('.driver-popover-title')?.textContent;
}

function dispatchArrow(key: 'ArrowRight' | 'ArrowLeft') {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

function clickNextButton() {
  const btn = document.querySelector('.driver-popover-next-btn');
  if (!(btn instanceof HTMLElement)) throw new Error('next button not found');
  btn.click();
}

function clickDoneButton() {
  const btn = document.querySelector('.driver-popover-next-btn.driver-popover-done-btn');
  if (!(btn instanceof HTMLElement)) throw new Error('done button not found');
  btn.click();
}

function clickPrevButton() {
  const btn = document.querySelector('.driver-popover-prev-btn');
  if (!(btn instanceof HTMLElement)) throw new Error('previous button not found');
  btn.click();
}

function loggingThreeStepFixture(log: string[]): TourStep[] {
  document.body.innerHTML =
    '<button data-tour="a">a</button><button data-tour="b">b</button><button data-tour="c">c</button>';
  return [
    {
      anchorKey: 'a',
      popover: { title: 'Step A' },
      before: () => {
        log.push('before(0)');
      },
      after: () => {
        log.push('after(0)');
      },
    },
    {
      anchorKey: 'b',
      popover: { title: 'Step B' },
      before: () => {
        log.push('before(1)');
      },
      after: () => {
        log.push('after(1)');
      },
    },
    {
      anchorKey: 'c',
      popover: { title: 'Step C' },
      before: () => {
        log.push('before(2)');
      },
      after: () => {
        log.push('after(2)');
      },
    },
  ];
}

describe('createTour — before() runs at step activation, not at start() (D35, T8 regression test)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('after start(), the log contains ONLY step 0`s before() — today (pre-fix) it would contain all three', async () => {
    const log: string[] = [];
    const steps = loggingThreeStepFixture(log);
    const tour = createTour({ tourId: 'activation-regression-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();

    expect(log).toEqual(['before(0)']);
    expect(popoverTitle()).toBe('Step A');

    tour.stop();
  });

  it('ArrowRight produces exactly after(0) then before(1), once each, in that order', async () => {
    const log: string[] = [];
    const steps = loggingThreeStepFixture(log);
    const tour = createTour({ tourId: 'activation-arrow-right-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    log.length = 0;

    dispatchArrow('ArrowRight');
    await flushMicrotasks();

    expect(log).toEqual(['after(0)', 'before(1)']);
    expect(popoverTitle()).toBe('Step B');

    tour.stop();
  });

  it('ArrowLeft from step 1 produces exactly after(1) then before(0), once each, in that order', async () => {
    const log: string[] = [];
    const steps = loggingThreeStepFixture(log);
    const tour = createTour({ tourId: 'activation-arrow-left-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step B');
    log.length = 0;

    dispatchArrow('ArrowLeft');
    await flushMicrotasks();

    expect(log).toEqual(['after(1)', 'before(0)']);
    expect(popoverTitle()).toBe('Step A');

    tour.stop();
  });

  it('clicking the popover`s Next button produces the same after()/before() pair — the global onNextClick path', async () => {
    const log: string[] = [];
    const steps = loggingThreeStepFixture(log);
    const tour = createTour({ tourId: 'activation-next-click-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    log.length = 0;

    clickNextButton();
    await flushMicrotasks();

    expect(log).toEqual(['after(0)', 'before(1)']);
    expect(popoverTitle()).toBe('Step B');

    tour.stop();
  });

  it('Escape mid-tour runs the current step`s after() exactly once, and tour_dismissed is emitted exactly once', async () => {
    const log: string[] = [];
    const steps = loggingThreeStepFixture(log);
    const onEvent = vi.fn();
    const tour = createTour({
      tourId: 'activation-escape-id',
      version: 1,
      storagePrefix: 'test:',
      steps,
      onEvent,
      forceAnimate: false,
    });

    await tour.start();
    await waitForOverlay();
    log.length = 0;
    onEvent.mockClear();

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await flushMicrotasks();

    expect(log).toEqual(['after(0)']);
    expect(tour.isActive()).toBe(false);

    const dismissedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_dismissed');
    expect(dismissedCalls).toHaveLength(1);
  });

  it('on the last step, Done still emits tour_completed exactly once, persists completion, closes the tour, and runs the last step`s after() exactly once', async () => {
    const log: string[] = [];
    const steps = loggingThreeStepFixture(log);
    const onEvent = vi.fn();
    const tour = createTour({
      tourId: 'activation-done-id',
      version: 3,
      storagePrefix: 'my-app:',
      steps,
      onEvent,
      forceAnimate: false,
    });

    await tour.start();
    await waitForOverlay();

    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step C');

    log.length = 0;
    onEvent.mockClear();

    clickDoneButton();
    await flushMicrotasks();

    expect(tour.isActive()).toBe(false);
    expect(document.querySelectorAll('.driver-popover').length).toBe(0);

    const completedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_completed');
    expect(completedCalls).toHaveLength(1);
    const dismissedCalls = onEvent.mock.calls.filter(([evt]) => evt.event === 'tour_dismissed');
    expect(dismissedCalls).toHaveLength(0);

    const raw = localStorage.getItem('my-app:activation-done-id');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ seen: true, completed: true, version: 3 });

    // The last step's after() ran exactly once (via onDeselected on destroy) — not zero, not
    // twice.
    expect(log).toEqual(['after(2)']);
  });

  it('a middle step whose anchor never exists is skipped, and the step the tour LANDS on has had its before() run (D35.5 reconciliation)', async () => {
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
        anchorKey: 'missing-middle',
        popover: { title: 'Missing Middle' },
        waitForElementMs: 40,
        before: () => {
          log.push('before(missing)');
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

    const tour = createTour({ tourId: 'activation-skip-id', version: 1, storagePrefix: 'test:', steps, forceAnimate: false });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('First');
    log.length = 0;

    dispatchArrow('ArrowRight');
    // Give driver.js's own waitForElement/MutationObserver+timeout enough real time to give up
    // on the missing anchor and skip forward on its own.
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Landed on "Third" — the missing-anchor step was skipped by driver.js itself.
    expect(popoverTitle()).toBe('Third');
    // The step the tour actually landed on (Third) had its before() run — via the
    // reconciliation path in transitionTo(): driver.js's getActiveIndex() didn't match the
    // intended index (1, the missing step) once the skip happened, so this package ran the
    // landed step's before() itself and called refresh(). This is the D35.5 guarantee this
    // test protects: a step reached by skipping still gets its precondition applied.
    expect(log).toContain('before(third)');
    // after(first) ran exactly once — the engine-driven transition handled it; onDeselected
    // must not have repeated it once driver.js's own skip-then-land sequence settled.
    expect(log.filter((entry) => entry === 'after(first)')).toHaveLength(1);

    tour.stop();
  });

  it('clicking the popover`s Previous button produces after(1) then before(0) — the global onPrevClick path', async () => {
    const log: string[] = [];
    const steps = loggingThreeStepFixture(log);
    const tour = createTour({ tourId: 'activation-prev-click-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    clickNextButton();
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step B');
    log.length = 0;

    clickPrevButton();
    await flushMicrotasks();

    expect(log).toEqual(['after(1)', 'before(0)']);
    expect(popoverTitle()).toBe('Step A');

    tour.stop();
  });

  it('ArrowLeft on the first step is a no-op: no after()/before() call, log stays empty', async () => {
    const log: string[] = [];
    const steps = loggingThreeStepFixture(log);
    const tour = createTour({ tourId: 'activation-arrow-left-noop-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    log.length = 0;

    dispatchArrow('ArrowLeft');
    await flushMicrotasks();

    expect(log).toEqual([]);
    expect(popoverTitle()).toBe('Step A');

    tour.stop();
  });

  it('ArrowRight on the last step is a no-op: no after()/before() call, log stays empty', async () => {
    const log: string[] = [];
    const steps = loggingThreeStepFixture(log);
    const tour = createTour({ tourId: 'activation-arrow-right-noop-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step C');
    log.length = 0;

    dispatchArrow('ArrowRight');
    await flushMicrotasks();

    expect(log).toEqual([]);
    expect(popoverTitle()).toBe('Step C');
    expect(tour.isActive()).toBe(true);

    tour.stop();
  });

  it('a full forward walk then backward walk runs before()/after() exactly once per transition, matching declared order both ways', async () => {
    const log: string[] = [];
    const steps = loggingThreeStepFixture(log);
    const tour = createTour({ tourId: 'activation-full-walk-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    expect(log).toEqual(['before(0)']);
    log.length = 0;

    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step C');
    expect(log).toEqual(['after(0)', 'before(1)', 'after(1)', 'before(2)']);

    log.length = 0;
    dispatchArrow('ArrowLeft');
    await flushMicrotasks();
    dispatchArrow('ArrowLeft');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step A');
    expect(log).toEqual(['after(2)', 'before(1)', 'after(1)', 'before(0)']);

    tour.stop();
  });

  it('anchors resolve lazily: a step whose anchor mounts only after start() (before its own activation) is still found when the tour reaches it', async () => {
    document.body.innerHTML = '<button data-tour="lazy-a">a</button><button data-tour="lazy-c">c</button>';
    const steps: TourStep[] = [
      { anchorKey: 'lazy-a', popover: { title: 'Lazy A' } },
      {
        anchorKey: 'lazy-b',
        popover: { title: 'Lazy B' },
        before: () => {
          // Mounted only once this step's before() runs — proving createTour never resolved
          // this anchor at configure/start time (it did not exist in the DOM until now).
          const el = document.createElement('button');
          el.setAttribute('data-tour', 'lazy-b');
          document.body.appendChild(el);
        },
      },
      { anchorKey: 'lazy-c', popover: { title: 'Lazy C' } },
    ];

    const tour = createTour({ tourId: 'activation-lazy-anchor-id', version: 1, storagePrefix: 'test:', steps });

    // Before start(), the second anchor genuinely does not exist — start() must not have
    // required it to exist (there is no start-time resolution under D35).
    expect(document.querySelector('[data-tour="lazy-b"]')).toBeNull();

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Lazy A');

    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    await waitForOverlay();
    for (let i = 0; i < 20 && popoverTitle() !== 'Lazy B'; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(popoverTitle()).toBe('Lazy B');
    expect(tour.isActive()).toBe(true);

    tour.stop();
  });

  // --- T8b — DEFECT 2 evidence + fix -----------------------------------------------------
  //
  // `tour_step_viewed` is emitted from driver.js's own `onHighlighted` hook, which hands back
  // a FRESH `{...step, popover: {...}}` clone of whatever this package put in `steps` (driver.js
  // never returns the same object identity) — so the pre-fix `driveSteps.indexOf(driveStep)`
  // in `start()` can never find a match and always returns -1. This block first proves that
  // empirically, then (after the fix) asserts the real index is reported.
  it('T8b (defect 2 proof + fix): tour_step_viewed carries the real zero-based stepIndex for the first step and after one ArrowRight', async () => {
    const steps = loggingThreeStepFixture([]);
    const onEvent = vi.fn();
    const tour = createTour({
      tourId: 'activation-step-viewed-index-id',
      version: 1,
      storagePrefix: 'test:',
      steps,
      onEvent,
    });

    await tour.start();
    await waitForOverlay();

    // `onHighlighted` (the source of `tour_step_viewed`) fires after driver.js paints, later
    // than the overlay node's own appearance — poll for the event itself (bounded, see
    // `waitForStepViewedEvents`) rather than assuming it has already landed once the overlay
    // exists or after a fixed delay.
    const viewedForFirstStep = await waitForStepViewedEvents(onEvent);
    expect(viewedForFirstStep.length).toBeGreaterThan(0);
    // Real index for the first step must be 0, not -1.
    const lastViewedFirstStep = viewedForFirstStep.at(-1);
    expect(lastViewedFirstStep?.stepIndex).toBe(0);

    onEvent.mockClear();
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    await waitForOverlay();

    const viewedForSecondStep = await waitForStepViewedEvents(onEvent);
    expect(viewedForSecondStep.length).toBeGreaterThan(0);
    // Real index for the step reached after one ArrowRight must be 1, not -1.
    const lastViewedSecondStep = viewedForSecondStep.at(-1);
    expect(lastViewedSecondStep?.stepIndex).toBe(1);

    tour.stop();
  });

  // --- T8b — DEFECT 1 fix: transition must not touch a destroyed tour --------------------
  //
  // Mechanism used here: a `window.addEventListener('unhandledrejection', ...)` spy installed
  // for the duration of the test. This proves that `void transitionTo(...)` — the call shape
  // every real caller uses (arrow keys, onNextClick/onPrevClick) — never produces an unhandled
  // promise rejection when the tour is destroyed (via Escape) while the transition is still
  // in flight, waiting on the incoming step's `before()`. It does NOT prove every possible
  // interleaving is safe (e.g. it does not exercise the D35.5 polling-loop interleaving
  // directly), only that this specific in-flight-before() interleaving settles cleanly. The
  // second assertion (the log staying exactly at `['before(1)']`, never gaining a `refresh`
  // or a second `before()` entry) proves the incoming step's before() effects are not re-run
  // or otherwise acted upon after the tour is gone.
  it('T8b (defect 1 fix): Escape while a transition`s incoming before() is still pending does not produce an unhandled rejection and does not act on the destroyed tour', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const log: string[] = [];
    let releaseIncomingBefore: (() => void) | undefined;
    const steps: TourStep[] = [
      {
        anchorKey: 'a',
        popover: { title: 'Step A' },
      },
      {
        anchorKey: 'b',
        popover: { title: 'Step B' },
        before: () =>
          new Promise<void>((resolve) => {
            releaseIncomingBefore = () => {
              log.push('before(1)');
              resolve();
            };
          }),
      },
    ];

    const tour = createTour({
      tourId: 'activation-escape-in-flight-id',
      version: 1,
      storagePrefix: 'test:',
      steps,
      forceAnimate: false,
    });

    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (event: Event) => {
      unhandledRejections.push(event);
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    try {
      await tour.start();
      await waitForOverlay();
      expect(popoverTitle()).toBe('Step A');

      // Kick off the ArrowRight transition — it will suspend on the incoming step's before(),
      // which we do not resolve yet.
      dispatchArrow('ArrowRight');
      await flushMicrotasks();
      expect(releaseIncomingBefore).toBeTypeOf('function');

      // Destroy the tour (Escape) while that before() is still pending.
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
      await flushMicrotasks();
      expect(tour.isActive()).toBe(false);

      // Now let the in-flight before() resolve, well after the tour is gone.
      releaseIncomingBefore?.();
      await flushMicrotasks();
      // Give any stray microtask/macrotask a chance to surface as an unhandled rejection.
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(unhandledRejections).toHaveLength(0);
      // The incoming before() itself still runs (its own promise is a normal resolution, not a
      // rejection) — that is expected and unavoidable since this test resolves it manually. What
      // must NOT happen is `transitionTo()` touching `driverInstance` afterwards. We cannot assert
      // "driverInstance is null" directly (private closure), so we assert observable proxies: the
      // tour stays inactive, no popover re-renders, and no second entry appears in `log` (which
      // would happen if refresh()/further hook logic ran after the fact).
      expect(tour.isActive()).toBe(false);
      expect(document.querySelectorAll('.driver-popover').length).toBe(0);
      expect(log).toEqual(['before(1)']);
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      tour.stop();
    }
  });

  // --- T8b — DEFECT 1 fix: the D35.5 reconciliation poll loop must also stop -------------
  //
  // Mechanism used here: same `window.addEventListener('unhandledrejection', ...)` spy as the
  // previous test, for the duration of this one. This exercises the OTHER interleaving Fix 1's
  // contract calls out explicitly: a transition into a step whose anchor never appears, so
  // `transitionTo()`'s D35.5 poll loop (`while (landedIndex === outgoingIndex && ...)`) is
  // actively sleeping on `setTimeout` when the tour is destroyed. It proves no unhandled
  // rejection surfaces from that loop's subsequent `driverInstance.getActiveIndex()` calls, and
  // — via the `before(missing-anchor-landing)` log staying absent — that the reconciliation
  // branch (which would call the landed step's `before()` then `driverInstance.refresh()`) never
  // runs for a tour that is already gone. It does NOT prove anything about interleavings other
  // than "destroy while this specific loop is polling".
  it('T8b (defect 1 fix): Escape while the D35.5 reconciliation poll loop is still running does not produce an unhandled rejection and does not reconcile a destroyed tour', async () => {
    document.body.innerHTML = '<button data-tour="only-anchor">only</button>';
    const log: string[] = [];
    const steps: TourStep[] = [
      {
        anchorKey: 'only-anchor',
        popover: { title: 'Only' },
      },
      {
        // This anchor never exists — driver.js's own waitForElement keeps retrying, so
        // `transitionTo()`'s reconciliation poll loop keeps sleeping/polling well past the
        // point where we destroy the tour.
        anchorKey: 'never-appears',
        popover: { title: 'Never' },
        waitForElementMs: 500,
        before: () => {
          log.push('before(never-appears-landing)');
        },
      },
    ];

    const tour = createTour({
      tourId: 'activation-escape-during-poll-id',
      version: 1,
      storagePrefix: 'test:',
      steps,
      forceAnimate: false,
    });

    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (event: Event) => {
      unhandledRejections.push(event);
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    try {
      await tour.start();
      await waitForOverlay();
      expect(popoverTitle()).toBe('Only');

      // Kick off the transition towards the step whose anchor never appears — this lands
      // `transitionTo()` in its reconciliation poll loop.
      dispatchArrow('ArrowRight');
      // Let the poll loop start (its own 10ms sleeps) but destroy well before its
      // `waitForElementMs` (500ms) budget would let driver.js itself give up and skip.
      await new Promise((resolve) => setTimeout(resolve, 40));

      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      );
      await flushMicrotasks();
      expect(tour.isActive()).toBe(false);

      // Wait comfortably past the step's `waitForElementMs` so the poll loop (if it were still
      // running against a destroyed instance) would have had every chance to throw.
      await new Promise((resolve) => setTimeout(resolve, 700));

      expect(unhandledRejections).toHaveLength(0);
      // The reconciliation branch's before() must never have run against the gone tour.
      expect(log).not.toContain('before(never-appears-landing)');
      expect(tour.isActive()).toBe(false);
      expect(document.querySelectorAll('.driver-popover').length).toBe(0);
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      tour.stop();
    }
  });
});
