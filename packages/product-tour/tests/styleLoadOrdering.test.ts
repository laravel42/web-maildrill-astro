import { describe, it, expect, afterEach } from 'vitest';
import { createTour } from '@/createTour';
import type { TourStep } from '@/steps';

/**
 * D36 — "start() awaits its own stylesheet before driver.js drives".
 *
 * Regression suite for the reported bug: `start()` used to only `await import('driver.js')`,
 * which resolves before the tour's stylesheet does (a fire-and-forget `import('@md/product-tour
 * /style.css')` on the consumer side) — so driver.js measured and positioned `.driver-popover`
 * while unstyled (`position: static`, full-width), producing bogus inline offsets that landed
 * the popover off-screen once the stylesheet finally applied. Under D36 the engine itself
 * `Promise.all([import('driver.js'), loadStyles()])`s, so `drive()` never runs before the
 * injected/default `loadStyles()` resolves.
 *
 * Same conventions as `stepActivation.test.ts`: real driver.js@1.8.0 against happy-dom, plain
 * `document.body.innerHTML` fixtures with `data-tour` anchors, `localStorage.clear()` in
 * `afterEach`, `@/` alias imports.
 */

function oneStepFixture(): TourStep[] {
  document.body.innerHTML = '<button data-tour="a">a</button>';
  return [{ anchorKey: 'a', popover: { title: 'Step A' } }];
}

describe('createTour — start() awaits the tour stylesheet before driver.js drives (D36)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  it('does not drive the tour while an injected loadStyles() is still pending, then drives once it resolves', async () => {
    const steps = oneStepFixture();

    let resolveStyles!: () => void;
    const loadStyles = () =>
      new Promise<void>((resolve) => {
        resolveStyles = resolve;
      });

    const tour = createTour({
      tourId: 'style-order-pending-id',
      version: 1,
      storagePrefix: 'test:',
      steps,
      loadStyles,
    });

    const startPromise = tour.start();

    // While loadStyles() is still pending, driver.js must not have drawn anything yet — the
    // whole point of D36 is that Promise.all() blocks on BOTH the driver.js import AND the
    // stylesheet, not just the former.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.querySelector('.driver-popover')).toBeNull();
    expect(tour.isActive()).toBe(false);

    resolveStyles();
    await startPromise;

    // Once resolved, the combined await settles and the tour proceeds exactly as before.
    for (let i = 0; i < 20; i++) {
      if (document.querySelector('.driver-popover')) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(document.querySelector('.driver-popover')).not.toBeNull();
    expect(tour.isActive()).toBe(true);

    tour.stop();
  });

  it('starts the tour normally when loadStyles is omitted (default `() => import(\'./theme.css\')` path)', async () => {
    const steps = oneStepFixture();

    const tour = createTour({
      tourId: 'style-order-default-id',
      version: 1,
      storagePrefix: 'test:',
      steps,
    });

    await tour.start();

    for (let i = 0; i < 20; i++) {
      if (document.querySelector('.driver-popover')) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(document.querySelector('.driver-popover')).not.toBeNull();
    expect(tour.isActive()).toBe(true);

    tour.stop();
  });
});
