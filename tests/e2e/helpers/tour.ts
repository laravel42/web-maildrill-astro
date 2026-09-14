import type { Locator, Page } from '@playwright/test';

/**
 * Helpers for the guided-tour e2e coverage (F6,
 * docs/product-tour-driverjs-plan.md §4).
 *
 * The tour engine (`@md/product-tour`, `packages/product-tour/src/createTour.ts`)
 * decides "seen" strictly from persisted storage read at `start()` time, and the
 * two host controllers (`useEmailBuilderTour`, `useBuilder42Tour`) auto-start
 * synchronously on mount, before Playwright's own load-state waiting would ever
 * get a chance to clear storage after navigation. So every test that cares about
 * a deterministic first-run must clear the relevant keys via
 * `page.addInitScript` — injected before any page script runs, per navigation.
 */

/** `eb:` prefix — `createLocalStoragePersistence('eb:')`, tour id `email-builder`. */
const EMAIL_TOUR_STORAGE_KEY = 'eb:email-builder';

/**
 * Clears the email editor's persisted tour state so the next navigation looks
 * like a true first run. Must be called before `page.goto`/`gotoApp` — an
 * `addInitScript` runs on every subsequent navigation in this test, which is
 * exactly what's needed for the "reload after completing" persistence check
 * too (call again right before a scripted `localStorage.setItem` to flip it
 * back if a test needs "already seen" instead).
 */
export async function resetEmailTourState(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    window.localStorage.removeItem(key);
  }, EMAIL_TOUR_STORAGE_KEY);
}

/** Marks the email tour as already seen/completed, before any navigation. */
export async function markEmailTourSeen(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({ seen: true, completed: true, version: 1 }),
    );
  }, EMAIL_TOUR_STORAGE_KEY);
}

/**
 * Clears Builder42's tour state (`pb:tourSeen` / `pb:tourVersion`, the
 * `useLocalConfig` keys `createConfigBackedTourPersistence` bridges onto —
 * see `packages/builder42/src/app/tour/useBuilder42Tour.ts`) and forces
 * `pb:experienceLevelChosen` to `true` so the tour is eligible to auto-start
 * without `OnboardingExperienceModal` competing for the same first paint
 * (§4 F4 acceptance: "must never overlap").
 */
export async function resetLandingTourState(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.removeItem('pb:tourSeen');
    window.localStorage.removeItem('pb:tourVersion');
    window.localStorage.setItem('pb:experienceLevelChosen', JSON.stringify(true));
  });
}

/** Marks the landing tour as already seen, before any navigation. */
export async function markLandingTourSeen(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('pb:tourSeen', JSON.stringify(true));
    window.localStorage.setItem('pb:tourVersion', JSON.stringify(1));
    window.localStorage.setItem('pb:experienceLevelChosen', JSON.stringify(true));
  });
}

/** The driver.js popover currently on screen, themed via `popoverClass: 'md-tour'`. */
export function tourPopover(page: Page): Locator {
  return page.locator('.driver-popover.md-tour');
}

/** The single element driver.js is currently highlighting (`.driver-active-element`). */
export function tourHighlightedElement(page: Page): Locator {
  return page.locator('.driver-active-element');
}

/** driver.js's "Next"/"Done" footer button inside the popover. */
export function tourNextButton(page: Page): Locator {
  return tourPopover(page).locator('.driver-popover-next-btn');
}
