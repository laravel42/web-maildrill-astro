import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * T11 / D50 — "an anchor is not 'ready' when it exists, it is ready when its rect has STOPPED
 * MOVING, and the engine must check that on both sides of the move."
 *
 * The defect this closes (B46, measured in a real browser by the orchestrator): a step whose
 * `before()` changes what the target panel renders (switching a tab, selecting a node) could
 * have its anchor resolve — `resolveAnchor()` finds the element — while it is still sitting at
 * the OUTGOING panel's layout position, one frame before React commits the removal and the
 * anchor jumps to its real position. `waitForStepAnchor()` used to resolve the INSTANT the
 * element existed, so driver.js drew its stage against the stale rect, and nothing ever
 * recomputed it afterwards.
 *
 * D50 has two halves, both exercised here directly against real driver.js@1.8.0 + happy-dom —
 * same conventions as `waitForStepAnchor.test.ts` / `transitionInFlight.test.ts`: real timers,
 * `data-tour` fixtures, `@/` alias imports. The only deviation from those files' convention is
 * `vi.mock('driver.js', ...)` (spy-through-real-implementation, via `importActual`) used ONLY in
 * (c)/(d) below to get an observable seam on `refresh()` call counts — driver.js returns a fresh
 * plain closure object per `driver()` call with no shared prototype (verified reading
 * `driver.js@1.8.0`'s bundle: `refresh:()=>X(t)`), so there is no other way to count invocations
 * without either modifying `createTour.ts` (out of scope) or mocking the module.
 *
 *   (a) BEFORE the move: an anchor whose `getBoundingClientRect()` reports a MOVING rect for the
 *       first few samples and then settles is not handed to `moveTo()`/`drive()` until it has
 *       settled — asserted on the observable order: the tour lands correctly on the step and the
 *       rect was sampled multiple times (existence + settle), not just once.
 *   (b) The settle wait is charged against `waitForElementMs` — an anchor that never stops
 *       moving still resolves (with whatever it has) and the tour still advances rather than
 *       hanging.
 *   (c) An anchor that moves AFTER the move triggers exactly one `driverInstance.refresh()`.
 *   (d) An anchor that does NOT move after the move triggers NO `refresh()` (no gratuitous
 *       refresh on the common case).
 *
 * `getBoundingClientRect` is stubbed directly on the test's anchor elements to drive (a)-(d) —
 * legitimate here since the real defect is precisely about what that method returns over time
 * (happy-dom's real implementation always returns all-zero rects, which would make every one of
 * these scenarios trivially indistinguishable from "already settled").
 */

vi.mock('driver.js', async () => {
  const actual = await vi.importActual<typeof import('driver.js')>('driver.js');
  return {
    ...actual,
    driver: (config?: Parameters<typeof actual.driver>[0]) => {
      const instance = actual.driver(config);
      refreshSpies.push(vi.spyOn(instance, 'refresh'));
      // Wrap (rather than replace) `moveTo`/`drive` so tests can observe what was true AT THE
      // INSTANT the real call happens, while still letting the real driver.js implementation
      // run — `vi.spyOn(...).mockImplementation()` would otherwise have to manually forward to
      // the original, which needs to be captured before any test overwrites it.
      const realMoveTo = instance.moveTo.bind(instance);
      const moveToSpy = vi.fn((index: number) => {
        onMoveToCallbacks.forEach((cb) => cb(index));
        return realMoveTo(index);
      });
      instance.moveTo = moveToSpy;
      moveToSpies.push(moveToSpy);

      const realDrive = instance.drive.bind(instance);
      const driveSpy = vi.fn((index?: number) => {
        onDriveCallbacks.forEach((cb) => cb(index));
        return realDrive(index);
      });
      instance.drive = driveSpy;
      driveSpies.push(driveSpy);

      return instance;
    },
  };
});

/** Populated by the `driver.js` mock above — one spy per `driver()` call, in creation order. */
let refreshSpies: ReturnType<typeof vi.spyOn>[] = [];
/** Same, for `moveTo()` — used by (a) to read the anchor's rect at the exact moment it is called. */
let moveToSpies: ReturnType<typeof vi.fn>[] = [];
/** Same, for `drive()` — used by (e), the first-step equivalent of `moveTo()`. */
let driveSpies: ReturnType<typeof vi.fn>[] = [];
/** Callbacks invoked synchronously, in registration order, right before the REAL `moveTo()` runs. */
let onMoveToCallbacks: Array<(index: number) => void> = [];
/** Callbacks invoked synchronously, in registration order, right before the REAL `drive()` runs. */
let onDriveCallbacks: Array<(index: number | undefined) => void> = [];

async function waitForOverlay(): Promise<void> {
  for (let i = 0; i < 40; i++) {
    if (document.querySelector('.driver-overlay')) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function waitUntil(predicate: () => boolean, timeoutMs: number, intervalMs = 20): Promise<void> {
  const startedAt = Date.now();
  while (!predicate() && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
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

interface StubRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rect(x: number, y: number, width = 100, height = 40): StubRect {
  return { x, y, width, height };
}

/**
 * Stubs `element.getBoundingClientRect` to return, in order, one value per call from `sequence`
 * — the LAST value repeats forever once the sequence is exhausted (so a settle check that keeps
 * sampling after the scripted moves still gets a stable final answer, same shape a real layout
 * settle would have). Returns a spy so tests can assert call counts if useful.
 */
function stubRectSequence(element: Element, sequence: StubRect[]) {
  let callIndex = 0;
  const fn = vi.fn(() => {
    const value = sequence[Math.min(callIndex, sequence.length - 1)] ?? sequence[sequence.length - 1];
    callIndex += 1;
    if (!value) throw new Error('stubRectSequence requires a non-empty sequence');
    return { ...value, top: value.y, left: value.x, right: value.x + value.width, bottom: value.y + value.height, toJSON: () => ({}) } as DOMRect;
  });
  (element as unknown as { getBoundingClientRect: typeof fn }).getBoundingClientRect = fn;
  return fn;
}

/** Stubs `element.getBoundingClientRect` to always return the SAME rect (never moves). */
function stubStaticRect(element: Element, value: StubRect) {
  return stubRectSequence(element, [value]);
}

describe('createTour — anchor rect settling (T11, D50)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    refreshSpies = [];
    moveToSpies = [];
    driveSpies = [];
    onMoveToCallbacks = [];
    onDriveCallbacks = [];
  });

  it('(a) an anchor whose rect moves for the first few samples and then settles is not handed to the move until settled', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const anchorB = document.querySelector('[data-tour="b"]') as HTMLElement;

    // The rect "moves" for the first two samples (simulating the outgoing panel still mounted
    // below the real position), then settles at y=10 forever after. waitForRectToSettle() takes
    // an initial pair of back-to-back samples (no delay) as its first comparison, then falls
    // back to ~50ms-interval polling once it sees a mismatch — so this sequence must disagree
    // on that very first pair to force the polling path, then agree from some point onward.
    const rectSpy = stubRectSequence(anchorB, [
      rect(0, 200), // sample 1 (synchronous pair)
      rect(0, 140), // sample 2 (synchronous pair) — disagrees with sample 1, forces polling
      rect(0, 80), // polling sample — still moving
      rect(0, 10), // polling sample — settled from here on
      rect(0, 10),
      rect(0, 10),
      rect(0, 10),
    ]);

    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'Step A' } },
      { anchorKey: 'b', popover: { title: 'Step B' }, waitForElementMs: 2000 },
    ];

    const tour = createTour({ tourId: 'd50-settle-then-move-id', version: 1, storagePrefix: 'test:', steps });
    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');
    expect(moveToSpies).toHaveLength(1);
    const moveToSpy = moveToSpies[0];
    if (!moveToSpy) throw new Error('expected a moveTo spy to have been registered');

    // Record the anchor's rect value AT THE INSTANT `moveTo()` is invoked — the observable proof
    // that the engine did not hand the anchor over while it was still mid-move. Without D50, the
    // very first successful `resolveAnchor()` inside `waitForStepAnchor()` resolves immediately,
    // so `moveTo()` fires while the rect is still `y=200` (sample 1) — the stale value. With
    // D50's settle wait, `moveTo()` must not fire until the rect has stopped moving (`y=10`).
    let rectAtMoveToCall: unknown;
    onMoveToCallbacks.push(() => {
      rectAtMoveToCall = anchorB.getBoundingClientRect();
    });

    dispatchArrow('ArrowRight');
    await waitUntil(() => moveToSpy.mock.calls.length > 0, 2000);

    expect(moveToSpy).toHaveBeenCalledTimes(1);
    expect(rectAtMoveToCall).toMatchObject({ y: 10 });

    await waitUntil(() => popoverTitle() === 'Step B', 2000);
    expect(popoverTitle()).toBe('Step B');
    // Proof the engine actually sampled the rect multiple times (existence + settle), not just
    // once at "exists" — the pre-D50 behaviour would have called getBoundingClientRect at most
    // once (or zero times) before handing the anchor to moveTo().
    expect(rectSpy.mock.calls.length).toBeGreaterThanOrEqual(4);

    tour.stop();
  });

  it('(b) the settle wait is charged against waitForElementMs: an anchor that never stops moving still resolves and the tour still advances rather than hanging', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const anchorB = document.querySelector('[data-tour="b"]') as HTMLElement;

    // Never settles: every sample disagrees with the previous one (alternating between two
    // positions), forever. A distinct rect per call, with a fresh object each time.
    let toggle = 0;
    (anchorB as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = vi.fn(() => {
      toggle += 1;
      const y = toggle % 2 === 0 ? 10 : 500;
      const value = rect(0, y);
      return { ...value, top: value.y, left: value.x, right: value.x + value.width, bottom: value.y + value.height, toJSON: () => ({}) } as DOMRect;
    });

    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'Step A' } },
      { anchorKey: 'b', popover: { title: 'Step B' }, waitForElementMs: 150 },
    ];

    const tour = createTour({ tourId: 'd50-never-settles-id', version: 1, storagePrefix: 'test:', steps });
    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');

    const startedAt = Date.now();
    dispatchArrow('ArrowRight');
    await waitUntil(() => popoverTitle() === 'Step B', 2000);
    const elapsedMs = Date.now() - startedAt;

    // The tour advanced anyway (never hung) — this is the core assertion.
    expect(popoverTitle()).toBe('Step B');
    expect(tour.isActive()).toBe(true);
    // D50: the settle wait is charged against the step's OWN waitForElementMs (150ms) — it must
    // actually spend close to that budget polling for a rect that never stops moving (proving
    // the settle loop ran to its deadline) rather than resolving near-instantly, which is what
    // the pre-D50 baseline does (no settle check exists, so it advances the moment the element
    // is found, regardless of how the stubbed rect behaves).
    expect(elapsedMs).toBeGreaterThanOrEqual(120);
    // Bounded by the step's own waitForElementMs (150ms) plus reconciliation/polling overhead —
    // generous upper bound, proves this settles quickly rather than stalling for seconds.
    expect(elapsedMs).toBeLessThan(1500);

    tour.stop();
  });

  it('(c) an anchor that moves AFTER the move triggers exactly one refresh() for that move — on top of the unconditional refresh already fired for the FIRST step`s drive()', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const anchorB = document.querySelector('[data-tour="b"]') as HTMLElement;

    // Settled (two equal samples) BEFORE the move: the pre-move settle check (samples 1-2, both
    // inside `waitForStepAnchor()`) must see a stable rect at y=10 so it resolves immediately
    // without polling. Sample 3 is `moveAndRefreshIfMoved()`'s own `beforeMoveRect` capture,
    // taken right before calling `move()` — still y=10, matching the settled value. From sample
    // 4 onward (the post-move re-sampling, inside `waitForRectToSettle()` and the final
    // `afterMoveRect` read) the rect has moved to y=60 and stays there — simulating driver.js
    // itself shifting the element after drawing the stage (e.g. its own scroll adjustment).
    let sampleCount = 0;
    (anchorB as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = vi.fn(() => {
      sampleCount += 1;
      const value = sampleCount <= 3 ? rect(0, 10) : rect(0, 60);
      return { ...value, top: value.y, left: value.x, right: value.x + value.width, bottom: value.y + value.height, toJSON: () => ({}) } as DOMRect;
    });

    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'Step A' } },
      { anchorKey: 'b', popover: { title: 'Step B' }, waitForElementMs: 2000 },
    ];

    const tour = createTour({ tourId: 'd50-post-move-refresh-id', version: 1, storagePrefix: 'test:', steps });
    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');
    expect(refreshSpies).toHaveLength(1);
    const refreshSpy = refreshSpies[0];
    // D50b: `refresh()` is now UNCONDITIONAL at every `moveAndRefreshIfMoved()` call site,
    // including the first-step `drive()` in `start()` — so by the time Step A's popover has
    // painted, exactly one `refresh()` has already fired for that first-step drive, whether or
    // not anchor A's rect ever moved (it did not; anchor A is never stubbed in this test).
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    dispatchArrow('ArrowRight');
    await waitUntil(() => popoverTitle() === 'Step B', 2000);
    // Give the post-move settle window (bounded ~400ms) time to run to completion.
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(popoverTitle()).toBe('Step B');
    expect(tour.isActive()).toBe(true);
    // D50b: two calls total — one already fired for the first step's drive() (asserted above),
    // one for this move (the anchor DID move here, so this call was always expected — but the
    // count must be exactly 2, not 1, now that the first-step drive() call site also refreshes).
    expect(refreshSpy).toHaveBeenCalledTimes(2);

    tour.stop();
  });

  it('(d) an anchor that does NOT move after the move still gets its refresh() — D50b made this unconditional', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const anchorB = document.querySelector('[data-tour="b"]') as HTMLElement;

    // Perfectly static for every sample, before AND after the move.
    stubStaticRect(anchorB, rect(0, 10));

    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'Step A' } },
      { anchorKey: 'b', popover: { title: 'Step B' }, waitForElementMs: 2000 },
    ];

    const tour = createTour({ tourId: 'd50-no-move-no-refresh-id', version: 1, storagePrefix: 'test:', steps });
    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');
    expect(refreshSpies).toHaveLength(1);
    const refreshSpy = refreshSpies[0];
    // D50b: the first-step drive() in start() already fired its own unconditional refresh() by
    // this point, whether or not anchor A ever moved (it did not; anchor A is never stubbed).
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    dispatchArrow('ArrowRight');
    await waitUntil(() => popoverTitle() === 'Step B', 2000);
    // Give the post-move settle window time to run — since the rect never changes, refresh()
    // must never be called.
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(popoverTitle()).toBe('Step B');
    expect(tour.isActive()).toBe(true);
    // D50b: refresh() is now unconditional at the moveTo() call site too — the rect never
    // changed here, but it must STILL have been called once for this move, on top of the one
    // already fired for the first step's drive() — two calls total, never zero.
    expect(refreshSpy).toHaveBeenCalledTimes(2);

    tour.stop();
  });

  it('(e) the tour`s very first popover (start(), not transitionTo()) also gets the settle treatment before driving', async () => {
    document.body.innerHTML = '<button data-tour="first">first</button>';
    const anchorFirst = document.querySelector('[data-tour="first"]') as HTMLElement;

    const rectSpy = stubRectSequence(anchorFirst, [
      rect(0, 300),
      rect(0, 150), // disagrees with the first sample -> forces polling
      rect(0, 20),
      rect(0, 20),
      rect(0, 20),
    ]);

    const steps: TourStep[] = [{ anchorKey: 'first', popover: { title: 'Step First' }, waitForElementMs: 2000 }];

    const tour = createTour({ tourId: 'd50-first-step-settle-id', version: 1, storagePrefix: 'test:', steps });

    // Record the anchor's rect value AT THE INSTANT `drive()` is invoked — same proof as (a),
    // for the FIRST step's entry point (`start()` calls `drive()`, not `moveTo()`). Without D50,
    // `start()`'s D45b walker resolves the moment `resolveAnchor()` finds the element, so
    // `drive()` fires while the rect is still `y=300` (sample 1) — the stale value.
    let rectAtDriveCall: unknown;
    onDriveCallbacks.push(() => {
      rectAtDriveCall = anchorFirst.getBoundingClientRect();
    });

    await tour.start();

    expect(driveSpies).toHaveLength(1);
    expect(driveSpies[0]).toHaveBeenCalledTimes(1);
    expect(rectAtDriveCall).toMatchObject({ y: 20 });

    await waitUntil(() => popoverTitle() === 'Step First', 2000);

    expect(tour.isActive()).toBe(true);
    expect(popoverTitle()).toBe('Step First');
    expect(rectSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    tour.stop();
  });

  it('(f) D50b: two getBoundingClientRect() reads taken in the SAME task (no real delay between them) must NOT be accepted as "settled" — a real navigator never gives two same-task reads that legitimately differ, so the engine may not trust that comparison; only a TIME-SEPARATED pair may resolve the wait', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const anchorB = document.querySelector('[data-tour="b"]') as HTMLElement;

    // Keyed off ELAPSED WALL-CLOCK TIME, not call count — this is the crux of the D50b fix.
    // Before ~120ms of real elapsed time since the stub was installed, every read reports
    // y=500 (mid-move); from ~120ms onward it reports the settled value y=10 forever after.
    // Two reads taken back-to-back in the SAME synchronous task (no `await` between them) can
    // NEVER straddle that 120ms boundary in a way that matters here: either both land before it
    // (both y=500 — happens to "agree", but for the wrong reason: nothing was actually measured
    // moving, just the same instant sampled twice) or both land after it (both y=10). A
    // pre-D50b implementation that takes its first comparison from two SYNCHRONOUS calls (no
    // `setTimeout` in between) would see `y=500 === y=500` on its very first pair — since
    // `stubRectSequence`-based tests never modelled that shape, THIS is the test that would
    // have let a same-task pair slip through undetected. The correct implementation
    // (`waitForRectToSettle()` under D50b) never compares two reads that were not separated by
    // a real `delay()` tick, so its first VALID comparison can only happen at t>=~50ms — by
    // which point (given the fixture's ~120ms threshold) the rect is still reporting y=500, so
    // the engine must poll at least once more before it ever sees two equal, time-separated
    // samples once the real threshold passes and the rect genuinely stops changing at y=10.
    const installedAt = Date.now();
    let sameTaskPairObserved: { first: number; second: number } | null = null;
    const rectFn = vi.fn(() => {
      const elapsed = Date.now() - installedAt;
      const y = elapsed < 120 ? 500 : 10;
      return { x: 0, y, width: 100, height: 40, top: y, left: 0, right: 100, bottom: y + 40, toJSON: () => ({}) } as DOMRect;
    });
    (anchorB as unknown as { getBoundingClientRect: typeof rectFn }).getBoundingClientRect = rectFn;

    // Independently verify the SAME-TASK claim this test is named for: two back-to-back,
    // synchronous reads of this exact stub, taken right now (well before the 120ms threshold),
    // are equal to each other — proving the stub genuinely produces the failure shape a
    // call-count-based stub (varies every call, never used here) could not: two reads with NO
    // time between them agreeing is exactly what a real browser always does, and exactly what
    // must NOT be trusted as "settled".
    const firstSameTaskRead = anchorB.getBoundingClientRect();
    const secondSameTaskRead = anchorB.getBoundingClientRect();
    sameTaskPairObserved = { first: firstSameTaskRead.y, second: secondSameTaskRead.y };
    expect(sameTaskPairObserved.first).toBe(sameTaskPairObserved.second);
    // Reset the call spy's history so the assertions below only count calls made by the
    // engine itself, not this test's own probe above.
    rectFn.mockClear();

    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'Step A' } },
      { anchorKey: 'b', popover: { title: 'Step B' }, waitForElementMs: 2000 },
    ];

    const tour = createTour({ tourId: 'd50b-same-task-not-settled-id', version: 1, storagePrefix: 'test:', steps });
    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');

    expect(refreshSpies).toHaveLength(1);
    const moveToSpy = moveToSpies[0];
    if (!moveToSpy) throw new Error('expected a moveTo spy to have been registered');

    let rectAtMoveToCall: unknown;
    onMoveToCallbacks.push(() => {
      rectAtMoveToCall = anchorB.getBoundingClientRect();
    });

    const dispatchedAt = Date.now();
    dispatchArrow('ArrowRight');
    await waitUntil(() => moveToSpy.mock.calls.length > 0, 2000);
    const elapsedUntilMove = Date.now() - dispatchedAt;

    // The engine must not hand the anchor to moveTo() while it is still reporting the
    // mid-move value — proof that a same-task pair (which would have resolved instantly,
    // possibly while still y=500) was never accepted, and the engine kept polling on REAL
    // time-separated samples until the fixture's genuine settle (y=10) was reached.
    expect(rectAtMoveToCall).toMatchObject({ y: 10 });
    // The wait took real elapsed time — it could not have resolved on an initial same-task
    // pair, which would take ~0ms. Bounded loosely above by the step's own waitForElementMs
    // (2000ms) plus polling overhead.
    expect(elapsedUntilMove).toBeGreaterThanOrEqual(100);

    await waitUntil(() => popoverTitle() === 'Step B', 2000);
    expect(popoverTitle()).toBe('Step B');

    tour.stop();
  });

  it('(g) D50b: refresh() fires unconditionally after a move even when the anchor`s rect is IDENTICAL before and after — the "only if it changed" condition the previous task shipped is gone', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const anchorA = document.querySelector('[data-tour="a"]') as HTMLElement;
    const anchorB = document.querySelector('[data-tour="b"]') as HTMLElement;

    // Both anchors report the EXACT same static rect, for every single sample, before AND
    // after every move in the whole tour — the strongest possible form of "the rect never
    // changed". Against the pre-D50b implementation (conditional refresh, `beforeMoveRect`
    // vs. `afterMoveRect` comparison) this is precisely the case that suppresses refresh()
    // entirely — this test must FAIL there and PASS here.
    stubStaticRect(anchorA, rect(0, 42));
    stubStaticRect(anchorB, rect(0, 42));

    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'Step A' } },
      { anchorKey: 'b', popover: { title: 'Step B' }, waitForElementMs: 2000 },
    ];

    const tour = createTour({ tourId: 'd50b-unconditional-refresh-id', version: 1, storagePrefix: 'test:', steps });
    await tour.start();
    await waitForOverlay();
    expect(popoverTitle()).toBe('Step A');
    expect(refreshSpies).toHaveLength(1);
    const refreshSpy = refreshSpies[0];
    if (!refreshSpy) throw new Error('expected a refresh spy to have been registered');

    // The first step's drive() already ran its own unconditional post-move settle+refresh by
    // now — exactly one call, even though anchor A's rect never moved even a single pixel.
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    dispatchArrow('ArrowRight');
    await waitUntil(() => popoverTitle() === 'Step B', 2000);
    // Give the post-move settle window (bounded ~400ms) time to run to completion.
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(popoverTitle()).toBe('Step B');
    expect(tour.isActive()).toBe(true);
    // Exactly one MORE call for this move (two total) — proving refresh() is called EXACTLY
    // once per move regardless of whether the rect changed, never conditioned on it.
    expect(refreshSpy).toHaveBeenCalledTimes(2);

    tour.stop();
  });
});
