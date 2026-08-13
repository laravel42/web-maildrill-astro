import { expect, test } from '@playwright/test';
import { gotoApp } from './helpers/app';
import { mintLoginCode } from './helpers/login-code';

/**
 * The sign-in UI itself, end to end: request a code, type it into the six
 * digit boxes, land in the workspace. `auth.setup.ts` deliberately skips this
 * (it jumps to the /auth/verify link to save time for every other spec), so
 * without this file the login form is never actually exercised.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const EMAIL = process.env.E2E_EMAIL ?? 'team@laravel42.com';

test.describe('login', () => {
  test('code request → 6-digit entry → dashboard', async ({ page }) => {
    // Let the real request through (it mints a code we cannot read), then mint
    // our own — verifyLoginCode matches any unconsumed, unexpired hash.
    await gotoApp(page, '/login');
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();

    await page.getByLabel('Work email').fill(EMAIL);
    await page.getByRole('button', { name: 'Send magic link' }).click();

    // Code stage: six positional inputs.
    const firstDigit = page.getByLabel('Digit 1');
    await expect(firstDigit).toBeVisible({ timeout: 15_000 });

    const code = mintLoginCode(EMAIL);
    for (const [i, digit] of [...code].entries()) {
      await page.getByLabel(`Digit ${i + 1}`).fill(digit);
    }
    // Completing the boxes enables "Verify code"; it does not auto-submit.
    await page.getByRole('button', { name: 'Verify code' }).click();

    await page.waitForURL('**/dashboard**', { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Good/);
  });

  test('a wrong code is rejected and stays on the form', async ({ page }) => {
    await gotoApp(page, '/login');
    await page.getByLabel('Work email').fill(EMAIL);
    await page.getByRole('button', { name: 'Send magic link' }).click();
    await expect(page.getByLabel('Digit 1')).toBeVisible({ timeout: 15_000 });

    for (let i = 0; i < 6; i++) await page.getByLabel(`Digit ${i + 1}`).fill('0');
    await page.getByRole('button', { name: 'Verify code' }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('the dashboard is closed to anonymous visitors', async ({ page }) => {
    await gotoApp(page, '/dashboard');
    await page.waitForURL(/\/login/, { timeout: 15_000 });
  });
});
