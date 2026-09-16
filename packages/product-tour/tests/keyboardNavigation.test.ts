import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * B18 / D18 — "the engine owns the tour's keyboard, all of it": ArrowRight/ArrowLeft step
 * navigation, implemented in the SAME capture-phase `window` keydown handler that already
 * handles Escape. Same conventions as `closeAndOverlayDismissal.test.ts` /
 * `singleInstanceRegistry.test.ts`: REAL driver.js@1.8.0 against happy-dom, no mocks,
 * `waitForOverlay()` polling (driver.js paints inside `requestAnimationFrame`), plain
 * `document.body.innerHTML` fixtures with `data-tour` anchors, `localStorage.clear()` in
 * `afterEach`.
 */

/**
 * D50b: bumped from 0ms to comfortably exceed one `D50_SETTLE_SAMPLE_INTERVAL_MS` (~50ms) tick
 * in `createTour.ts`'s `waitForRectToSettle()`. Under D50b, a settle sample pair must be
 * separated in TIME (two synchronous reads are no longer accepted as evidence of anything — see
 * D50b in `createTour.ts`), so every step transition in this file now genuinely waits at least
 * one real ~50ms interval before `moveTo()`/`drive()` fires (the anchors here are never stubbed,
 * so happy-dom's all-zero `getBoundingClientRect()` settles on the FIRST time-separated sample —
 * still one real tick, not zero). A 0ms flush no longer reliably outlives that tick; this value
 * does, with margin for CI jitter.
 */
function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 120));
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

function dispatchArrow(key: 'ArrowRight' | 'ArrowLeft', init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
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

describe('createTour — ArrowRight/ArrowLeft step navigation, owned by the engine (D18)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('ArrowRight moves the active tour one step forward', async () => {
    const steps = threeStepFixture();
    const tour = createTour({ tourId: 'arrow-next-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    expect(tour.isActive()).toBe(true);
    expect(popoverTitle()).toBe('Step A');

    dispatchArrow('ArrowRight');
    await flushMicrotasks();

    expect(popoverTitle()).toBe('Step B');

    tour.stop();
  });

  it('ArrowLeft moves the active tour one step back', async () => {
    const steps = threeStepFixture();
    const tour = createTour({ tourId: 'arrow-prev-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step B');

    dispatchArrow('ArrowLeft');
    await flushMicrotasks();

    expect(popoverTitle()).toBe('Step A');

    tour.stop();
  });

  it('ArrowLeft on the first step is a no-op: tour stays active, index stays 0, no event emitted', async () => {
    const steps = threeStepFixture();
    const onEvent = vi.fn();
    const tour = createTour({ tourId: 'arrow-prev-noop-id', version: 1, storagePrefix: 'test:', steps, onEvent });

    await tour.start();
    await waitForOverlay();
    onEvent.mockClear();

    dispatchArrow('ArrowLeft');
    await flushMicrotasks();

    expect(tour.isActive()).toBe(true);
    expect(popoverTitle()).toBe('Step A');
    expect(onEvent).not.toHaveBeenCalled();

    tour.stop();
  });

  it('ArrowRight on the last step is a no-op: no tour_completed, no tour_dismissed, popover still mounted', async () => {
    const steps = threeStepFixture();
    const onEvent = vi.fn();
    const tour = createTour({ tourId: 'arrow-next-noop-id', version: 1, storagePrefix: 'test:', steps, onEvent });

    await tour.start();
    await waitForOverlay();

    // Walk to the last step first.
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step C');

    onEvent.mockClear();
    dispatchArrow('ArrowRight');
    await flushMicrotasks();

    expect(tour.isActive(), 'the tour must still be active — ArrowRight on the last step must not complete/dismiss/destroy it').toBe(true);
    expect(document.querySelectorAll('.driver-popover').length).toBe(1);
    expect(popoverTitle()).toBe('Step C');
    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'tour_completed' }));
    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'tour_dismissed' }));

    tour.stop();
  });

  it('the arrow is NOT consumed when a visible competing modal is open: the event propagates and the step index does not change', async () => {
    const steps = threeStepFixture();
    const tour = createTour({ tourId: 'arrow-competing-modal-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');

    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('role', 'dialog');
    document.body.appendChild(modal);

    const hostListener = vi.fn();
    window.addEventListener('keydown', hostListener);

    const event = dispatchArrow('ArrowRight');

    // The event was not stopped: a listener on window saw it (capture-phase guard yielded).
    expect(hostListener).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
    // The step did not change.
    expect(popoverTitle()).toBe('Step A');
    expect(tour.isActive()).toBe(true);

    window.removeEventListener('keydown', hostListener);
    tour.stop();
  });

  it('arrows are ignored when a modifier key is held (target not editable)', async () => {
    const steps = threeStepFixture();
    const tour = createTour({ tourId: 'arrow-modifier-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');

    const hostListener = vi.fn();
    window.addEventListener('keydown', hostListener);

    dispatchArrow('ArrowRight', { shiftKey: true });
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step A');
    expect(hostListener).toHaveBeenCalledTimes(1);

    dispatchArrow('ArrowRight', { ctrlKey: true });
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step A');

    dispatchArrow('ArrowRight', { altKey: true });
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step A');

    dispatchArrow('ArrowRight', { metaKey: true });
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step A');

    window.removeEventListener('keydown', hostListener);
    tour.stop();
  });

  it('arrows are ignored when the event target is an <input>', async () => {
    const steps = threeStepFixture();
    const input = document.createElement('input');
    document.body.appendChild(input);
    const tour = createTour({ tourId: 'arrow-input-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');

    const hostListener = vi.fn();
    window.addEventListener('keydown', hostListener);

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: input, enumerable: true });
    window.dispatchEvent(event);
    await flushMicrotasks();

    expect(popoverTitle()).toBe('Step A');
    expect(hostListener).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);

    window.removeEventListener('keydown', hostListener);
    tour.stop();
  });

  it('arrows are ignored when the event target is a <textarea>', async () => {
    const steps = threeStepFixture();
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const tour = createTour({ tourId: 'arrow-textarea-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: textarea, enumerable: true });
    window.dispatchEvent(event);
    await flushMicrotasks();

    expect(popoverTitle()).toBe('Step A');

    tour.stop();
  });

  it('arrows are ignored when the event target is a <select>', async () => {
    const steps = threeStepFixture();
    const select = document.createElement('select');
    document.body.appendChild(select);
    const tour = createTour({ tourId: 'arrow-select-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: select, enumerable: true });
    window.dispatchEvent(event);
    await flushMicrotasks();

    expect(popoverTitle()).toBe('Step A');

    tour.stop();
  });

  it('arrows are ignored when the event target is contenteditable', async () => {
    const steps = threeStepFixture();
    const editable = document.createElement('div');
    editable.contentEditable = 'true';
    document.body.appendChild(editable);
    const tour = createTour({ tourId: 'arrow-contenteditable-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();

    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: editable, enumerable: true });
    window.dispatchEvent(event);
    await flushMicrotasks();

    expect(popoverTitle()).toBe('Step A');

    tour.stop();
  });

  it('no arrow does anything when no tour is active', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const hostListener = vi.fn();
    window.addEventListener('keydown', hostListener);

    const rightEvent = dispatchArrow('ArrowRight');
    const leftEvent = dispatchArrow('ArrowLeft');

    expect(hostListener).toHaveBeenCalledTimes(2);
    expect(rightEvent.defaultPrevented).toBe(false);
    expect(leftEvent.defaultPrevented).toBe(false);
    expect(document.querySelectorAll('.driver-popover').length).toBe(0);

    window.removeEventListener('keydown', hostListener);
  });

  it('using getActiveIndex()/isLastStep() directly: full walk to the end, then ArrowLeft back to start, matches expected indices', async () => {
    const steps = threeStepFixture();
    const tour = createTour({ tourId: 'arrow-index-walk-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();

    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step C');

    dispatchArrow('ArrowLeft');
    await flushMicrotasks();
    dispatchArrow('ArrowLeft');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step A');

    tour.stop();
  });
});

