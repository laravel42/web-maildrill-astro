import { expect, test } from '@playwright/test';

test.describe('subscribers', () => {
  test('CRM view renders the roster and search narrows it', async ({ page }) => {
    await page.goto('/dashboard/subscribers');
    await expect(page.getByRole('heading', { level: 1, name: 'Subscribers' })).toBeVisible();
    const count = page.getByText(/All subscribers/);
    await expect(count).toBeVisible();

    // Search for something that cannot match and expect the empty state.
    const search = page.getByRole('searchbox', { name: 'Search subscribers' });
    await search.fill('zz-no-such-subscriber-zz');
    await expect(page.getByText(/no subscribers match/i).first()).toBeVisible();
    await search.fill('');
  });

  test('a subscriber profile binds live engagement data', async ({ page }) => {
    // Pull a real id through the same-origin BFF the app itself uses.
    const res = await page.request.get('/api/v1/subscribers?limit=1');
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { data: Array<{ id: string; email: string }> };
    expect(body.data.length).toBeGreaterThan(0);
    const target = body.data[0];

    await page.goto(`/dashboard/subscribers/${target.id}`);
    // Identity header, engagement ring, and the tabbed history.
    await expect(page.getByText(target.email).first()).toBeVisible();
    await expect(page.getByText('of 100')).toBeVisible();
    for (const tab of ['Activity', 'Campaigns', 'Clicked links']) {
      await expect(page.getByRole('tab', { name: new RegExp(tab) })).toBeVisible();
    }
    await page.getByRole('tab', { name: /campaigns/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });
});
