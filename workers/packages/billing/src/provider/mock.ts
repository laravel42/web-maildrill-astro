import { randomUUID } from 'node:crypto';
import type {
  BillingInvoice,
  CheckoutSession,
  CheckoutSessionRequest,
  PaymentEvent,
  PaymentProvider,
  PortalSession,
} from './types';

/**
 * Network-free payment provider for dev and tests, mirroring the messaging
 * mock. Checkout "succeeds" by handing back a fake URL; tests drive the
 * webhook path by feeding `parseWebhook` a JSON body directly (no signature).
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';
  readonly configured = true;

  /** Sessions created in this process, inspectable by tests. */
  readonly sessions: CheckoutSessionRequest[] = [];

  async createCustomer(input: { tenantId: string }): Promise<string> {
    return `mock_cus_${input.tenantId.slice(0, 8)}`;
  }

  async createCheckoutSession(input: CheckoutSessionRequest): Promise<CheckoutSession> {
    this.sessions.push(input);
    const sessionId = `mock_cs_${randomUUID()}`;
    return { sessionId, url: `${input.successUrl}#mock-session=${sessionId}` };
  }

  async createPortalSession(_customerId: string, returnUrl: string): Promise<PortalSession> {
    return { url: returnUrl };
  }

  async listInvoices(): Promise<BillingInvoice[]> {
    return [];
  }

  parseWebhook(rawBody: string): PaymentEvent {
    const event = JSON.parse(rawBody) as Partial<PaymentEvent> & Record<string, unknown>;
    return {
      provider: this.name,
      eventId: (event.eventId as string) ?? `mock_evt_${randomUUID()}`,
      eventType: (event.eventType as string) ?? 'mock.event',
      kind: (event.kind as PaymentEvent['kind']) ?? 'unhandled',
      sessionId: event.sessionId as string | undefined,
      paymentIntentId: event.paymentIntentId as string | undefined,
      chargeId: event.chargeId as string | undefined,
      attemptId: event.attemptId as string | undefined,
      amountCents: event.amountCents as number | undefined,
      currency: event.currency as string | undefined,
      failureReason: event.failureReason as string | undefined,
      refundedCents: event.refundedCents as number | undefined,
      raw: event,
    };
  }
}
