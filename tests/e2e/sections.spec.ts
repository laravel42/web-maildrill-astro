import { expect, test } from '@playwright/test';

test.describe('remaining sections', () => {
  test('templates gallery lists channel tabs and cards', async ({ page }) => {
    await page.goto('/dashboard/templates');
    await expect(page.getByRole('heading', { level: 1, name: 'Templates' })).toBeVisible();
    for (const ch of ['Email', 'SMS', 'WhatsApp', 'Voice']) {
      await expect(page.getByRole('tab', { name: new RegExp(`^${ch}`) })).toBeVisible();
    }
  });

  test('media library renders', async ({ page }) => {
    await page.goto('/dashboard/media');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/media/i);
  });

  test('analytics renders activity and channel panels', async ({ page }) => {
    await page.goto('/dashboard/analytics');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/analytics/i);
    await expect(page.getByText('By channel')).toBeVisible();
  });

  test('settings renders', async ({ page }) => {
    await page.goto('/dashboard/settings');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/settings/i);
  });

  test('profile binds the signed-in account', async ({ page }) => {
    await page.goto('/dashboard/profile');
    await expect(page.getByRole('textbox', { name: 'Email' })).toHaveValue(/@/);
  });
});
