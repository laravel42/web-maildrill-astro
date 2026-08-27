import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/app';

/**
 * The vertical slice, driven the way a user drives it:
 *   create → choose a trigger → add a step → configure it → publish → inspect runs.
 *
 * Deliberately no API shortcuts — the point is that the composer, the BFF, the API and the
 * draft/publish model actually hold together in a browser.
 */

const unique = () => `E2E automation ${Date.now()}`;

test.describe('Automations', () => {
  test('lists automations and creates one', async ({ page }) => {
    await gotoApp(page, '/dashboard/automations');
    await expect(page.getByRole('heading', { level: 1, name: 'Automations' })).toBeVisible();

    await page.getByRole('button', { name: 'New automation' }).click();
    await page.waitForURL(/\/dashboard\/automations\/[0-9a-f-]{36}$/, { timeout: 20_000 });

    // The composer shell is up and the trigger node is asking to be configured.
    await expect(page.getByRole('application', { name: 'Automation canvas' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Choose a trigger/ }).first()).toBeVisible();
  });

  test('builds, configures and publishes a workflow', async ({ page }) => {
    await gotoApp(page, '/dashboard/automations');
    await page.getByRole('button', { name: 'New automation' }).click();
    await page.waitForURL(/\/dashboard\/automations\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const url = page.url();

    // Name it.
    const name = unique();
    await page.getByRole('button', { name: /Untitled automation/ }).click();
    const nameInput = page.getByLabel('Automation name');
    await nameInput.fill(name);
    await nameInput.press('Enter');
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();

    // Trigger: subscriber created.
    await page
      .getByRole('button', { name: /Choose a trigger/ })
      .first()
      .click();
    const picker = page.getByRole('dialog', { name: 'Choose a trigger' });
    await picker.getByRole('searchbox').fill('subscriber created');
    await picker
      .getByRole('button', { name: /Subscriber created/ })
      .first()
      .click();
    await expect(picker).toBeHidden();

    // Add a step: add a tag (no external dependency, so the test does not need a template).
    await page.getByRole('button', { name: 'Add a step here' }).first().click();
    const stepPicker = page.getByRole('dialog', { name: 'Add a step' });
    await stepPicker.getByRole('searchbox').fill('add tag');
    await stepPicker
      .getByRole('button', { name: /^Add tag/ })
      .first()
      .click();
    await expect(stepPicker).toBeHidden();

    // The inspector opens on the new step; fill its required fields.
    const inspector = page.getByRole('complementary', { name: 'Step settings' });
    await expect(inspector).toBeVisible();
    // Targeted by role: the "Insert data into <field>" button shares the field's name.
    await inspector
      .getByRole('textbox', { name: /^Subscriber ID/ })
      .fill('{{trigger.subscriber.id}}');
    await inspector.getByRole('textbox', { name: /^Tag/ }).fill('e2e-engaged');

    // Publish becomes available once validation is clean.
    const publish = page.getByRole('button', { name: 'Publish' });
    await expect(publish).toBeEnabled({ timeout: 15_000 });
    await publish.click();
    await expect(page.getByText(/Published/)).toBeVisible({ timeout: 20_000 });

    // The published state survives a reload — draft v2 over published v1.
    await gotoApp(page, url);
    await expect(page.getByText('Active')).toBeVisible();

    // And it shows up on the list with its trigger named.
    await gotoApp(page, '/dashboard/automations');
    const row = page.getByRole('link', { name: new RegExp(name) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Subscriber created');
    await expect(row).toContainText('Active');
  });

  test('runs for real when its trigger fires, and shows the run', async ({ page }) => {
    // The whole vertical slice, live: publish through the UI, cause a real domain event,
    // and watch the worker execute the workflow and journal every step.
    await gotoApp(page, '/dashboard/automations');
    await page.getByRole('button', { name: 'New automation' }).click();
    await page.waitForURL(/\/dashboard\/automations\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const id = page.url().split('/').pop()!;

    await page
      .getByRole('button', { name: /Choose a trigger/ })
      .first()
      .click();
    const picker = page.getByRole('dialog', { name: 'Choose a trigger' });
    await picker.getByRole('searchbox').fill('subscriber created');
    await picker
      .getByRole('button', { name: /Subscriber created/ })
      .first()
      .click();

    await page.getByRole('button', { name: 'Add a step here' }).first().click();
    const stepPicker = page.getByRole('dialog', { name: 'Add a step' });
    await stepPicker.getByRole('searchbox').fill('add tag');
    await stepPicker
      .getByRole('button', { name: /^Add tag/ })
      .first()
      .click();

    const tag = `e2e-fired-${Date.now()}`;
    const inspector = page.getByRole('complementary', { name: 'Step settings' });
    await inspector
      .getByRole('textbox', { name: /^Subscriber ID/ })
      .fill('{{trigger.subscriber.id}}');
    await inspector.getByRole('textbox', { name: /^Tag/ }).fill(tag);

    const publish = page.getByRole('button', { name: 'Publish' });
    await expect(publish).toBeEnabled({ timeout: 15_000 });
    await publish.click();
    await expect(page.getByText(/Published/)).toBeVisible({ timeout: 20_000 });

    // Cause the real event: a subscriber created through the BFF, exactly as the CRM does.
    const email = `automation-e2e-${Date.now()}@maildrill.net`;
    const created = await page.request.post('/api/v1/subscribers', {
      data: { email, name: 'Automation E2E' },
    });
    expect(created.ok(), 'subscriber created').toBeTruthy();

    // The dispatcher polls once a second; the worker runs it immediately after.
    await expect
      .poll(
        async () => {
          const response = await page.request.get(`/api/v1/automations/${id}/runs`);
          if (!response.ok()) return 'unavailable';
          const body = (await response.json()) as { items: { status: string }[] };
          return body.items[0]?.status ?? 'none';
        },
        { timeout: 40_000, intervals: [500, 1000, 2000] },
      )
      .toBe('succeeded');

    // And the run inspector shows both steps.
    await gotoApp(page, `/dashboard/automations/${id}/runs`);
    await page
      .getByRole('button', { name: /Succeeded/ })
      .first()
      .click();
    const drawer = page.getByRole('dialog', { name: 'Run details' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Subscriber created')).toBeVisible();
    await expect(drawer.getByText('Add tag')).toBeVisible();
  });

  test('shows an empty run history for a fresh automation', async ({ page }) => {
    await gotoApp(page, '/dashboard/automations');
    await page.getByRole('button', { name: 'New automation' }).click();
    await page.waitForURL(/\/dashboard\/automations\/[0-9a-f-]{36}$/, { timeout: 20_000 });
    const id = page.url().split('/').pop();

    await gotoApp(page, `/dashboard/automations/${id}/runs`);
    await expect(page.getByRole('heading', { level: 1, name: 'Runs' })).toBeVisible();
    await expect(page.getByText(/No runs yet/)).toBeVisible();
  });

  test('manages workspace connections from Settings → Integrations', async ({ page }) => {
    // The credential store automations reach external APIs with. The secret is write-only:
    // it is encrypted on arrival and never returned, so the UI can only ever show a name.
    await gotoApp(page, '/dashboard/settings');
    await page.getByRole('button', { name: 'Integrations' }).click();
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();

    await page.getByRole('button', { name: 'Add connection' }).click();
    const name = `E2E key ${Date.now()}`;
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('API key').fill('sk_test_do_not_echo_me');
    await page.getByRole('button', { name: 'Save connection' }).click();

    const row = page.getByRole('listitem').filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row).toContainText('never shown');
    // The secret must not be anywhere in the rendered document.
    await expect(page.locator('body')).not.toContainText('sk_test_do_not_echo_me');

    // …and not in the API response either.
    const listed = await page.request.get('/api/v1/automation-connections');
    expect(listed.ok()).toBeTruthy();
    expect(await listed.text()).not.toContain('sk_test_do_not_echo_me');

    await row.getByRole('button', { name: /^Delete connection/ }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(row).toBeHidden({ timeout: 15_000 });
  });

  test('refuses an unknown automation webhook token', async ({ request }) => {
    // The URL is the credential; an unknown one must be indistinguishable from a
    // non-existent automation.
    const response = await request.post(
      '/api/automations/webhooks/0000000000000000000000000000000000000000000',
      { data: { hello: 'world' } },
    );
    expect(response.status()).toBe(404);
  });
});
