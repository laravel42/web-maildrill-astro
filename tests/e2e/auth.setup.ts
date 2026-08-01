import { execFileSync } from 'node:child_process';
import { createHash, randomInt } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';

export const STORAGE_STATE = path.resolve('tests/e2e/.auth/user.json');

const EMAIL = process.env.E2E_EMAIL ?? 'hello@laravel42.com';

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.resolve('.env'), 'utf8');
  const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL not found in .env');
  return line.slice('DATABASE_URL='.length).trim();
}

/**
 * Sign in once for the whole suite. Dev-only: mints a one-time login code by
 * inserting its sha256(email:code) hash straight into Postgres — the same
 * shape verifyLoginCode checks — then follows the /auth/verify auto-login
 * link. No email is sent and no previously issued code is revoked; the row is
 * consumed by the login itself.
 */
setup('authenticate', async ({ page }) => {
  const code = String(randomInt(100_000, 1_000_000));
  const hash = createHash('sha256').update(`${EMAIL}:${code}`).digest('hex');
  execFileSync('psql', [
    databaseUrl(),
    '-c',
    `INSERT INTO magic_link_tokens (email, token_hash, expires_at)
     VALUES ('${EMAIL}', '${hash}', now() + interval '10 minutes')`,
  ]);

  await page.goto(`/auth/verify?email=${encodeURIComponent(EMAIL)}&code=${code}`);
  await page.waitForURL('**/dashboard**', { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });
  await page.context().storageState({ path: STORAGE_STATE });
});
