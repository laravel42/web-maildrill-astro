import { expect, test } from '@playwright/test';

test.describe('dashboard', () => {
  test('greets the workspace with stat tiles and channel performance', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good/);
    // Stat tiles across the top.
    await expect(page.getByText('Subscribers', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Open rate', { exact: true }).first()).toBeVisible();
    // Channel breakdown lists every channel. Rows appear once the stats fetch
    // resolves (PostHog-backed aggregate can take several seconds), so the
    // first row assertion carries the wait for the loading skeletons to clear.
    await expect(page.getByText('Performance by channel')).toBeVisible();
    // The breakdown omits channels with nothing sent in the range, so asserting
    // all four assumed the seed happened to have recent activity on every one.
    // What the panel guarantees is that the channels it *does* show are real.
    const rows = page.locator('a[href*="/dashboard/analytics?channel="]');
    await expect(rows.first()).toBeVisible({ timeout: 20_000 });
    for (const href of await rows.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) {
      expect(href).toMatch(/channel=(email|sms|whatsapp|voice)\b/);
    }
    await expect(page.getByText('Recent campaigns')).toBeVisible();
  });

  test('sidebar navigates between sections', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByRole('link', { name: 'Campaigns' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/campaigns/);
    await page.getByRole('link', { name: 'Lists' }).first().click();
    await expect(page).toHaveURL(/\/dashboard\/lists/);
  });
});
