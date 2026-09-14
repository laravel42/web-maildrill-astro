import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createTour', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('throws synchronously if neither storagePrefix nor a custom persistence is provided', () => {
    expect(() =>
      createTour({ tourId: 't', version: 1, steps: [] }),
    ).toThrow(/storagePrefix/);
  });

  it('is not supported (no-op) when root is a ShadowRoot', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const anchor = document.createElement('button');
    anchor.setAttribute('data-tour', 'a');
    shadow.appendChild(anchor);

    const tour = createTour({
      tourId: 'shadow-tour',
      version: 1,
      storagePrefix: 'test:',
      root: shadow,
      steps: [{ anchorKey: 'a', popover: { title: 'Hi' } }],
    });

    expect(tour.isSupported).toBe(false);
    await tour.start();
    expect(tour.isActive()).toBe(false);
  });

  it('skips a step whose anchor never appears in the DOM instead of throwing or blocking', async () => {
    document.body.innerHTML = '<button data-tour="present">ok</button>';

    const steps: TourStep[] = [
      { anchorKey: 'present', popover: { title: 'Present' } },
      { anchorKey: 'missing', popover: { title: 'Missing' }, waitForElementMs: 30 },
    ];

    const tour = createTour({ tourId: 'skip-tour', version: 1, storagePrefix: 'test:', steps });

    await expect(tour.start()).resolves.toBeUndefined();
    expect(tour.isActive()).toBe(true);
    tour.stop();
  });

  it('resolves an async before() hook before attempting to highlight the anchor', async () => {
    const before = vi.fn(async () => {
      await flushMicrotasks();
      const el = document.createElement('div');
      el.setAttribute('data-tour', 'revealed');
      document.body.appendChild(el);
    });

    const steps: TourStep[] = [{ anchorKey: 'revealed', popover: { title: 'Revealed' }, before }];

    const tour = createTour({ tourId: 'before-tour', version: 1, storagePrefix: 'test:', steps });
    await tour.start();

    expect(before).toHaveBeenCalledTimes(1);
    expect(tour.isActive()).toBe(true);
    tour.stop();
  });

  it('filters out steps whose when() returns false', async () => {
    document.body.innerHTML =
      '<div data-tour="visible"></div><div data-tour="hidden-by-flag"></div>';

    const steps: TourStep[] = [
      { anchorKey: 'visible', popover: { title: 'Visible' } },
      { anchorKey: 'hidden-by-flag', popover: { title: 'Hidden' }, when: () => false },
    ];

    const onEvent = vi.fn();
    const tour = createTour({
      tourId: 'flagged-tour',
      version: 1,
      storagePrefix: 'test:',
      steps,
      onEvent,
    });
    await tour.start();

    expect(tour.isActive()).toBe(true);
    // The eligible step is highlighted; the ineligible one should never appear as
    // `tour_step_viewed`, and the total step count reported reflects only eligible steps.
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tour_started', totalSteps: 1 }),
    );
    expect(onEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ totalSteps: 2 }),
    );
    tour.stop();
  });

  it('does not start (no eligible steps) when every step is filtered out by when()', async () => {
    const steps: TourStep[] = [
      { anchorKey: 'a', popover: { title: 'A' }, when: () => false },
    ];
    const tour = createTour({ tourId: 'empty-tour', version: 1, storagePrefix: 'test:', steps });
    await tour.start();
    expect(tour.isActive()).toBe(false);
  });

  it('intercepts Escape in the capture phase and stops propagation while the tour is active', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const steps: TourStep[] = [{ anchorKey: 'a', popover: { title: 'A' } }];
    const tour = createTour({ tourId: 'escape-tour', version: 1, storagePrefix: 'test:', steps });
    await tour.start();
    expect(tour.isActive()).toBe(true);

    const windowListener = vi.fn();
    window.addEventListener('keydown', windowListener);

    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    document.dispatchEvent(event);

    // The guard is registered on window with capture: true, so it runs before any bubble-phase
    // listener on window and calls stopPropagation() — the bubble-phase listener must never fire.
    expect(windowListener).not.toHaveBeenCalled();

    window.removeEventListener('keydown', windowListener);
    tour.stop();
  });

  it('does not intercept Escape once the tour has been stopped', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const steps: TourStep[] = [{ anchorKey: 'a', popover: { title: 'A' } }];
    const tour = createTour({ tourId: 'escape-tour-2', version: 1, storagePrefix: 'test:', steps });
    await tour.start();
    tour.stop();
    expect(tour.isActive()).toBe(false);

    const windowListener = vi.fn();
    window.addEventListener('keydown', windowListener);
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    expect(windowListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('keydown', windowListener);
  });

  it('persists seen state under the injected storagePrefix when the tour starts', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const steps: TourStep[] = [{ anchorKey: 'a', popover: { title: 'A' } }];
    const tour = createTour({
      tourId: 'persisted-tour',
      version: 7,
      storagePrefix: 'my-app:',
      steps,
    });
    await tour.start();

    const raw = localStorage.getItem('my-app:persisted-tour');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed).toMatchObject({ seen: true, version: 7 });
    tour.stop();
  });

  it('emits tour_started when the tour begins', async () => {
    document.body.innerHTML = '<button data-tour="a">a</button>';
    const onEvent = vi.fn();
    const tour = createTour({
      tourId: 'events-tour',
      version: 1,
      storagePrefix: 'test:',
      steps: [{ anchorKey: 'a', popover: { title: 'A' } }],
      onEvent,
    });
    await tour.start();
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'tour_started', tourId: 'events-tour' }),
    );
    tour.stop();
  });
});
