import validate from 'deep-email-validator';
import { createLogger, metrics } from '@maildrill/observability';

const log = createLogger({ component: 'email-validation' });

/**
 * Address validation at the point of entry — the cheapest place to stop a bad
 * list, and free.
 *
 * Runs four checks locally: syntax, common typos (`gmial.com` → `gmail.com`),
 * disposable providers, and an MX lookup on the domain. Anything that fails
 * lands as `invalid` rather than being rejected outright, so the row still
 * appears in the CRM with a reason instead of vanishing on import.
 *
 * **SMTP verification is deliberately off and must stay off.** The library
 * supports it, but it needs outbound port 25, which is blocked on essentially
 * every VPS and cloud host — including ours. Measured with it on, a real
 * address (`hello@laravel42.com`) takes 10s to time out and is then reported
 * `valid: false, reason: 'smtp'`. Turning it on would mark the entire list
 * invalid and stop all sending. Without it, checks run in 0–70ms.
 *
 * This does not replace Infobip's paid validation, which knows mailbox-level
 * facts we cannot see (`known_hardbounce`, catch-all behaviour). It is the
 * free first pass; at $0.0077 per address — 15× the cost of the send itself —
 * the paid check is only worth spending on what survives this one.
 */

export type InvalidReason = 'regex' | 'typo' | 'disposable' | 'mx' | 'smtp';

export interface EmailValidation {
  valid: boolean;
  /** Which check rejected it. Stored so the CRM can explain the status. */
  reason?: InvalidReason;
  /** Suggested correction for a typo (`didYouMean`), when the library offers one. */
  suggestion?: string;
}

/**
 * MX results, cached per domain for the life of the process.
 *
 * An import of 5,000 rows is typically a few hundred distinct domains, and the
 * DNS lookup is the only slow part of the pass — without this, a bulk import
 * would issue thousands of identical queries.
 */
const domainCache = new Map<string, EmailValidation>();
const DOMAIN_CACHE_MAX = 5_000;

function domainOf(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

/**
 * Validate one address. Never throws: a DNS hiccup must not fail a subscriber
 * add, so an error is treated as "not proven bad" and the address is accepted.
 */
export async function validateEmailAddress(email: string): Promise<EmailValidation> {
  const address = email.trim().toLowerCase();
  if (!address) return { valid: false, reason: 'regex' };

  try {
    const result = await validate({
      email: address,
      validateRegex: true,
      validateTypo: true,
      validateDisposable: true,
      validateMx: true,
      // See the note above — this stays false.
      validateSMTP: false,
    });

    if (result.valid) return { valid: true };

    const reason = (result.reason ?? 'regex') as InvalidReason;
    // Only the MX verdict is a property of the domain; the rest are per-address.
    if (reason === 'mx' && domainCache.size < DOMAIN_CACHE_MAX) {
      domainCache.set(domainOf(address), { valid: false, reason: 'mx' });
    }
    const suggestion = result.validators?.typo?.reason;
    metrics.inc('email_validation_rejected_total', { reason });
    return { valid: false, reason, ...(suggestion ? { suggestion } : {}) };
  } catch (err) {
    log.warn({ err, domain: domainOf(address) }, 'email validation failed — accepting address');
    return { valid: true };
  }
}

/**
 * Validate a batch, reusing the per-domain MX verdict.
 *
 * Addresses are checked concurrently in small waves: the work is DNS-bound, so
 * serial checking would dominate an import's wall-clock, while unbounded
 * concurrency would hammer the resolver.
 */
export async function validateEmailAddresses(
  emails: string[],
  concurrency = 20,
): Promise<Map<string, EmailValidation>> {
  const out = new Map<string, EmailValidation>();
  const pending: string[] = [];

  for (const email of emails) {
    const address = email.trim().toLowerCase();
    if (out.has(address)) continue;
    const cached = domainCache.get(domainOf(address));
    // A dead domain condemns every address on it without another lookup.
    if (cached) out.set(address, cached);
    else pending.push(address);
  }

  for (let i = 0; i < pending.length; i += concurrency) {
    const wave = pending.slice(i, i + concurrency);
    const results = await Promise.all(wave.map((a) => validateEmailAddress(a)));
    wave.forEach((address, j) => out.set(address, results[j]!));
  }
  return out;
}

/** Human-readable note stored on the subscriber so the status explains itself. */
export function invalidReasonLabel(reason: InvalidReason, suggestion?: string): string {
  switch (reason) {
    case 'regex':
      return 'Not a valid email address';
    case 'typo':
      return suggestion ? `Looks like a typo — did you mean ${suggestion}?` : 'Looks like a typo';
    case 'disposable':
      return 'Disposable/temporary address provider';
    case 'mx':
      return 'Domain does not accept email (no MX record)';
    case 'smtp':
      return 'Mailbox rejected by the mail server';
  }
}
