import fs from 'node:fs';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { mintLoginCode } from './helpers/login-code';

export const STORAGE_STATE = path.resolve('tests/e2e/.auth/user.json');

const EMAIL = process.env.E2E_EMAIL ?? 'team@laravel42.com';

/**
 * Sign in once for the whole suite. Dev-only: mints a one-time login code by
 * inserting its sha256(email:code) hash straight into Postgres — the same
 * shape verifyLoginCode checks — then follows the /auth/verify auto-login
 * link. No email is sent and no previously issued code is revoked; the row is
 * consumed by the login itself.
 */
setup('authenticate', async ({ page }) => {
  const code = mintLoginCode(EMAIL);

  await page.goto(`/auth/verify?email=${encodeURIComponent(EMAIL)}&code=${code}`);
  await page.waitForURL('**/dashboard**', { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
