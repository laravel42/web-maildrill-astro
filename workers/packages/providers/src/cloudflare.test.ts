import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudflareProvider } from './cloudflare';

const settings = {
  accountId: 'acct-1',
  apiToken: 'tok-secret',
  from: 'no-reply@maildrill.net',
};

const base = {
  messageId: 'm1',
  tenantId: 't1',
  channel: 'email' as const,
  to: 'user@example.com',
  correlationId: 'c1',
  content: { subject: 'Hi', html: '<p>Hi</p>', text: 'Hi' },
};

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function stubFetch(...responses: Response[]) {
  const fn = vi.fn();
  for (const res of responses) fn.mockResolvedValueOnce(res);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CloudflareProvider', () => {
  it('submits an email and shapes the REST body (address parsing, snake_case reply_to)', async () => {
    const fetchMock = stubFetch(
      jsonResponse(
        200,
        { success: true, result: { delivered: [], permanent_bounces: [], queued: [base.to] } },
        { 'cf-ray': 'ray-1' },
      ),
    );
    const provider = new CloudflareProvider(settings);
    const r = await provider.send({
      ...base,
      content: {
        ...base.content,
        from: 'Maildrill News <news@maildrill.net>',
        replyTo: 'help@maildrill.net',
      },
    });

    expect(r.accepted).toBe(true);
    expect(r.status).toBe('submitted');
    expect(r.providerRequestId).toBe('ray-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/accounts/acct-1/email/sending/send');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok-secret');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      to: base.to,
      from: { address: 'news@maildrill.net', name: 'Maildrill News' },
      reply_to: { address: 'help@maildrill.net' },
      subject: 'Hi',
      html: '<p>Hi</p>',
      text: 'Hi',
    });
  });

  it('falls back to the configured From when the campaign carries none', async () => {
    const fetchMock = stubFetch(
      jsonResponse(200, { success: true, result: { queued: [base.to] } }),
    );
    const provider = new CloudflareProvider(settings);
    await provider.send(base);
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.from).toEqual({ address: 'no-reply@maildrill.net' });
  });

  it('rejects suppressed recipients (permanent_bounces) as permanent, not retryable', async () => {
    stubFetch(
      jsonResponse(200, {
        success: true,
        result: { delivered: [], permanent_bounces: [base.to], queued: [] },
      }),
    );
    const provider = new CloudflareProvider(settings);
    const r = await provider.send(base);
    expect(r.accepted).toBe(false);
    expect(r.error?.category).toBe('permanent');
    expect(r.error?.code).toBe('permanent_bounce');
    expect(r.error?.retryable).toBe(false);
  });

  it('maps 400 to a non-retryable validation error with the API message', async () => {
    stubFetch(
      jsonResponse(400, {
        success: false,
        errors: [{ code: 1000, message: 'Sender domain not verified' }],
        result: null,
      }),
    );
    const provider = new CloudflareProvider(settings);
    const r = await provider.send(base);
    expect(r.accepted).toBe(false);
    expect(r.error?.category).toBe('validation');
    expect(r.error?.code).toBe('1000');
    expect(r.error?.message).toContain('Sender domain not verified');
    expect(r.error?.retryable).toBe(false);
  });

  it('maps 429 to a retryable rate_limit error', async () => {
    stubFetch(
      jsonResponse(429, { success: false, errors: [{ code: 971, message: 'rate limited' }] }),
    );
    const provider = new CloudflareProvider(settings);
    const r = await provider.send(base);
    expect(r.accepted).toBe(false);
    expect(r.error?.category).toBe('rate_limit');
    expect(r.error?.retryable).toBe(true);
  });

  it('rejects non-email channels without calling the API', async () => {
    const fetchMock = stubFetch();
    const provider = new CloudflareProvider(settings);
    const r = await provider.send({ ...base, channel: 'sms', to: '+15551234567' });
    expect(r.accepted).toBe(false);
    expect(r.error?.category).toBe('validation');
    expect(r.error?.retryable).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with a config hint when account id / token are missing', async () => {
    const fetchMock = stubFetch();
    const provider = new CloudflareProvider({ accountId: '', apiToken: '', from: '' });
    const r = await provider.send(base);
    expect(r.accepted).toBe(false);
    expect(r.error?.message).toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries once on network failure, then reports a retryable error', async () => {
    const err = Object.assign(new Error('connect ECONNRESET'), { code: 'ECONNRESET' });
    const fn = vi.fn().mockRejectedValue(err);
    vi.stubGlobal('fetch', fn);
    const provider = new CloudflareProvider(settings);
    const r = await provider.send(base);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(r.accepted).toBe(false);
    expect(r.error?.category).toBe('temporary');
    expect(r.error?.retryable).toBe(true);
  });

  describe('normalizeWebhook (event subscriptions)', () => {
    const delivered = {
      type: 'cf.email.sending.message.delivered',
      source: { type: 'email', zoneId: 'z1', domain: 'maildrill.net' },
      payload: {
        eventId: 'evt-1',
        messageId: '<abc@maildrill.net>',
        sender: 'no-reply@maildrill.net',
        recipient: 'user@example.com',
        subject: 'Hi',
        terminal: true,
        delivery: { status: '250 OK' },
      },
      metadata: { accountId: 'acct-1', eventTimestamp: '2026-07-31T12:00:00Z' },
    };

    it('maps message.delivered to a delivered outcome correlated by message id', async () => {
      const provider = new CloudflareProvider(settings);
      const events = await provider.normalizeWebhook({
        headers: {},
        body: delivered,
        rawBody: JSON.stringify(delivered),
        kind: 'delivery',
      });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        providerEventId: 'evt-1',
        providerMessageId: '<abc@maildrill.net>',
        eventType: 'message.delivered',
        outcome: 'delivered',
        providerStatus: '250 OK',
      });
      expect(events[0]!.occurredAt?.toISOString()).toBe('2026-07-31T12:00:00.000Z');
    });

    it.each([
      ['bounced', 'failed'],
      ['failed', 'failed'],
      ['rejected', 'failed'],
      ['deferred', 'submitted'],
      ['complained', 'delivered'],
    ])('maps message.%s to outcome %s', async (name, outcome) => {
      const provider = new CloudflareProvider(settings);
      const event = { ...delivered, type: `cf.email.sending.message.${name}` };
      const events = await provider.normalizeWebhook({
        headers: {},
        body: event,
        rawBody: JSON.stringify(event),
        kind: 'delivery',
      });
      expect(events[0]?.outcome).toBe(outcome);
      expect(events[0]?.eventType).toBe(`message.${name}`);
    });

    it('accepts bare arrays and {events} wrappers, skipping unknown types', async () => {
      const provider = new CloudflareProvider(settings);
      const junk = { type: 'cf.email.sending.something.else' };
      const asArray = await provider.normalizeWebhook({
        headers: {},
        body: [delivered, junk],
        rawBody: '',
        kind: 'delivery',
      });
      expect(asArray).toHaveLength(1);
      const wrapped = await provider.normalizeWebhook({
        headers: {},
        body: { events: [delivered, delivered] },
        rawBody: '',
        kind: 'delivery',
      });
      expect(wrapped).toHaveLength(2);
    });
  });
});
