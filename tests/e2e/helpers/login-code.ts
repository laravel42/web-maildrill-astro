import { execFileSync } from 'node:child_process';
import { createHash, randomInt } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Dev-only login-code minting, shared by the storage-state setup and the specs
 * that drive the sign-in UI by hand.
 *
 * `verifyLoginCode` matches on sha256(`email:code`), so a test can pick the
 * plaintext itself and insert the hash — no email is sent and no previously
 * issued code is revoked. The row is consumed by the login it authorises.
 */

export function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = fs.readFileSync(path.resolve('.env'), 'utf8');
  const line = env.split('\n').find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL not found in .env');
  return line.slice('DATABASE_URL='.length).trim();
}

export function psql(sql: string): string {
  return execFileSync('psql', [databaseUrl(), '-tAc', sql], { encoding: 'utf8' }).trim();
}

/** Insert a fresh login code for `email` and return the plaintext to type in. */
export function mintLoginCode(email: string): string {
  const code = String(randomInt(100_000, 1_000_000));
  const hash = createHash('sha256').update(`${email}:${code}`).digest('hex');
  psql(
    `INSERT INTO magic_link_tokens (email, token_hash, expires_at)
     VALUES ('${email}', '${hash}', now() + interval '10 minutes')`,
  );
  return code;
}
