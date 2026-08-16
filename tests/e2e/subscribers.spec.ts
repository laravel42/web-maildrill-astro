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

  test('the tab count, the footer and the status menu describe one set', async ({ page }) => {
    // The three numbers on this screen come from different places — the tab
    // from /subscribers/counts, the footer from the tab count, the menu from
    // the same scan's byStatus — and each has disagreed with the others.
    const num = (s: string | null) => Number((s ?? '').replace(/[^\d]/g, ''));
    /** "1–10 of 1,000,229 subscribers" -> 1000229 */
    const footerTotal = (s: string | null) => num(/of ([\d,]+)/.exec(s ?? '')?.[1] ?? '');

    await page.goto('/dashboard/subscribers');
    for (const channel of ['Email', 'SMS'] as const) {
      const tabEl = page.getByRole('tab', { name: new RegExp(channel) });
      if (channel !== 'Email') await tabEl.click();
      // Channel totals do not depend on which tab is open, so this is stable
      // while the page below it refetches.
      const tab = num(await tabEl.textContent());
      expect(tab).toBeGreaterThan(0);

      // The footer counts the same filtered set the tab does. It did not: the
      // channel aggregates ignored the status filter, so with Status=Active the
      // Email tab read the whole roster over a footer showing only actives.
      await expect
        .poll(
          async () =>
            footerTotal(
              await page
                .getByText(/of [\d,]+ subscribers/)
                .first()
                .textContent(),
            ),
          { timeout: 20_000 },
        )
        .toBe(tab);

      // Every status the menu offers, summed, is that same set — on SMS the
      // menu folds bounced and complained into Active, and those three used to
      // overwrite each other instead of summing.
      const statusFilter = page.locator('button[class*="_filter_"]').filter({ hasText: 'Status' });
      await statusFilter.click();
      const menu = await page.locator('[class*="_pop_"], [role="menu"]').first().innerText();
      const options = [
        ...menu.matchAll(/(Active|Unsubscribed|Bounced|Complained|Invalid)\s+([\d,]+)/g),
      ];
      expect(options.length).toBeGreaterThan(0);
      expect(options.reduce((acc, m) => acc + num(m[2]), 0)).toBe(tab);
      // The open menu lays a scrim over the tabs; dismiss it before the next
      // pass, the way a user would.
      // Clicked in a corner: the scrim is full-viewport, and its centre sits
      // under the menu it dims.
      await page
        .locator('button[class*="_scrim_"][aria-label="Close"]')
        .last()
        .click({ position: { x: 4, y: 4 } });
      await expect(page.locator('[role="menu"]')).toHaveCount(0);
    }
  });

  test('a mid-word search keeps the rows the server returned', async ({ page }) => {
    await page.goto('/dashboard/subscribers');
    const search = page.getByRole('searchbox', { name: 'Search subscribers' });
    // The server matches `lower(email) like %q%`; the browser's word/prefix
    // matcher does not. While that pass ran on live pages it deleted every row
    // the server had already returned and counted — an empty table over a
    // six-figure footer and a pager offering 100,000 pages.
    await search.fill('ubscriber');
    await expect
      .poll(async () => page.getByText(/no subscribers match/i).count(), { timeout: 15_000 })
      .toBe(0);
    await expect(page.locator('.atrow').first()).toBeVisible();
  });

  test('a subscriber profile binds live engagement data', async ({ page }) => {
    // Pull a real id through the same-origin BFF the app itself uses.
    const res = await page.request.get('/api/v1/subscribers?limit=1');
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as { items: Array<{ id: string; email: string }> };
    expect(body.items.length).toBeGreaterThan(0);
    const target = body.items[0];

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
