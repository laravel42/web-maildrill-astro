import { describe, expect, it } from 'vitest';
import { MockProvider } from './mock';

const provider = new MockProvider();
const base = {
  messageId: 'm1',
  tenantId: 't1',
  channel: 'email' as const,
  correlationId: 'c1',
  content: {},
};

describe('MockProvider', () => {
  it('accepts normal recipients with a stable message id', async () => {
    const r = await provider.send({ ...base, to: 'user@example.com' });
    expect(r.accepted).toBe(true);
    expect(r.providerMessageId).toMatch(/^mock-/);
    const r2 = await provider.send({ ...base, to: 'user@example.com' });
    expect(r2.providerMessageId).toBe(r.providerMessageId);
  });

  it('permanently rejects reject@ recipients', async () => {
    const r = await provider.send({ ...base, to: 'reject@example.com' });
    expect(r.accepted).toBe(false);
    expect(r.error?.category).toBe('validation');
    expect(r.error?.retryable).toBe(false);
  });

  it('temporarily fails boom@ recipients (retryable)', async () => {
    const r = await provider.send({ ...base, to: 'boom@example.com' });
    expect(r.accepted).toBe(false);
    expect(r.error?.retryable).toBe(true);
  });

  it('normalizes webhook events', async () => {
    const events = await provider.normalizeWebhook({
      headers: {},
      kind: 'delivery',
      rawBody: '',
      body: { events: [{ messageId: 'mock-x', status: 'delivered', eventId: 'e1' }] },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.outcome).toBe('delivered');
    expect(events[0]?.providerMessageId).toBe('mock-x');
    expect(events[0]?.providerEventId).toBe('e1');
  });
});
