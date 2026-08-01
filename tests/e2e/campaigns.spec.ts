import { expect, test } from '@playwright/test';

test.describe('campaigns', () => {
  test('board renders the pipeline with status tabs', async ({ page }) => {
    await page.goto('/dashboard/campaigns');
    await expect(page.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeVisible();
    for (const status of ['Draft', 'Scheduled', 'Sending', 'Sent']) {
      await expect(page.getByRole('tab', { name: new RegExp(`^${status}`) })).toBeVisible();
    }
  });

  test('a sent campaign opens its report page', async ({ page }) => {
    const res = await page.request.get('/api/v1/campaigns');
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { data: Array<{ id: string; status: string }> };
    const sent = body.data.find((c) => c.status === 'sent');
    test.skip(!sent, 'no sent campaign in this workspace');

    await page.goto(`/dashboard/campaigns/${sent!.id}/report`);
    await expect(page.getByText('Engagement funnel')).toBeVisible();
    await expect(page.getByText('Delivery rate')).toBeVisible();
    await expect(page.getByText('Recipient events')).toBeVisible();
  });
});
