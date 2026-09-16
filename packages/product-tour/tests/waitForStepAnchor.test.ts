import { describe, it, expect, afterEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * T5 / D43 — "the engine waits for the incoming step's anchor after before(), and only then
 * tells driver.js to move." Forced by B34: `waitForElement` is dead config in driver.js@1.8.0
 * (never read anywhere in the bundle), so a `before()` that mounts UI asynchronously (opening a
 * panel, selecting a node) used to lose the race against driver.js's own synchronous highlight
 * attempt, and the step got skipped instantly.
 *
 * These tests exercise the wait itself — `waitForStepAnchor()` in `createTour.ts`, called from
 * exactly two places: `start()` (for the FIRST step, after its `before()`, before `drive()`) and
 * `transitionTo()` (for the INCOMING step of every later transition, after its `before()`,
 * before `moveNext()`/`movePrevious()`). Real driver.js@1.8.0 against happy-dom, no mocks, real
 * timers (the wait polls on real `setTimeout`, so fake timers would have to be driven manually —
 * these tests instead just let real time pass, same convention as `stepActivation.test.ts`).
 */

function popoverTitle(): string | null | undefined {
  return document.querySelector('.driver-popover-title')?.textContent;
}

async function waitForOverlay(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (document.querySelector('.driver-overlay')) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function dispatchArrow(key: 'ArrowRight' | 'ArrowLeft') {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  window.dispatchEvent(event);
  return event;
}

/** Polls until `predicate()` is true or `timeoutMs` elapses. Never throws — the caller asserts. */
async function waitUntil(predicate: () => boolean, timeoutMs: number, intervalMs = 20): Promise<void> {
  const startedAt = Date.now();
  while (!predicate() && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

describe('createTour — waitForStepAnchor (T5, D43)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('(a) the second step`s anchor, inserted ~150ms into its own before(), is waited for — the tour lands ON that step instead of being skipped and destroyed', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';

    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'Step A' } },
      {
        anchorKey: 'b',
        popover: { title: 'Step B' },
        waitForElementMs: 2000,
        before: () => {
          // Mounts its own anchor asynchronously, ~150ms after before() runs — simulating a
          // React panel that needs a tick (or several) to render before the DOM node exists.
          setTimeout(() => {
            const el = document.createElement('button');
            el.setAttribute('data-tour', 'b');
            el.textContent = 'b';
            document.body.appendChild(el);
          }, 150);
        },
      },
    ];

    const tour = createTour({ tourId: 'd43-late-anchor-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');

    dispatchArrow('ArrowRight');

    // Without D43, driver.js would try to highlight step B synchronously (anchor missing at
    // that instant), skip it via `skipMissingElement`, run out of eligible steps, and the tour
    // would call `onDoneClick` — destroying itself and marking the tour completed. Proving the
    // fix means proving BOTH that the tour is still alive with step B showing, AND that it never
    // transiently completed on the way there.
    await waitUntil(() => popoverTitle() === 'Step B', 2000);

    expect(tour.isActive()).toBe(true);
    expect(popoverTitle()).toBe('Step B');
    expect(document.querySelector('.driver-popover')).not.toBeNull();

    tour.stop();
  });

  it('(b) an anchor that never appears, with waitForElementMs: 60, is still skipped and does not hang the tour', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="c">c</button>';

    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'Step A' } },
      { anchorKey: 'never-appears', popover: { title: 'Step Never' }, waitForElementMs: 60 },
      { anchorKey: 'c', popover: { title: 'Step C' } },
    ];

    const tour = createTour({ tourId: 'd43-never-appears-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');

    const startedAt = Date.now();
    dispatchArrow('ArrowRight');

    // D43's wait for the missing step is bounded by ITS OWN waitForElementMs (60ms) — the
    // reconciliation loop in transitionTo() (D35.5) then observes driver.js skip forward to step
    // C on its own. The whole thing must settle well under a naive "it just hangs" timeout.
    await waitUntil(() => popoverTitle() === 'Step C', 2000);
    const elapsedMs = Date.now() - startedAt;

    expect(popoverTitle()).toBe('Step C');
    expect(tour.isActive()).toBe(true);
    // Generous upper bound — proves this settles in roughly the 60ms window plus reconciliation
    // polling, not some unrelated multi-second stall.
    expect(elapsedMs).toBeLessThan(1500);

    tour.stop();
  });

  it('(c) the first step`s anchor, inserted ~100ms after start(), is waited for — the tour shows it instead of finding nothing to drive', async () => {
    document.body.innerHTML = '';

    const steps: TourStep[] = [
      {
        anchorKey: 'first',
        popover: { title: 'Step First' },
        waitForElementMs: 2000,
        before: () => {
          setTimeout(() => {
            const el = document.createElement('button');
            el.setAttribute('data-tour', 'first');
            el.textContent = 'first';
            document.body.appendChild(el);
          }, 100);
        },
      },
    ];

    const tour = createTour({ tourId: 'd43-first-step-late-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();

    await waitUntil(() => popoverTitle() === 'Step First', 2000);

    expect(tour.isActive()).toBe(true);
    expect(popoverTitle()).toBe('Step First');

    tour.stop();
  });
});
