import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * B19 / D23 / D24 — "a tour with missing anchors costs ONE timeout window, not one per step".
 *
 * Same conventions as `keyboardNavigation.test.ts` / `closeAndOverlayDismissal.test.ts`: REAL
 * driver.js@1.8.0 against happy-dom, no mocks, `waitForOverlay()` polling (driver.js paints
 * inside `requestAnimationFrame`), plain `document.body.innerHTML` fixtures with `data-tour`
 * anchors, `localStorage.clear()` in `afterEach`, `@/` alias imports.
 *
 * Pre-fix (see the mutation check in the task report), `start()` awaited each step's
 * `before()` AND its anchor wait one step at a time, so N missing anchors cost N full timeout
 * windows, additive. Post-fix, `before()` hooks stay sequential and in declaration order
 * (D23); only the anchor WAIT is concurrent — each step's wait starts right after its own
 * `before()` runs, and all the waits are awaited together once every step's `before()` has
 * run. So N missing anchors now cost roughly ONE timeout window (the slowest single wait),
 * not their sum.
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

describe('createTour — concurrent anchor resolution (D23/D24, B19)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('resolves start() in roughly one timeout window, not the sum of every missing anchor timeout', async () => {
    // Three steps, none of their anchors ever appear in the DOM. Sequentially this would cost
    // 3 * 300ms = 900ms+ before `start()` resolves. Concurrently it should cost close to a
    // single 300ms window.
    const steps: TourStep[] = [
      { anchorKey: 'missing-1', popover: { title: 'Missing 1' }, waitForElementMs: 300 },
      { anchorKey: 'missing-2', popover: { title: 'Missing 2' }, waitForElementMs: 300 },
      { anchorKey: 'missing-3', popover: { title: 'Missing 3' }, waitForElementMs: 300 },
    ];

    const tour = createTour({
      tourId: 'concurrency-timing-tour',
      version: 1,
      storagePrefix: 'test:',
      steps,
    });

    const startedAt = Date.now();
    await tour.start();
    const elapsedMs = Date.now() - startedAt;

    // eslint-disable-next-line no-console -- surfaced deliberately: the task report must state
    // the literal measured value, not an invented one.
    console.log(`[B19 timing] elapsed=${elapsedMs}ms (sequential worst case would be ~900ms+)`);

    // Every anchor was missing with skipMissingElement defaulting to true, so no step survives
    // and the tour never starts (isActive() stays false) — that's fine, this case is only
    // about the elapsed time of start() itself.
    expect(elapsedMs).toBeLessThan(700);

    tour.stop();
  });

  it('runs before() hooks in declaration order even though the anchor waits are concurrent', async () => {
    document.body.innerHTML = '';
    const callOrder: string[] = [];

    const steps: TourStep[] = [
      {
        anchorKey: 'missing-a',
        popover: { title: 'A' },
        waitForElementMs: 50,
        before: async () => {
          callOrder.push('a');
        },
      },
      {
        anchorKey: 'missing-b',
        popover: { title: 'B' },
        waitForElementMs: 50,
        before: async () => {
          callOrder.push('b');
        },
      },
      {
        anchorKey: 'missing-c',
        popover: { title: 'C' },
        waitForElementMs: 50,
        before: async () => {
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

    expect(callOrder).toEqual(['a', 'b', 'c']);

    tour.stop();
  });

  it('keeps the final step order as declared, walking forward with ArrowRight', async () => {
    document.body.innerHTML =
      '<button data-tour="step-a">a</button><button data-tour="step-b">b</button><button data-tour="step-c">c</button>';

    const steps: TourStep[] = [
      { anchorKey: 'step-a', popover: { title: 'Step A' } },
      { anchorKey: 'step-b', popover: { title: 'Step B' } },
      { anchorKey: 'step-c', popover: { title: 'Step C' } },
    ];

    const tour = createTour({
      tourId: 'declared-order-tour',
      version: 1,
      storagePrefix: 'test:',
      steps,
    });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');

    const advance = () => {
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      window.dispatchEvent(event);
    };

    advance();
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step B');

    advance();
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step C');

    tour.stop();
  });

  it('resolves an anchor injected late — after other steps` before() hooks already ran, but within its own timeout', async () => {
    document.body.innerHTML = '<button data-tour="early">early</button>';

    const steps: TourStep[] = [
      { anchorKey: 'early', popover: { title: 'Early' } },
      {
        anchorKey: 'late',
        popover: { title: 'Late' },
        waitForElementMs: 400,
        before: async () => {
          // Inject the anchor for THIS step slightly after this before() runs, simulating a
          // slow-mounting UI element. Because the wait for this step starts right after this
          // before() (D23), and the timeout is 400ms measured from here (D24), 60ms later is
          // comfortably within the window.
          setTimeout(() => {
            const el = document.createElement('div');
            el.setAttribute('data-tour', 'late');
            document.body.appendChild(el);
          }, 60);
        },
      },
      { anchorKey: 'after-late', popover: { title: 'After Late' } },
    ];

    document.body.innerHTML += '<button data-tour="after-late">after-late</button>';

    const tour = createTour({
      tourId: 'late-anchor-tour',
      version: 1,
      storagePrefix: 'test:',
      steps,
    });

    await tour.start();
    await waitForOverlay();

    // All three steps survived, including the one whose anchor mounted late but within its
    // own timeout window.
    expect(popoverTitle()).toBe('Early');

    const advance = () => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }),
      );
    };
    advance();
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Late');

    advance();
    await flushMicrotasks();
    expect(popoverTitle()).toBe('After Late');

    tour.stop();
  });

  it('still drops a step whose anchor never appears, under the default skipMissingElement', async () => {
    document.body.innerHTML = '<button data-tour="present">present</button>';

    const steps: TourStep[] = [
      { anchorKey: 'present', popover: { title: 'Present' } },
      { anchorKey: 'never-appears', popover: { title: 'Never' }, waitForElementMs: 40 },
    ];

    const onEvent = vi.fn();
    const tour = createTour({
      tourId: 'default-skip-tour',
      version: 1,
      storagePrefix: 'test:',
      steps,
      onEvent,
    });

    await tour.start();
    await waitForOverlay();

    expect(tour.isActive()).toBe(true);
    // Only the surviving step counts towards totalSteps.
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tour_started', totalSteps: 1 }),
    );

    tour.stop();
  });

  it('does not wait at all when skipMissingElement is false, and keeps the step with the anchorKey fallback', async () => {
    document.body.innerHTML = '';

    const steps: TourStep[] = [
      {
        anchorKey: 'never-mounted',
        popover: { title: 'Fallback' },
        skipMissingElement: false,
        waitForElementMs: 5000,
      },
    ];

    const tour = createTour({
      tourId: 'no-skip-tour',
      version: 1,
      storagePrefix: 'test:',
      steps,
    });

    const startedAt = Date.now();
    await tour.start();
    const elapsedMs = Date.now() - startedAt;

    // skipMissingElement: false must resolve immediately (resolveAnchor only, no polling) even
    // though waitForElementMs is set to a large value — proving no wait happened.
    expect(elapsedMs).toBeLessThan(200);
    expect(tour.isActive()).toBe(true);

    tour.stop();
  });
});
