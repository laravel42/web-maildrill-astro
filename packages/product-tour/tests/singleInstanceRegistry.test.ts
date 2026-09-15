import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * Engine-level invariants for the "at most one live tour per tourId" contract (D7) and the
 * Escape-dismisses-the-tour contract (D8), proven directly against `createTour` — no host
 * (`useEmailBuilderTour`/`useBuilder42Tour`), no Playwright. These are the tests item 3 of the
 * task's DONE WHEN asks for.
 */

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createTour — single active instance per tourId (D7)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    // Defensive: clear any leftover Escape guard between tests (each test stops its own
    // tour, but a failed assertion could otherwise leak a window listener into the next test).
  });

  it('two sequential start() calls for the same tourId leave exactly one active instance', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const steps: TourStep[] = [{ anchorKey: 'a', popover: { title: 'A' } }];

    const tourA = createTour({ tourId: 'shared-id', version: 1, storagePrefix: 'test:', steps });
    const tourB = createTour({ tourId: 'shared-id', version: 1, storagePrefix: 'test:', steps });

    await tourA.start();
    expect(tourA.isActive()).toBe(true);

    await tourB.start();

    // LAST START WINS: the second start() destroys the first's instance before driving its
    // own — never two simultaneous instances for the same tourId.
    expect(tourA.isActive()).toBe(false);
    expect(tourB.isActive()).toBe(true);
    expect(document.querySelectorAll('.driver-popover').length).toBe(1);

    tourB.stop();
  });

  it('a second start() issued while the first is still awaiting its lazy import also leaves exactly one active instance', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const steps: TourStep[] = [{ anchorKey: 'a', popover: { title: 'A' } }];

    const tourA = createTour({ tourId: 'racing-id', version: 1, storagePrefix: 'test:', steps });
    const tourB = createTour({ tourId: 'racing-id', version: 1, storagePrefix: 'test:', steps });

    // Fire both start() calls back-to-back, synchronously, before either has had a chance to
    // resolve its `await import('driver.js')` — this is the exact race the task describes
    // (email side: the restart-nonce effect re-firing on the tourEnabled false→true
    // transition, calling start() again while the auto-start's start() is still pending).
    const pA = tourA.start();
    const pB = tourB.start();
    await Promise.all([pA, pB]);

    expect(document.querySelectorAll('.driver-popover').length).toBe(1);
    // Only the second (last) start() may end up active; the first must have been aborted
    // rather than materializing a second, orphaned driver.js instance.
    expect(tourA.isActive()).toBe(false);
    expect(tourB.isActive()).toBe(true);

    tourB.stop();
  });

  it('restarting via a fresh Tour object for the same tourId destroys the previous one (relaunch shows fresh steps)', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const onEventOld = vi.fn();
    const onEventNew = vi.fn();

    const original = createTour({
      tourId: 'restart-id',
      version: 1,
      storagePrefix: 'test:',
      steps: [{ anchorKey: 'a', popover: { title: 'Old step' } }],
      onEvent: onEventOld,
    });
    await original.start();
    expect(original.isActive()).toBe(true);

    // Simulates a host controller rebuilding + relaunching the tour (requestTourRestart) —
    // a brand-new Tour object, same tourId, without the caller explicitly stopping `original`
    // first (the buggy call sites' pattern before this fix: `tourRef.current?.stop()` was a
    // no-op if `original` hadn't finished constructing yet — here we assert the ENGINE catches
    // it even if the call site's own stop() had been skipped).
    const relaunched = createTour({
      tourId: 'restart-id',
      version: 1,
      storagePrefix: 'test:',
      steps: [{ anchorKey: 'b', popover: { title: 'New step' } }],
      onEvent: onEventNew,
    });
    await relaunched.start();

    expect(original.isActive()).toBe(false);
    expect(relaunched.isActive()).toBe(true);
    expect(document.querySelectorAll('.driver-popover').length).toBe(1);
    expect(document.querySelector('.driver-popover-title')?.textContent).toBe('New step');

    relaunched.stop();
  });

  it('different tourIds run independently — the registry is keyed per tourId', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const tourA = createTour({
      tourId: 'independent-a',
      version: 1,
      storagePrefix: 'test:',
      steps: [{ anchorKey: 'a', popover: { title: 'A' } }],
    });
    const tourB = createTour({
      tourId: 'independent-b',
      version: 1,
      storagePrefix: 'test:',
      steps: [{ anchorKey: 'b', popover: { title: 'B' } }],
    });

    await tourA.start();
    await tourB.start();

    expect(tourA.isActive()).toBe(true);
    expect(tourB.isActive()).toBe(true);
    expect(document.querySelectorAll('.driver-popover').length).toBe(2);

    tourA.stop();
    tourB.stop();
  });

  it('a start() that resolves after stop() was already called does not resurrect an instance', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const steps: TourStep[] = [{ anchorKey: 'a', popover: { title: 'A' } }];
    const tour = createTour({ tourId: 'stop-race-id', version: 1, storagePrefix: 'test:', steps });

    const startPromise = tour.start();
    // stop() before start() has had a chance to finish its own async work (import + anchor
    // resolution) — the exact "Tour.stop() sets driverInstance to null while start() is still
    // inside its await window" pattern from the task's LEADS, now guarded by the registry
    // rather than relying on the plain `driverInstance` null-check alone.
    tour.stop();
    await startPromise;

    expect(tour.isActive()).toBe(false);
    expect(document.querySelectorAll('.driver-popover').length).toBe(0);
  });
});

describe('createTour — Escape dismisses the tour and does not propagate to the host (D8)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('Escape while active destroys the tour (popover/overlay removed, tour_dismissed emitted) and never reaches a host listener', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const onEvent = vi.fn();
    // Two steps: escaping from the first (non-last) step must be reported as a genuine
    // dismissal — driver.js itself only ever calls `onDestroyStarted` (or, here, our own
    // Escape guard) with `isLastStep() === false` in that case, matching its pre-existing
    // "wasLastStep" gating this package already had.
    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'A' } },
      { anchorKey: 'b', popover: { title: 'B' } },
    ];
    const tour = createTour({ tourId: 'escape-dismiss-id', version: 1, storagePrefix: 'test:', steps, onEvent });

    await tour.start();
    expect(tour.isActive()).toBe(true);

    const hostListener = vi.fn();
    window.addEventListener('keydown', hostListener);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );

    // The tour is gone...
    expect(tour.isActive()).toBe(false);
    expect(document.querySelectorAll('.driver-popover').length).toBe(0);
    // ...via the same destroy path as stop(), so tour_dismissed still fires (D8: "dismiss by
    // destroying the instance, not by bypassing driver.js")...
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tour_dismissed', tourId: 'escape-dismiss-id' }),
    );
    // ...and the host's own bubble-phase listener on window never saw the key at all.
    expect(hostListener).not.toHaveBeenCalled();

    window.removeEventListener('keydown', hostListener);
  });

  it('after Escape dismisses the tour, a fresh start() for the same tourId works again (registry was released)', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const steps: TourStep[] = [{ anchorKey: 'a', popover: { title: 'A' } }];
    const tour = createTour({ tourId: 'escape-then-restart-id', version: 1, storagePrefix: 'test:', steps });

    await tour.start();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(tour.isActive()).toBe(false);

    const again = createTour({ tourId: 'escape-then-restart-id', version: 1, storagePrefix: 'test:', steps });
    await again.start();
    expect(again.isActive()).toBe(true);
    expect(document.querySelectorAll('.driver-popover').length).toBe(1);

    again.stop();
  });
});

describe('createTour — Escape yields to a competing modal open on top of the page (D11)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('Escape with an [aria-modal="true"] element present propagates to a host listener and leaves the tour active', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const onEvent = vi.fn();
    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'A' } },
      { anchorKey: 'b', popover: { title: 'B' } },
    ];
    const tour = createTour({ tourId: 'competing-modal-id', version: 1, storagePrefix: 'test:', steps, onEvent });
    await tour.start();
    expect(tour.isActive()).toBe(true);

    // A generic modal surface opened on top of the page — no product-specific selector, just
    // the same shape any host (Maildrill's MUI dialogs included) would render.
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('role', 'dialog');
    document.body.appendChild(modal);

    const hostListener = vi.fn();
    window.addEventListener('keydown', hostListener);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );

    // The guard yielded: the host's own bubble-phase listener saw the key...
    expect(hostListener).toHaveBeenCalledTimes(1);
    // ...the tour was NOT dismissed, stays on the same run, no tour_dismissed emitted...
    expect(tour.isActive()).toBe(true);
    expect(onEvent).not.toHaveBeenCalledWith(expect.objectContaining({ event: 'tour_dismissed' }));
    // ...and its popover/overlay are still there.
    expect(document.querySelectorAll('.driver-popover').length).toBe(1);

    window.removeEventListener('keydown', hostListener);
    tour.stop();
  });

  it('Escape with only a dialog[open] element present also yields — no [role="dialog"] required for detection', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const steps: TourStep[] = [{ anchorKey: 'a', popover: { title: 'A' } }];
    const tour = createTour({ tourId: 'competing-modal-dialog-el-id', version: 1, storagePrefix: 'test:', steps });
    await tour.start();
    expect(tour.isActive()).toBe(true);

    const dialogEl = document.createElement('dialog');
    dialogEl.setAttribute('open', '');
    document.body.appendChild(dialogEl);

    const hostListener = vi.fn();
    window.addEventListener('keydown', hostListener);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );

    expect(hostListener).toHaveBeenCalledTimes(1);
    expect(tour.isActive()).toBe(true);

    window.removeEventListener('keydown', hostListener);
    tour.stop();
  });

  it('Escape with only the tour open (no competing modal) still stops propagation, dismisses the tour and emits tour_dismissed', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const onEvent = vi.fn();
    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'A' } },
      { anchorKey: 'b', popover: { title: 'B' } },
    ];
    const tour = createTour({ tourId: 'no-competing-modal-id', version: 1, storagePrefix: 'test:', steps, onEvent });
    await tour.start();
    expect(tour.isActive()).toBe(true);

    const hostListener = vi.fn();
    window.addEventListener('keydown', hostListener);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );

    // The plain case (D8) is unaffected by the new detection: the tour is gone, dismissed,
    // and the host listener never saw the key.
    expect(tour.isActive()).toBe(false);
    expect(document.querySelectorAll('.driver-popover').length).toBe(0);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tour_dismissed', tourId: 'no-competing-modal-id' }),
    );
    expect(hostListener).not.toHaveBeenCalled();

    window.removeEventListener('keydown', hostListener);
  });

  it("the driver.js popover's own role=\"dialog\" does not count as a competing modal — the plain case is not broken by the detection", async () => {
    document.body.innerHTML = '<button data-tour="a">a</button><button data-tour="b">b</button>';
    const onEvent = vi.fn();
    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'A' } },
      { anchorKey: 'b', popover: { title: 'B' } },
    ];
    const tour = createTour({ tourId: 'driver-popover-is-not-a-modal-id', version: 1, storagePrefix: 'test:', steps, onEvent });
    await tour.start();
    expect(tour.isActive()).toBe(true);

    // Sanity: driver.js's own popover really does carry role="dialog" — if this assumption
    // ever stops holding (a driver.js upgrade), this test fails loudly instead of silently
    // passing because the detection accidentally treated the tour as its own competing modal.
    const popover = document.querySelector('.driver-popover');
    expect(popover?.getAttribute('role')).toBe('dialog');

    const hostListener = vi.fn();
    window.addEventListener('keydown', hostListener);

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );

    // Despite the popover's own role="dialog", the guard still treats this as the plain case:
    // it dismisses the tour itself and the host listener never sees the key.
    expect(tour.isActive()).toBe(false);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tour_dismissed', tourId: 'driver-popover-is-not-a-modal-id' }),
    );
    expect(hostListener).not.toHaveBeenCalled();

    window.removeEventListener('keydown', hostListener);
  });
});

describe('createTour — existing behaviour survives the D7/D8 changes', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('is not supported (no-op) when root is a ShadowRoot, even with a colliding tourId already active', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const liveOnDocument = createTour({
      tourId: 'shadow-collision-id',
      version: 1,
      storagePrefix: 'test:',
      steps: [{ anchorKey: 'a', popover: { title: 'A' } }],
    });
    await liveOnDocument.start();
    expect(liveOnDocument.isActive()).toBe(true);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const anchor = document.createElement('button');
    anchor.setAttribute('data-tour', 'a');
    shadow.appendChild(anchor);

    const shadowTour = createTour({
      tourId: 'shadow-collision-id',
      version: 1,
      storagePrefix: 'test:',
      root: shadow,
      steps: [{ anchorKey: 'a', popover: { title: 'Shadow' } }],
    });

    expect(shadowTour.isSupported).toBe(false);
    await shadowTour.start();
    expect(shadowTour.isActive()).toBe(false);
    // The unsupported start() must not have reclaimed/destroyed the real, document-rooted
    // instance registered under the same tourId — isSupported short-circuits before the
    // registry is ever touched.
    expect(liveOnDocument.isActive()).toBe(true);

    liveOnDocument.stop();
  });

  it('still filters steps via when() under the new registry-aware start()', async () => {
    document.body.innerHTML =
      '<div data-tour="visible"></div><div data-tour="hidden-by-flag"></div>';
    const onEvent = vi.fn();
    const tour = createTour({
      tourId: 'when-filter-id',
      version: 1,
      storagePrefix: 'test:',
      steps: [
        { anchorKey: 'visible', popover: { title: 'Visible' } },
        { anchorKey: 'hidden-by-flag', popover: { title: 'Hidden' }, when: () => false },
      ],
      onEvent,
    });
    await tour.start();
    expect(tour.isActive()).toBe(true);
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tour_started', totalSteps: 1 }),
    );
    tour.stop();
  });

  it('still resolves before()/after() hooks around highlights', async () => {
    const before = vi.fn(async () => {
      await flushMicrotasks();
      const el = document.createElement('div');
      el.setAttribute('data-tour', 'revealed');
      document.body.appendChild(el);
    });
    const tour = createTour({
      tourId: 'before-after-id',
      version: 1,
      storagePrefix: 'test:',
      steps: [{ anchorKey: 'revealed', popover: { title: 'Revealed' }, before }],
    });
    await tour.start();
    expect(before).toHaveBeenCalledTimes(1);
    expect(tour.isActive()).toBe(true);
    tour.stop();
  });

  it('still persists seen state and emits tour_started under the injected storagePrefix', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const onEvent = vi.fn();
    const tour = createTour({
      tourId: 'persisted-id',
      version: 3,
      storagePrefix: 'my-app:',
      steps: [{ anchorKey: 'a', popover: { title: 'A' } }],
      onEvent,
    });
    await tour.start();

    const raw = localStorage.getItem('my-app:persisted-id');
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string)).toMatchObject({ seen: true, version: 3 });
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tour_started', tourId: 'persisted-id' }),
    );
    tour.stop();
  });
});
