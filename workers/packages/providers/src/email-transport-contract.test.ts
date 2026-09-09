import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudflareProvider } from './cloudflare';
import { SesProvider, type SesClientLike } from './ses';
import type { MessagingProvider, SendInput } from './core';

/**
 * Both Cloudflare and SES are interchangeable, email-only `MessagingProvider`
 * implementations selected purely by `PROVIDER_EMAIL_DRIVER` — the same
 * `SendInput` in, the same normalized `ProviderSendResult`/
 * `NormalizedProviderEvent[]` shape out, regardless of which one is active.
 * This file asserts that contract directly instead of only per-adapter, so a
 * future email transport (SendGrid, Mailgun, Postmark, Resend, SMTP…) has a
 * concrete, provider-agnostic bar to pass.
 */

const base: SendInput = {
  messageId: 'm1',
  tenantId: 't1',
  channel: 'email',
  to: 'user@example.com',
  correlationId: 'c1',
  content: { subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' },
};

function cloudflareHappy(): MessagingProvider {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, result: { queued: [base.to], message_id: 'cf-msg-1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ),
  );
  return new CloudflareProvider({ accountId: 'acct', apiToken: 'tok', from: 'no-reply@maildrill.net' });
}

function sesHappy(): MessagingProvider {
  const client: SesClientLike = { send: vi.fn().mockResolvedValue({ MessageId: 'ses-1', $metadata: { requestId: 'req-1' } }) };
  return new SesProvider({ region: 'us-east-1', from: 'no-reply@maildrill.net' }, client);
}

const CASES: Array<[string, () => MessagingProvider]> = [
  ['cloudflare', cloudflareHappy],
  ['ses', sesHappy],
];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(CASES)('EmailTransport contract — %s', (name, factory) => {
  it('exposes its own driver name', () => {
    const provider = factory();
    expect(provider.name).toBe(name);
  });

  it('accepts a normalized SendInput and returns a normalized, provider-neutral result', async () => {
    const provider = factory();
    const result = await provider.send(base);
    expect(result).toMatchObject({ accepted: true, status: 'submitted' });
    expect(typeof result.providerMessageId).toBe('string');
    expect((result.providerMessageId ?? '').length).toBeGreaterThan(0);
    expect(result.error).toBeUndefined();
    // Never leak an SDK/API response object where a plain result is expected.
    expect(result.constructor).toBe(Object);
  });

  it('rejects a non-email channel with a non-retryable validation error', async () => {
    const provider = factory();
    const result = await provider.send({ ...base, channel: 'sms', to: '+15551234567' });
    expect(result.accepted).toBe(false);
    expect(result.status).toBe('rejected');
    expect(result.error).toMatchObject({ category: 'validation', retryable: false });
  });

  it('normalizeWebhook returns entries shaped as canonical NormalizedProviderEvent', async () => {
    const provider = factory();
    const fixture =
      name === 'ses'
        ? {
            eventType: 'Delivery',
            mail: { messageId: 'pmid-1', timestamp: '2026-07-31T12:00:00.000Z', tags: {} },
            delivery: { timestamp: '2026-07-31T12:00:05.000Z' },
          }
        : {
            type: 'cf.email.sending.message.delivered',
            payload: { eventId: 'evt-1', messageId: 'pmid-1' },
            metadata: { eventTimestamp: '2026-07-31T12:00:00.000Z' },
          };
    const events = await provider.normalizeWebhook({
      headers: {},
      body: fixture,
      rawBody: JSON.stringify(fixture),
      kind: 'delivery',
    });
    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event!.outcome).toBe('delivered');
    expect(typeof event!.eventType).toBe('string');
    expect(event!.providerMessageId).toBe('pmid-1');
    expect(event!.occurredAt).toBeInstanceOf(Date);
    expect(event!.raw).toBeTypeOf('object');
  });
});
