/**
 * Provider-agnostic payment abstraction. The billing domain (wallet, ledger,
 * pricing, packages) never sees a Stripe object — it speaks these types, and
 * an adapter (Stripe today; Paddle/Adyen/MercadoPago tomorrow) maps them to
 * provider calls. Adding a provider = one new adapter + a registry entry.
 */

export interface CheckoutSessionRequest {
  /** Our correlation id (payment attempt) — becomes the provider's reference. */
  attemptId: string;
  tenantId: string;
  customerId: string | null;
  customerEmail?: string;
  packageName: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** Provider session id, stored on the payment attempt for webhook matching. */
  sessionId: string;
  /** Hosted checkout URL the browser is redirected to. */
  url: string;
}

export interface PortalSession {
  url: string;
}

/** Domain-shaped invoice — providers map their own objects into this. */
export interface BillingInvoice {
  id: string;
  number: string | null;
  status: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  hostedUrl: string | null;
  pdfUrl: string | null;
}

/**
 * Normalized webhook event. `kind: 'unhandled'` keeps unknown types flowing
 * into the event log without financial effect.
 */
export interface PaymentEvent {
  provider: string;
  eventId: string;
  eventType: string;
  kind:
    | 'checkout_completed'
    | 'payment_succeeded'
    | 'payment_failed'
    | 'refund'
    | 'invoice_paid'
    | 'invoice_failed'
    | 'unhandled';
  /** Provider checkout-session id (checkout events). */
  sessionId?: string;
  paymentIntentId?: string;
  chargeId?: string;
  /** Our attempt id when the provider echoed metadata back. */
  attemptId?: string;
  amountCents?: number;
  currency?: string;
  failureReason?: string;
  /** Refunded amount for `refund` events. */
  refundedCents?: number;
  raw: Record<string, unknown>;
}

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}

export interface PaymentProvider {
  readonly name: string;
  readonly configured: boolean;
  /** Create (or return) the provider-side customer for a workspace. */
  createCustomer(input: { tenantId: string; email?: string; name?: string }): Promise<string>;
  createCheckoutSession(input: CheckoutSessionRequest): Promise<CheckoutSession>;
  createPortalSession(customerId: string, returnUrl: string): Promise<PortalSession>;
  listInvoices(customerId: string, limit?: number): Promise<BillingInvoice[]>;
  /**
   * Verify a webhook delivery's signature and normalize it. Throws
   * `WebhookVerificationError` on bad signatures — callers answer 400, never 200.
   */
  parseWebhook(rawBody: string, signatureHeader: string | undefined): PaymentEvent;
}
