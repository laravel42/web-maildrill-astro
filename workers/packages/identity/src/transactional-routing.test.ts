import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Architecture guard: transactional email must ride the Cloudflare SMTP relay
 * (`sendTransactionalEmail` → nodemailer), never the campaign provider
 * (Infobip). The two lanes are deliberately separate — campaign sender
 * reputation must not be able to sink sign-in deliverability, and a login code
 * must not queue behind a campaign send.
 *
 * These read source text rather than execute, so they catch the regression at
 * the import level without needing SMTP or a database.
 */

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/**
 * Comments explain *why* the lanes are separate and legitimately name Infobip,
 * so assertions run against code only — otherwise the documentation trips the
 * guard it is documenting.
 */
const codeOnly = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const TRANSACTIONAL_SENDERS = [
  ['login code', './magic-link.ts'],
  ['welcome', './welcome.ts'],
  ['workspace member added', '../../services/src/workspace.ts'],
] as const;

describe('transactional email routing', () => {
  it.each(TRANSACTIONAL_SENDERS)('%s uses the SMTP relay', (_name, path) => {
    expect(read(path)).toContain('sendTransactionalEmail');
  });

  it.each(TRANSACTIONAL_SENDERS)('%s never reaches for the campaign provider', (_name, path) => {
    const src = codeOnly(read(path));
    // getProvider() is the Infobip/Cloudflare-API campaign driver; submitMessage
    // enqueues onto the campaign dispatch pipeline. Neither belongs here.
    expect(src).not.toMatch(/\bgetProvider\b/);
    expect(src).not.toMatch(/\bsubmitMessage\b/);
  });

  it('the transactional mailer itself is SMTP, not an HTTP provider API', () => {
    const src = codeOnly(read('../../providers/src/transactional.ts'));
    expect(src).toContain('nodemailer');
    expect(src).not.toMatch(/\bgetProvider\b/);
    expect(src).not.toMatch(/infobip/i);
  });
});
