import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '@maildrill/config';
import {
  WebhookVerificationError,
  type BillingInvoice,
  type CheckoutSession,
  type CheckoutSessionRequest,
  type PaymentEvent,
  type PaymentProvider,
  type PortalSession,
} from './types';

/**
 * Stripe adapter — a hand-rolled client over `fetch` against the Stripe REST
 * API (form-encoded), matching how every other provider in this repo is
 * built (Infobip, Cloudflare). No SDK: the surface we use is four endpoints
 * plus webhook signature verification, and `fetch` keeps it testable with the
 * repo's `vi.stubGlobal('fetch', …)` pattern.
 *
 * Stripe's job here is payments only: checkout, customers, portal, invoices,
 * webhook truth. Credits, balances, and pricing never leave Postgres.
 */

const STRIPE_API = 'https://api.stripe.com';
const SIGNATURE_TOLERANCE_SECONDS = 300;

/** Flatten a nested object into Stripe's bracketed form encoding. */
export function toFormBody(params: Record<string, unknown>, prefix = ''): URLSearchParams {
  const out = new URLSearchParams();
  const walk = (value: unknown, key: string): void => {
    if (value == null) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${key}[${i}]`));
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, key ? `${key}[${k}]` : k);
      }
    } else {
      out.append(key, String(value));
    }
  };
  walk(params, prefix);
  return out;
}

/**
 * Verify a `Stripe-Signature` header (`t=<ts>,v1=<hmac>`): HMAC-SHA256 of
 * `"<ts>.<payload>"` with the webhook secret, timestamp within tolerance.
 * Exported for tests.
 */
export function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): void {
  const parts = new Map<string, string[]>();
  for (const piece of header.split(',')) {
    const [k, v] = piece.split('=', 2);
    if (!k || !v) continue;
    const list = parts.get(k.trim()) ?? [];
    list.push(v.trim());
    parts.set(k.trim(), list);
  }
  const timestamp = Number(parts.get('t')?.[0]);
  const signatures = parts.get('v1') ?? [];
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new WebhookVerificationError('malformed Stripe-Signature header');
  }
  if (Math.abs(nowSeconds - timestamp) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new WebhookVerificationError('webhook timestamp outside tolerance');
  }
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  const expectedBuf = Buffer.from(expected, 'utf8');
  const ok = signatures.some((sig) => {
    const sigBuf = Buffer.from(sig, 'utf8');
    return sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf);
  });
  if (!ok) throw new WebhookVerificationError('signature mismatch');
}

interface StripeErrorBody {
  error?: { message?: string; type?: string };
}

export class StripeProvider implements PaymentProvider {
  readonly name = 'stripe';

  constructor(
    private readonly secretKey = config.billing.stripeSecretKey,
    private readonly webhookSecret = config.billing.stripeWebhookSecret,
  ) {}

  get configured(): boolean {
    return Boolean(this.secretKey && this.webhookSecret);
  }

  private async request<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const res = await fetch(`${STRIPE_API}${path}`, {
      method: params ? 'POST' : 'GET',
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        ...(params ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: params ? toFormBody(params) : undefined,
    });
    const body = (await res.json().catch(() => ({}))) as T & StripeErrorBody;
    if (!res.ok) {
      throw new Error(
        `stripe ${path} failed (${res.status}): ${body.error?.message ?? 'unknown error'}`,
      );
    }
    return body;
  }

  async createCustomer(input: {
    tenantId: string;
    email?: string;
    name?: string;
  }): Promise<string> {
    const customer = await this.request<{ id: string }>('/v1/customers', {
      email: input.email,
      name: input.name,
      metadata: { tenant_id: input.tenantId },
    });
    return customer.id;
  }

  async createCheckoutSession(input: CheckoutSessionRequest): Promise<CheckoutSession> {
    const session = await this.request<{ id: string; url: string }>('/v1/checkout/sessions', {
      mode: 'payment',
      client_reference_id: input.attemptId,
      ...(input.customerId
        ? { customer: input.customerId }
        : input.customerEmail
          ? { customer_email: input.customerEmail }
          : {}),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountCents,
            product_data: { name: input.packageName },
          },
        },
      ],
      // Stripe owns taxes + receipts; invoice creation gives customers a
      // downloadable document for every top-up.
      invoice_creation: { enabled: true },
      automatic_tax: { enabled: false },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: { tenant_id: input.tenantId, attempt_id: input.attemptId },
      payment_intent_data: {
        metadata: { tenant_id: input.tenantId, attempt_id: input.attemptId },
      },
    });
    if (!session.url) throw new Error('stripe checkout session has no url');
    return { sessionId: session.id, url: session.url };
  }

  async createPortalSession(customerId: string, returnUrl: string): Promise<PortalSession> {
    const session = await this.request<{ url: string }>('/v1/billing_portal/sessions', {
      customer: customerId,
      return_url: returnUrl,
    });
    return { url: session.url };
  }

  async listInvoices(customerId: string, limit = 20): Promise<BillingInvoice[]> {
    const res = await this.request<{
      data: {
        id: string;
        number: string | null;
        status: string;
        amount_paid: number;
        total: number;
        currency: string;
        created: number;
        hosted_invoice_url: string | null;
        invoice_pdf: string | null;
      }[];
    }>(`/v1/invoices?customer=${encodeURIComponent(customerId)}&limit=${limit}`);
    return (res.data ?? []).map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amountCents: inv.total,
      currency: inv.currency.toUpperCase(),
      createdAt: new Date(inv.created * 1000).toISOString(),
      hostedUrl: inv.hosted_invoice_url,
      pdfUrl: inv.invoice_pdf,
    }));
  }

  parseWebhook(rawBody: string, signatureHeader: string | undefined): PaymentEvent {
    if (!signatureHeader) throw new WebhookVerificationError('missing Stripe-Signature header');
    verifyStripeSignature(rawBody, signatureHeader, this.webhookSecret);

    let event: {
      id?: string;
      type?: string;
      data?: { object?: Record<string, unknown> };
    };
    try {
      event = JSON.parse(rawBody) as typeof event;
    } catch {
      throw new WebhookVerificationError('webhook payload is not valid JSON');
    }
    if (!event.id || !event.type) {
      throw new WebhookVerificationError('webhook payload missing id/type');
    }
    const object = event.data?.object ?? {};
    const str = (key: string): string | undefined =>
      typeof object[key] === 'string' ? (object[key] as string) : undefined;
    const num = (key: string): number | undefined =>
      typeof object[key] === 'number' ? (object[key] as number) : undefined;
    const metadata = (object.metadata ?? {}) as Record<string, unknown>;
    const attemptId =
      typeof metadata.attempt_id === 'string'
        ? metadata.attempt_id
        : (str('client_reference_id') ?? undefined);

    const base = {
      provider: this.name,
      eventId: event.id,
      eventType: event.type,
      attemptId,
      currency: str('currency')?.toUpperCase(),
      raw: object,
    };

    switch (event.type) {
      case 'checkout.session.completed':
        return {
          ...base,
          kind: 'checkout_completed',
          sessionId: str('id'),
          paymentIntentId: str('payment_intent'),
          amountCents: num('amount_total'),
        };
      case 'payment_intent.succeeded':
        return {
          ...base,
          kind: 'payment_succeeded',
          paymentIntentId: str('id'),
          amountCents: num('amount_received') ?? num('amount'),
        };
      case 'payment_intent.payment_failed': {
        const lastError = object.last_payment_error as { message?: string } | undefined;
        return {
          ...base,
          kind: 'payment_failed',
          paymentIntentId: str('id'),
          failureReason: lastError?.message ?? 'payment failed',
        };
      }
      case 'charge.refunded':
        return {
          ...base,
          kind: 'refund',
          chargeId: str('id'),
          paymentIntentId: str('payment_intent'),
          refundedCents: num('amount_refunded'),
          amountCents: num('amount'),
        };
      case 'invoice.payment_succeeded':
        return { ...base, kind: 'invoice_paid' };
      case 'invoice.payment_failed':
        return { ...base, kind: 'invoice_failed' };
      default:
        return { ...base, kind: 'unhandled' };
    }
  }
}
