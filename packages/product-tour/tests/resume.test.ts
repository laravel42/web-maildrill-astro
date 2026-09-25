import { describe, it, expect, afterEach, vi } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * resume.test.ts — end-to-end regression coverage for "el tour no persiste cuando se
 * queda a mitad del recorrido": `createTour`'s `start()` must resume from the last step
 * the user actually SAW (`persistence.lastStepIndex`, saved on every `onHighlighted`)
 * instead of always restarting at index 0, whenever the tour was seen but not completed
 * at the current version.
 *
 * `persistence.test.ts` already covers `saveProgress`/`read` in isolation, and
 * `useBuilder42Tour.autostart.test.ts` covers the pure `shouldAutoStartTour` eligibility
 * check — but neither exercises `createTour.ts`'s own `start()` end-to-end against real
 * driver.js. This file closes that gap: same conventions as `stepActivation.test.ts`
 * (`waitForOverlay()` polling, plain `data-tour` fixtures, `localStorage.clear()` in
 * `afterEach`, `@/` alias imports).
 */

async function waitForOverlay(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if (document.querySelector('.driver-overlay')) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 120));
}

async function waitForStepViewed(
  onEvent: ReturnType<typeof import('vitest').vi.fn>,
  stepIndex: number,
): Promise<void> {
  for (let i = 0; i < 60; i++) {
    const hit = (onEvent.mock.calls as Array<[{ event: string; stepIndex?: number }]>).some(
      ([evt]) => evt.event === 'tour_step_viewed' && evt.stepIndex === stepIndex,
    );
    if (hit) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

function popoverTitle(): string | null | undefined {
  return document.querySelector('.driver-popover-title')?.textContent;
}

function dispatchArrow(key: 'ArrowRight' | 'ArrowLeft') {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  window.dispatchEvent(event);
}

function threeStepFixture(): TourStep[] {
  document.body.innerHTML =
    '<button data-tour="a">a</button><button data-tour="b">b</button><button data-tour="c">c</button>';
  return [
    { anchorKey: 'a', popover: { title: 'Step A' } },
    { anchorKey: 'b', popover: { title: 'Step B' } },
    { anchorKey: 'c', popover: { title: 'Step C' } },
  ];
}

describe('createTour — resumes from lastStepIndex after an incomplete close (§ reanudación)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('re-mounting after Escape at step 1 resumes on step 1, not step 0', async () => {
    const tourId = 'resume-escape-id';
    const onEvent = vi.fn();

    const first = createTour({ tourId, version: 1, storagePrefix: 'test:', steps: threeStepFixture(), onEvent });
    await first.start();
    await waitForOverlay();
    await waitForStepViewed(onEvent, 0);
    expect(popoverTitle()).toBe('Step A');

    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    await waitForStepViewed(onEvent, 1);
    expect(popoverTitle()).toBe('Step B');

    // Simulates an accidental close (Escape) — this is what a real tab close/crash
    // skips entirely, but Escape at least goes through the same destroy path.
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(escape);
    await flushMicrotasks();
    expect(document.querySelector('.driver-overlay')).toBeNull();

    // Re-mount: brand-new `Tour` instance (like a fresh page load), same tourId/version,
    // same storagePrefix — reads back the SAME persisted state.
    document.body.innerHTML =
      '<button data-tour="a">a</button><button data-tour="b">b</button><button data-tour="c">c</button>';
    const second = createTour({ tourId, version: 1, storagePrefix: 'test:', steps: threeStepFixture() });
    await second.start();
    await waitForOverlay();

    expect(popoverTitle()).toBe('Step B');

    second.stop();
  });

  it('a tour that reached and completed the last step (Done) restarts from step 0 on a later start()', async () => {
    const tourId = 'resume-completed-id';
    const onEvent = vi.fn();

    const first = createTour({ tourId, version: 1, storagePrefix: 'test:', steps: threeStepFixture(), onEvent });
    await first.start();
    await waitForOverlay();
    await waitForStepViewed(onEvent, 0);

    dispatchArrow('ArrowRight');
    await waitForStepViewed(onEvent, 1);
    dispatchArrow('ArrowRight');
    await waitForStepViewed(onEvent, 2);
    expect(popoverTitle()).toBe('Step C');

    const doneBtn = document.querySelector('.driver-popover-next-btn.driver-popover-done-btn');
    expect(doneBtn).toBeInstanceOf(HTMLElement);
    (doneBtn as HTMLElement).click();
    await flushMicrotasks();
    expect(document.querySelector('.driver-overlay')).toBeNull();

    document.body.innerHTML =
      '<button data-tour="a">a</button><button data-tour="b">b</button><button data-tour="c">c</button>';
    const second = createTour({ tourId, version: 1, storagePrefix: 'test:', steps: threeStepFixture() });
    await second.start();
    await waitForOverlay();

    // Completed tours have no "progress to resume" — persistence.markCompleted() clears
    // lastStepIndex, so a later explicit start() (e.g. a manual "restart tour") begins at 0.
    expect(popoverTitle()).toBe('Step A');

    second.stop();
  });

  it('a fresh tour (never started) begins at step 0', async () => {
    const tour = createTour({
      tourId: 'resume-fresh-id',
      version: 1,
      storagePrefix: 'test:',
      steps: threeStepFixture(),
    });
    await tour.start();
    await waitForOverlay();

    expect(popoverTitle()).toBe('Step A');

    tour.stop();
  });
});
