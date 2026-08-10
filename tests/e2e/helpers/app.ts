import { expect, type Page } from '@playwright/test';

/**
 * Navigate inside the workspace and wait until it is actually interactive.
 *
 * The app shell and every screen are React islands hydrated with
 * `client:idle` / `client:visible`, so the server-rendered markup is on screen
 * — and clickable as far as Playwright is concerned — a beat before React has
 * attached any handler. Clicking in that window silently does nothing, which
 * shows up as a mysterious timeout on the *next* assertion.
 *
 * Astro drops the `ssr` attribute from an `<astro-island>` once it hydrates,
 * so waiting for none to remain is the real signal.
 */
export async function gotoApp(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => !document.querySelector('astro-island[ssr]'), null, {
    timeout: 30_000,
  });
}

/**
 * A status/channel tab by its label. Tabs render their count on a second line
 * ("Draft\n2"), which the accessible name flattens to "Draft 2".
 */
export function tab(page: Page, label: string) {
  return page.getByRole('tab', { name: new RegExp(`^${label}\\s*\\d*$`) });
}

/** Click a tab and assert it took selection. */
export async function selectTab(page: Page, label: string): Promise<void> {
  const target = tab(page, label);
  await target.click();
  await expect(target, `${label} tab selected`).toHaveAttribute('aria-selected', 'true');
}
