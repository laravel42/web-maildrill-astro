import { expect, test } from '@playwright/test';

test.describe('campaigns', () => {
  test('board tabs split by channel, with status as a filter', async ({ page }) => {
    await page.goto('/dashboard/campaigns');
    await expect(page.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeVisible();

    // Channel is the primary cut: campaigns on different channels report
    // different things and are rarely compared side by side. There is no "All"
    // — a mixed list has to blank the columns the channel cannot report.
    for (const channel of ['Email', 'SMS', 'WhatsApp', 'Voice']) {
      await expect(page.getByRole('tab', { name: new RegExp(`^${channel}`) })).toBeVisible();
    }
    await expect(page.getByRole('tab', { name: /^All/ })).toHaveCount(0);
    await expect(page.getByRole('tab', { selected: true })).toContainText('Email');
    // Status moved to the toolbar, where several can be combined.
    await expect(page.getByRole('button', { name: 'Status', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Channel', exact: true })).toHaveCount(0);
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
