import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StripeProvider, toFormBody, verifyStripeSignature } from './stripe';
import { WebhookVerificationError } from './types';

const SECRET = 'whsec_test_secret';

function sign(payload: string, ts = Math.floor(Date.now() / 1000), secret = SECRET): string {
  const mac = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex');
  return `t=${ts},v1=${mac}`;
}

afterEach(() => vi.unstubAllGlobals());

describe('toFormBody', () => {
  it('flattens nested objects and arrays into bracket notation', () => {
    const body = toFormBody({
      mode: 'payment',
      line_items: [{ quantity: 1, price_data: { unit_amount: 2500 } }],
      metadata: { tenant_id: 't1' },
    });
    expect(body.get('mode')).toBe('payment');
    expect(body.get('line_items[0][quantity]')).toBe('1');
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('2500');
    expect(body.get('metadata[tenant_id]')).toBe('t1');
  });

  it('drops null/undefined values', () => {
    const body = toFormBody({ a: null, b: undefined, c: 0 });
    expect(body.has('a')).toBe(false);
    expect(body.has('b')).toBe(false);
    expect(body.get('c')).toBe('0');
  });
});

describe('verifyStripeSignature', () => {
  const payload = '{"id":"evt_1","type":"checkout.session.completed"}';

  it('accepts a valid signature', () => {
    expect(() => verifyStripeSignature(payload, sign(payload), SECRET)).not.toThrow();
  });

  it('rejects a wrong secret', () => {
    const header = sign(payload, Math.floor(Date.now() / 1000), 'whsec_other');
    expect(() => verifyStripeSignature(payload, header, SECRET)).toThrow(WebhookVerificationError);
  });

  it('rejects a tampered payload', () => {
    expect(() => verifyStripeSignature(payload.replace('evt_1', 'evt_2'), sign(payload), SECRET)).toThrow(
      WebhookVerificationError,
    );
  });

  it('rejects stale timestamps (replay window)', () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    expect(() => verifyStripeSignature(payload, sign(payload, old), SECRET)).toThrow(
      WebhookVerificationError,
    );
  });

  it('rejects malformed headers', () => {
    expect(() => verifyStripeSignature(payload, 'v1=deadbeef', SECRET)).toThrow(
      WebhookVerificationError,
    );
    expect(() => verifyStripeSignature(payload, '', SECRET)).toThrow(WebhookVerificationError);
  });

  it('accepts when any v1 signature matches (key rotation)', () => {
    const ts = Math.floor(Date.now() / 1000);
    const good = createHmac('sha256', SECRET).update(`${ts}.${payload}`).digest('hex');
    const header = `t=${ts},v1=${'0'.repeat(64)},v1=${good}`;
    expect(() => verifyStripeSignature(payload, header, SECRET)).not.toThrow();
  });
});

describe('parseWebhook', () => {
  const provider = new StripeProvider('sk_test', SECRET);

  const wrap = (type: string, object: Record<string, unknown>) =>
    JSON.stringify({ id: 'evt_123', type, data: { object } });

  it('requires the signature header', () => {
    expect(() => provider.parseWebhook('{}', undefined)).toThrow(WebhookVerificationError);
  });

  it('normalizes checkout.session.completed', () => {
    const body = wrap('checkout.session.completed', {
      id: 'cs_1',
      payment_intent: 'pi_1',
      amount_total: 2500,
      currency: 'usd',
      metadata: { attempt_id: 'att_1', tenant_id: 't1' },
    });
    const event = provider.parseWebhook(body, sign(body));
    expect(event.kind).toBe('checkout_completed');
    expect(event.sessionId).toBe('cs_1');
    expect(event.paymentIntentId).toBe('pi_1');
    expect(event.attemptId).toBe('att_1');
    expect(event.amountCents).toBe(2500);
    expect(event.currency).toBe('USD');
  });

  it('normalizes payment failure with the reason', () => {
    const body = wrap('payment_intent.payment_failed', {
      id: 'pi_2',
      last_payment_error: { message: 'card_declined' },
      metadata: { attempt_id: 'att_2' },
    });
    const event = provider.parseWebhook(body, sign(body));
    expect(event.kind).toBe('payment_failed');
    expect(event.failureReason).toBe('card_declined');
  });

  it('normalizes charge.refunded amounts', () => {
    const body = wrap('charge.refunded', {
      id: 'ch_1',
      payment_intent: 'pi_3',
      amount: 2500,
      amount_refunded: 1000,
    });
    const event = provider.parseWebhook(body, sign(body));
    expect(event.kind).toBe('refund');
    expect(event.chargeId).toBe('ch_1');
    expect(event.refundedCents).toBe(1000);
  });

  it('passes unknown event types through as unhandled', () => {
    const body = wrap('customer.updated', { id: 'cus_1' });
    expect(provider.parseWebhook(body, sign(body)).kind).toBe('unhandled');
  });
});

describe('Stripe API client', () => {
  it('creates a checkout session with server-side amounts only', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 'cs_9', url: 'https://checkout.stripe.com/x' }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const provider = new StripeProvider('sk_test', SECRET);
    const session = await provider.createCheckoutSession({
      attemptId: 'att_9',
      tenantId: 't9',
      customerId: 'cus_9',
      packageName: 'Maildrill credits — Top-up $25',
      amountCents: 2500,
      currency: 'USD',
      successUrl: 'https://app/settings?billing=success',
      cancelUrl: 'https://app/settings?billing=cancelled',
    });

    expect(session).toEqual({ sessionId: 'cs_9', url: 'https://checkout.stripe.com/x' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/checkout/sessions');
    const body = init.body as URLSearchParams;
    expect(body.get('mode')).toBe('payment');
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('2500');
    expect(body.get('metadata[attempt_id]')).toBe('att_9');
    expect(body.get('customer')).toBe('cus_9');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer sk_test');
  });

  it('surfaces Stripe API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 }),
      ),
    );
    const provider = new StripeProvider('sk_bad', SECRET);
    await expect(provider.createCustomer({ tenantId: 't1' })).rejects.toThrow(/Invalid API key/);
  });

  it('maps invoices to domain objects', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'in_1',
                number: 'MD-0001',
                status: 'paid',
                amount_paid: 2500,
                total: 2500,
                currency: 'usd',
                created: 1_760_000_000,
                hosted_invoice_url: 'https://invoice',
                invoice_pdf: 'https://invoice.pdf',
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );
    const provider = new StripeProvider('sk_test', SECRET);
    const invoices = await provider.listInvoices('cus_1');
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({
      id: 'in_1',
      number: 'MD-0001',
      status: 'paid',
      amountCents: 2500,
      currency: 'USD',
      hostedUrl: 'https://invoice',
    });
  });
});
