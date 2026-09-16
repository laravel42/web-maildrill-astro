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
});
