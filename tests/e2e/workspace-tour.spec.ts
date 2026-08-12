import { expect, test } from '@playwright/test';
import { gotoApp, selectTab } from './helpers/app';
import { blockOutbound } from './helpers/no-outbound';

/**
 * The signed-in workspace, section by section.
 *
 * Deliberately never sends: no campaign dispatch or schedule, no template test
 * send, no WhatsApp submission, no voice preview, no Stripe checkout. Those all
 * reach live Infobip/Stripe (`PROVIDER_DRIVER=infobip` in `.env`), so every
 * test installs `blockOutbound` and asserts nothing was even attempted.
 *
 * Anything this creates is cleaned up through the API so repeat runs stay
 * stable against the shared dev workspace.
 */

let blocked: string[];

test.beforeEach(async ({ page }) => {
  blocked = await blockOutbound(page);
});

test.afterEach(() => {
  expect(blocked, 'the tour must never attempt an outbound send').toEqual([]);
});

/** Sidebar labels with the URL each should reach. */
const SECTIONS: [label: string, url: RegExp][] = [
  ['Dashboard', /\/dashboard\/?($|\?)/],
  ['Campaigns', /\/dashboard\/campaigns/],
  ['Templates', /\/dashboard\/templates/],
  ['Subscribers', /\/dashboard\/subscribers/],
  ['Lists', /\/dashboard\/lists/],
  ['Media Library', /\/dashboard\/media/],
  ['Analytics', /\/dashboard\/analytics/],
];

test.describe('app shell', () => {
  test('the sidebar reaches every section', async ({ page }) => {
    await gotoApp(page, '/dashboard');
    for (const [label, url] of SECTIONS) {
      await page.getByRole('link', { name: label }).first().click();
      await expect(page, `${label} nav target`).toHaveURL(url);
    }
  });

  test('the command palette opens and navigates', async ({ page }) => {
    await gotoApp(page, '/dashboard');
    await page.getByRole('button', { name: /Search/ }).first().click();
    await expect(page.getByPlaceholder('Search or jump to…')).toBeVisible();
    await page.keyboard.type('Templ');
    await page.getByText('Go to Templates').click();
    await expect(page).toHaveURL(/\/dashboard\/templates/);
  });

  test('the theme toggle flips and persists across a reload', async ({ page }) => {
    await gotoApp(page, '/dashboard');
    const root = page.locator('html');
    const before = await root.getAttribute('data-theme');
    const after = before === 'dark' ? 'light' : 'dark';
    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(root).toHaveAttribute('data-theme', after);
    await page.reload();
    await expect(root).toHaveAttribute('data-theme', after);
    // Leave the workspace as we found it for the other specs.
    await page.getByRole('button', { name: 'Toggle theme' }).click();
  });

  test('the notifications inbox opens', async ({ page }) => {
    await gotoApp(page, '/dashboard');
    await page.getByRole('button', { name: /Notifications/ }).click();
    // Derived feed — either real activity or the empty state, never a crash.
    await expect(page.getByRole('dialog').first()).toBeVisible();
  });

  test('the account menu exposes sign out', async ({ page }) => {
    await gotoApp(page, '/dashboard');
    await page.getByRole('button', { name: 'Account menu' }).click();
    // Opened, not clicked: signing out revokes the session id that every
    // parallel spec shares through the stored storage state.
    await expect(page.getByRole('menu').getByText('Sign out')).toBeVisible();
  });
});

test.describe('dashboard', () => {
  test('renders tiles, channel performance and recent campaigns', async ({ page }) => {
    await gotoApp(page, '/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good/);
    await expect(page.getByText('Performance by channel')).toBeVisible();
    await expect(page.getByText('Recent campaigns')).toBeVisible();
    // The range switcher drives the activity chart.
    for (const range of ['7 days', '30 days', '90 days', '12 months']) {
      await page.getByRole('button', { name: range }).click();
    }
  });
});

test.describe('campaigns', () => {
  test('board walks every channel tab', async ({ page }) => {
    await gotoApp(page, '/dashboard/campaigns');
    await expect(page.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeVisible();
    // Tabs split by channel; status is a toolbar filter. No "All" tab.
    for (const channel of ['Email', 'SMS', 'WhatsApp', 'Voice']) {
      await selectTab(page, channel);
    }
    await expect(page.getByRole('button', { name: 'Status', exact: true })).toBeVisible();
  });

  test('the wizard opens on step one and closes without dispatching', async ({ page }) => {
    await gotoApp(page, '/dashboard/campaigns');
    await page.getByRole('button', { name: 'Create campaign' }).first().click();

    const wizard = page.getByRole('dialog').first();
    await expect(wizard.getByText(/Let’s start with the basics/)).toBeVisible();

    // Channel picker + the required fields of step one.
    await wizard.getByText('SMS', { exact: true }).click();
    await wizard.getByText('Email', { exact: true }).click();
    await wizard.getByPlaceholder('Summer Sale 2026').fill(`e2e wizard ${Date.now()}`);
    await wizard.getByPlaceholder(/summer sale starts now/i).fill('e2e subject');
    await wizard.getByRole('button', { name: /Continue/ }).click();

    // Step two reached; abandon well short of the review/schedule step.
    await expect(wizard.getByRole('button', { name: /Back/ })).toBeEnabled();
    await wizard.getByRole('button', { name: 'Close' }).click();
    await expect(wizard).not.toBeVisible();
  });

  test('a draft shows on the board and can be deleted', async ({ page }) => {
    const name = `e2e draft ${Date.now()}`;
    const created = await page.request.post('/api/v1/campaigns', {
      data: { name, channel: 'email', status: 'draft' },
    });
    expect(created.ok(), `create failed: ${await created.text()}`).toBe(true);
    const { id } = (await created.json()) as { id: string };

    await gotoApp(page, '/dashboard/campaigns');
    // Rows expose the name through their select control.
    await expect(page.getByRole('button', { name: `Select ${name}` }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Astro guards non-GET requests with an origin check (a bodyless DELETE
    // otherwise reads as a cross-site form submission and 403s).
    const removed = await page.request.delete(`/api/v1/campaigns/${id}`, {
      headers: { origin: new URL(page.url()).origin },
    });
    expect(removed.ok(), `delete failed: ${await removed.text()}`).toBe(true);
    await page.reload();
    await expect(page.getByRole('button', { name: `Select ${name}` })).toHaveCount(0);
  });

  test('a sent campaign opens its report', async ({ page }) => {
    await gotoApp(page, '/dashboard/campaigns');
    await page.getByText('August digest', { exact: true }).first().click();
    const report = page.getByRole('button', { name: /View report|Open report/ }).first();
    if (!(await report.isVisible().catch(() => false))) test.skip();
    await report.click();
    await expect(page).toHaveURL(/\/dashboard\/campaigns\/[0-9a-f-]{36}\/report/);
  });
});

test.describe('templates', () => {
  test('gallery lists every channel tab', async ({ page }) => {
    await gotoApp(page, '/dashboard/templates');
    await expect(page.getByRole('heading', { level: 1, name: 'Templates' })).toBeVisible();
    for (const channel of ['All', 'Email', 'SMS', 'WhatsApp', 'Voice']) {
      await selectTab(page, channel);
    }
    // Gallery ↔ list view. Unlike Media's tablist, these are plain buttons.
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await page.getByRole('button', { name: 'Gallery', exact: true }).click();
  });

  for (const channel of ['email', 'sms', 'whatsapp', 'voice'] as const) {
    test(`the ${channel} builder opens and can be left`, async ({ page }) => {
      await page.goto(`/dashboard/templates/${channel}`);
      await expect(page.getByRole('button', { name: 'Save template' })).toBeVisible({
        timeout: 45_000,
      });
      await page.getByRole('button', { name: 'Back', exact: true }).first().click();
      await expect(page).toHaveURL(/\/dashboard\/templates/);
    });
  }

  test('the send-test dialog opens and cancels without sending', async ({ page }) => {
    await gotoApp(page, '/dashboard/templates/email');
    const sendTest = page.getByRole('button', { name: 'Send test' });
    await expect(sendTest).toBeVisible({ timeout: 45_000 });
    await sendTest.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('subscribers', () => {
  test('roster renders, tabs filter, search narrows to the empty state', async ({ page }) => {
    await gotoApp(page, '/dashboard/subscribers');
    await expect(page.getByRole('heading', { level: 1, name: 'Subscribers' })).toBeVisible();

    for (const status of ['All', 'Active', 'Unsubscribed', 'Bounced']) {
      await selectTab(page, status);
    }
    await selectTab(page, 'All');

    const search = page.getByLabel('Search subscribers');
    await search.fill('zzz-no-match-zzz');
    await expect(page.getByText(/No subscribers match your filters/i).first()).toBeVisible();
    await search.fill('');
  });

  test('add a subscriber through the wizard, then remove it', async ({ page }) => {
    const email = `e2e+${Date.now()}@example.com`;
    await gotoApp(page, '/dashboard/subscribers');

    await page.getByRole('button', { name: 'Add subscriber' }).click();
    const dialog = page.getByRole('dialog').first();
    await dialog.getByRole('button', { name: /Add one person/ }).click();
    await dialog.getByLabel(/email/i).first().fill(email);
    await dialog.getByRole('button', { name: /^(Add subscriber|Save|Create)/ }).last().click();

    await page.getByLabel('Search subscribers').fill(email);
    await expect(page.getByText(email, { exact: true }).first()).toBeVisible({ timeout: 20_000 });

    const rows = (
      (await (await page.request.get('/api/v1/subscribers?limit=200')).json()) as {
        data: { id: string; email: string }[];
      }
    ).data;
    const created = rows.find((r) => r.email === email);
    expect(created, 'created subscriber is returned by the API').toBeTruthy();
    const removed = await page.request.delete(`/api/v1/subscribers/${created!.id}`, {
      headers: { origin: new URL(page.url()).origin },
    });
    expect(removed.ok(), `delete failed: ${await removed.text()}`).toBe(true);
  });

  test('the import wizard parses a CSV and reaches column mapping', async ({ page }) => {
    await gotoApp(page, '/dashboard/subscribers');
    await page.getByRole('button', { name: 'Add subscriber' }).click();
    const dialog = page.getByRole('dialog').first();
    await dialog.getByRole('button', { name: /Import from a file/ }).click();

    await dialog.locator('input[type=file]').setInputFiles({
      name: 'subscribers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('Email,Name,Status\nada@example.com,Ada Lovelace,subscribed\n'),
    });

    // Mapping step: headers are guessed onto targets. Abandon before importing.
    await expect(dialog.getByText(/Imports as|Map each column/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(dialog.getByText('Email', { exact: true }).first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();
  });

  test('export downloads a CSV of the roster', async ({ page }) => {
    await gotoApp(page, '/dashboard/subscribers');
    const download = page.waitForEvent('download', { timeout: 45_000 });
    await page.getByRole('button', { name: 'Export' }).click();
    expect((await download).suggestedFilename()).toMatch(/subscribers.*\.csv$/);
  });

  test('a row drills through to the subscriber profile', async ({ page }) => {
    await gotoApp(page, '/dashboard/subscribers');
    const name = 'Aisha Costa';
    await page.getByText(name, { exact: true }).first().click();
    await page.getByRole('button', { name: 'View profile' }).click();
    await expect(page).toHaveURL(/\/dashboard\/subscribers\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  });

  test('the segment builder opens and closes', async ({ page }) => {
    await gotoApp(page, '/dashboard/subscribers');
    await page.getByRole('button', { name: 'Create segment' }).first().click();
    const dialog = page.getByRole('dialog', { name: /segment/i });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('lists', () => {
  test('index renders with the workspace custom-fields modal', async ({ page }) => {
    await gotoApp(page, '/dashboard/lists');
    await expect(page.getByRole('heading', { level: 1, name: 'Lists' })).toBeVisible();
    await page.getByRole('button', { name: 'Custom fields' }).click();
    const dialog = page.getByRole('dialog', { name: 'Custom fields' });
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('media', () => {
  test('library renders and the upload dialog opens', async ({ page }) => {
    await gotoApp(page, '/dashboard/media');
    await expect(page.getByRole('heading', { level: 1, name: 'Media Library' })).toBeVisible();
    // View switch is a tablist.
    await selectTab(page, 'List');
    await selectTab(page, 'Grid');

    await page.getByRole('button', { name: 'Upload file' }).click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible();
    // Opened only — a real upload would push bytes to S3.
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('analytics', () => {
  test('renders every panel', async ({ page }) => {
    await gotoApp(page, '/dashboard/analytics');
    await expect(page.getByRole('heading', { level: 1, name: 'Analytics' })).toBeVisible();
    // Email reports the full set, so both charts render; the cross-channel
    // panels were removed when Analytics became single-channel.
    for (const panel of ['Delivery over time', 'Engagement over time']) {
      await expect(page.getByRole('heading', { name: panel }), `${panel} panel`).toBeVisible({
        timeout: 30_000,
      });
    }
  });
});

test.describe('settings', () => {
  test('every settings section renders', async ({ page }) => {
    await gotoApp(page, '/dashboard/settings');
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible();
    for (const label of ['Usage', 'Domains', 'Billing', 'API keys', 'Users']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page.getByRole('heading', { name: label }), `${label} panel`).toBeVisible();
    }
  });

  test('the add-balance dialog opens without starting checkout', async ({ page }) => {
    await gotoApp(page, '/dashboard/settings');
    // The Usage panel's "Add balance" is a shortcut into the Billing section.
    await page.getByRole('button', { name: 'Add balance', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();

    const topUp = page.getByRole('button', { name: /Add balance|Top up/ }).first();
    if (!(await topUp.isVisible().catch(() => false))) test.skip();
    await topUp.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible();
    // Selecting a package is safe; only "Buy" would call checkout, and
    // blockOutbound would abort it if a future edit ever did.
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});

test.describe('profile', () => {
  test('binds the signed-in account and its security panel', async ({ page }) => {
    await gotoApp(page, '/dashboard/profile');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText(/security|sessions|passkey/i).first()).toBeVisible();
  });
});
