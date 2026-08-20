import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/app';
import { psql } from './helpers/login-code';

/**
 * Registration, as the product actually behaves during the private rollout.
 *
 * Sign-up does NOT create an account today: the form captures the lead, fires
 * the waitlist + team-notification email, and lands on a terminal "you're on
 * the list" state. Login is gated by LOGIN_ALLOWLIST, so a brand-new address
 * cannot reach the dashboard at all — see src/lib/auth/login-allowlist.ts.
 * These specs pin that behaviour; when registration opens up they are the
 * tests that should fail first and get rewritten into a real signup→dashboard
 * journey.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const uniqueEmail = () => `e2e+${Date.now()}@example.com`;

test.describe('sign-up', () => {
  test('an empty form is blocked by the required fields, not by the server', async ({ page }) => {
    let posted = false;
    await page.route('**/api/signup-welcome', (route) => {
      posted = true;
      return route.fulfill({ status: 202, body: '{}' });
    });

    await gotoApp(page, '/signup');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();

    await page.getByRole('button', { name: 'Start free trial' }).click();

    // Native constraint validation gates the form; the JS "complete all
    // fields" branch is only a backstop behind it.
    const missing = await page
      .getByLabel('First name')
      .evaluate((el: HTMLInputElement) => el.validity.valueMissing);
    expect(missing, 'first name reports itself as required').toBe(true);
    await expect(page).toHaveURL(/\/signup/);
    expect(posted, 'no signup request fires for an invalid form').toBe(false);
  });

  test('requires the terms checkbox', async ({ page }) => {
    await page.route('**/api/signup-welcome', (route) => route.fulfill({ status: 202, body: '{}' }));
    await gotoApp(page, '/signup');

    await page.getByLabel('First name').fill('Ada');
    await page.getByLabel('Last name').fill('Lovelace');
    await page.getByLabel('Work email').fill(uniqueEmail());
    await page.getByLabel('Phone number').fill('5550100000');

    await page.getByRole('button', { name: 'Start free trial' }).click();
    await expect(page.getByRole('alert')).toContainText(/Terms and Privacy Policy/i);
  });

  test('a complete form lands on the waitlist confirmation', async ({ page }) => {
    const email = uniqueEmail();
    // Intercept so the run never sends a real waitlist / team-notify email.
    const welcome = page.waitForRequest('**/api/signup-welcome');
    await page.route('**/api/signup-welcome', (route) => route.fulfill({ status: 202, body: '{}' }));

    await gotoApp(page, '/signup');
    await page.getByLabel('First name').fill('Ada');
    await page.getByLabel('Last name').fill('Lovelace');
    await page.getByLabel('Work email').fill(email);
    await page.getByLabel('Phone number').fill('5550100000');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Start free trial' }).click();

    // Terminal state — the waitlist email is the confirmation, not a code.
    await expect(page.getByRole('status')).toContainText(/on the list/i);
    const payload = (await welcome).postDataJSON() as { email: string; firstName: string };
    expect(payload.email).toBe(email);
    expect(payload.firstName).toBe('Ada');

    // The rollout contract: signing up provisions nothing.
    expect(psql(`SELECT count(*) FROM users WHERE email = '${email}'`)).toBe('0');
  });
});

test.describe('login gate', () => {
  test('a non-allowlisted address is pointed at the waitlist, not emailed a code', async ({
    page,
  }) => {
    let codeRequested = false;
    await page.route('**/api/login-code', (route) => {
      codeRequested = true;
      return route.fulfill({ status: 202, body: '{}' });
    });

    await gotoApp(page, '/login');
    await page.getByLabel('Work email').fill(uniqueEmail());
    await page.getByRole('button', { name: 'Send magic link' }).click();

    await expect(page.getByRole('status')).toContainText(/couldn’t find an active account/i);
    expect(codeRequested, 'the gate short-circuits before the API call').toBe(false);
  });
});
