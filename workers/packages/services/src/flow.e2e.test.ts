import { afterAll, describe, expect, it } from 'vitest';
import { closeDb } from '@maildrill/database';
import {
  ensureTenantByName,
  getMessage,
  handleDispatch,
  ingestWebhook,
  processWebhookEvent,
  submitMessage,
} from '@maildrill/services';

// Full-flow test against real Postgres + Redis. Enable with:
//   docker compose up -d && pnpm db:migrate && RUN_E2E=1 pnpm test
const run = process.env.RUN_E2E === '1';

describe.skipIf(!run)('message flow (e2e — needs Postgres + Redis)', () => {
  afterAll(async () => {
    await closeDb();
  });

  it('submit → dispatch → delivered, with idempotent webhook replay', async () => {
    const tenant = await ensureTenantByName('e2e-tenant');

    const { message } = await submitMessage({
      tenantId: tenant.id,
      channel: 'email',
      to: 'user@example.com',
      content: { subject: 'hi', html: '<p>hi</p>' },
      provider: 'mock',
    });
    expect(message.status).toBe('queued');

    await handleDispatch({
      version: 1,
      tenantId: tenant.id,
      messageId: message.id,
      channel: 'email',
      provider: 'mock',
      generation: message.generation,
      correlationId: 'c1',
    });

    const submitted = await getMessage(tenant.id, message.id);
    expect(submitted?.status).toBe('submitted');
    const pmid = submitted?.providerMessageId;
    expect(pmid).toBeTruthy();

    // The event id is derived from this run's message so the test is repeatable:
    // message_events dedupes on (provider, event_fingerprint) across all rows —
    // correct in production, where provider event ids are globally unique — so a
    // hardcoded id would be swallowed as a duplicate on every run after the first.
    const payload = {
      events: [{ messageId: pmid, status: 'delivered', eventId: `evt-${message.id}` }],
    };
    const wh = await ingestWebhook({
      provider: 'mock',
      kind: 'delivery',
      headers: {},
      body: payload,
      rawBody: JSON.stringify(payload),
    });
    await processWebhookEvent(wh.webhookEventId);

    const delivered = await getMessage(tenant.id, message.id);
    expect(delivered?.status).toBe('delivered');

    // Replaying the identical webhook must not change state or double-count.
    const wh2 = await ingestWebhook({
      provider: 'mock',
      kind: 'delivery',
      headers: {},
      body: payload,
      rawBody: JSON.stringify(payload),
    });
    expect(wh2.duplicate).toBe(true);
    await processWebhookEvent(wh2.webhookEventId);
    const stillDelivered = await getMessage(tenant.id, message.id);
    expect(stillDelivered?.status).toBe('delivered');
  });
});
