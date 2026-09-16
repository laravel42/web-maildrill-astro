import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * D46 — "at most one step transition in flight per tour instance". The defect this closes:
 * `transitionTo()` is async (it awaits the outgoing step's `after()`, then each candidate's
 * `before()` + `waitForStepAnchor()`), and `driverInstance.getActiveIndex()` does not change
 * until it settles — so, before this fix, every further Next/Prev click or ArrowRight/ArrowLeft
 * press received while a transition is still suspended starts an INDEPENDENT walk from that
 * same stale index and eventually issues its own `moveTo()`, landing as a multi-step jump once
 * they all resolve.
 *
 * Same conventions as `keyboardNavigation.test.ts` / `stepActivation.test.ts`: REAL
 * driver.js@1.8.0 against happy-dom, no mocks, `waitForOverlay()` polling, plain
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
  return new Promise((resolve) => setTimeout(resolve, 80));
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

function clickNext(): void {
  const btn = document.querySelector('.driver-popover-next-btn') as HTMLElement | null;
  btn?.click();
}

function dispatchArrow(key: 'ArrowRight' | 'ArrowLeft', init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
}

/**
 * A gated `before()` for step B: does not resolve until `release()` is called, so a test can
 * hold a transition suspended for as long as it needs, deterministically (no `setTimeout` race).
 */
function makeGatedBefore() {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const before = vi.fn(() => gate);
  return { before, release: () => release() };
}

function fourStepFixtureWithGatedSecondStep() {
  document.body.innerHTML =
    '<button data-tour="a">a</button><button data-tour="b">b</button>' +
    '<button data-tour="c">c</button><button data-tour="d">d</button>';
  const gated = makeGatedBefore();
  const steps: TourStep[] = [
    { anchorKey: 'a', popover: { title: 'Step A' } },
    { anchorKey: 'b', popover: { title: 'Step B' }, before: gated.before },
    { anchorKey: 'c', popover: { title: 'Step C' } },
    { anchorKey: 'd', popover: { title: 'Step D' } },
  ];
  return { steps, gated };
}

describe('createTour — D46: at most one step transition in flight per tour instance', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('(a) three rapid Next clicks requested while the first is still suspended on a slow before() advance the tour exactly ONE step, not three', async () => {
    const { steps, gated } = fourStepFixtureWithGatedSecondStep();
    const tour = createTour({ tourId: 'inflight-next-clicks-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');

    // First Next click starts the transition to Step B; its before() is gated and will not
    // resolve until we call `gated.release()` below.
    clickNext();
    await flushMicrotasks();
    // Still on Step A — the transition is suspended on Step B's before().
    expect(popoverTitle()).toBe('Step A');

    // Two further rapid Next clicks while the first transition is still in flight: both must
    // be DROPPED, not queued.
    clickNext();
    clickNext();
    await flushMicrotasks();

    // Release the gate: the first (and only accepted) transition can now settle.
    gated.release();
    await flushMicrotasks();
    await flushMicrotasks();

    // Exactly one step forward — Step B — not a multi-step jump to C or D.
    expect(popoverTitle()).toBe('Step B');
    expect(gated.before).toHaveBeenCalledTimes(1);

    tour.stop();
  });

  it('(a-arrows) three rapid ArrowRight presses requested while the first is still suspended on a slow before() advance the tour exactly ONE step, not three', async () => {
    const { steps, gated } = fourStepFixtureWithGatedSecondStep();
    const tour = createTour({ tourId: 'inflight-arrow-presses-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');

    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step A');

    dispatchArrow('ArrowRight');
    dispatchArrow('ArrowRight');
    await flushMicrotasks();

    gated.release();
    await flushMicrotasks();
    await flushMicrotasks();

    expect(popoverTitle()).toBe('Step B');
    expect(gated.before).toHaveBeenCalledTimes(1);

    tour.stop();
  });

  it('(b) an ArrowRight dispatched while a transition is in flight is still consumed (stopPropagation/preventDefault) even though it does not navigate', async () => {
    const { steps, gated } = fourStepFixtureWithGatedSecondStep();
    const tour = createTour({ tourId: 'inflight-arrow-consumed-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();

    // Start the in-flight transition (A -> B, gated).
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step A');

    const hostListener = vi.fn();
    window.addEventListener('keydown', hostListener);

    // This press is dropped (no navigation) but must still be consumed: the host must never
    // see it, and its default must be prevented.
    const droppedEvent = dispatchArrow('ArrowRight');
    await flushMicrotasks();

    expect(hostListener, 'a dropped-while-in-flight arrow must not reach a host listener').not.toHaveBeenCalled();
    expect(droppedEvent.defaultPrevented).toBe(true);
    expect(popoverTitle()).toBe('Step A');

    window.removeEventListener('keydown', hostListener);
    gated.release();
    await flushMicrotasks();
    await flushMicrotasks();
    tour.stop();
  });

  it('(c) after the in-flight transition settles, a NEW arrow press navigates normally (the flag was released, navigation is not permanently frozen)', async () => {
    const { steps, gated } = fourStepFixtureWithGatedSecondStep();
    const tour = createTour({ tourId: 'inflight-release-arrow-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();

    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    // Dropped while in flight.
    dispatchArrow('ArrowRight');
    await flushMicrotasks();

    gated.release();
    await flushMicrotasks();
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step B');

    // A fresh press after settling must navigate normally — flag not stuck.
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step C');

    tour.stop();
  });

  it('(c-click) after the in-flight transition settles, a NEW Next click navigates normally', async () => {
    const { steps, gated } = fourStepFixtureWithGatedSecondStep();
    const tour = createTour({ tourId: 'inflight-release-click-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();

    clickNext();
    await flushMicrotasks();
    clickNext();
    await flushMicrotasks();

    gated.release();
    await flushMicrotasks();
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step B');

    clickNext();
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step C');

    tour.stop();
  });

  it('(d) Escape still closes the tour while a transition is in flight', async () => {
    const { steps, gated } = fourStepFixtureWithGatedSecondStep();
    const onEvent = vi.fn();
    const tour = createTour({ tourId: 'inflight-escape-id', version: 1, storagePrefix: 'test:', steps, onEvent });

    await tour.start();
    await waitForOverlay();

    // Start the in-flight transition (A -> B, gated) — never released in this test.
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step A');
    expect(tour.isActive()).toBe(true);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    window.dispatchEvent(escapeEvent);
    await flushMicrotasks();

    expect(tour.isActive(), 'Escape must close the tour even while a transition is in flight').toBe(false);
    expect(escapeEvent.defaultPrevented).toBe(true);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ event: 'tour_dismissed' }));

    // The gated before() never released — clean up the dangling promise reference (no
    // assertion needed; this just avoids leaving an unresolved gate referenced by nothing).
    gated.release();
  });

  it('a fresh start() resets the in-flight flag: a relaunched tour never inherits a stuck flag from the previous run', async () => {
    const { steps, gated } = fourStepFixtureWithGatedSecondStep();
    const tour = createTour({ tourId: 'inflight-fresh-start-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    await waitForOverlay();

    // Start a transition and leave it in flight (never release the gate) — then supersede this
    // run entirely with a fresh `start()` on the SAME `tourId` (LAST START WINS, D7).
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step A');

    const { steps: freshSteps, gated: freshGated } = fourStepFixtureWithGatedSecondStep();
    const relaunched = createTour({ tourId: 'inflight-fresh-start-id', version: 1, storagePrefix: 'test:', steps: freshSteps });
    await relaunched.start();
    await waitForOverlay();
    expect(relaunched.isActive()).toBe(true);
    expect(popoverTitle()).toBe('Step A');

    // The relaunched instance's own arrow navigation must work immediately — its
    // `transitionInFlight` was reset by its own `start()`, not left stuck by the previous run's
    // never-settled transition. This press starts a NEW in-flight transition (gated on the
    // fresh instance's own step B before()), proving the flag was not stuck `true`.
    dispatchArrow('ArrowRight');
    await flushMicrotasks();
    expect(freshGated.before).toHaveBeenCalledTimes(1);

    freshGated.release();
    await flushMicrotasks();
    await flushMicrotasks();
    expect(popoverTitle()).toBe('Step B');

    relaunched.stop();
    gated.release();
  });
});

