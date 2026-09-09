import { afterAll, describe, expect, it, vi } from 'vitest';

// The AWS SDK talks to real AWS; mock it so this e2e test only needs local
// Postgres + Redis, exactly like flow.e2e.test.ts's mock-provider run — the
// point here is proving Postgres persistence parity between providers, not
// exercising a live SES account (that's ses.test.ts's job, with an injected
// fake client instead of a mocked module).
vi.mock('@aws-sdk/client-sesv2', () => {
  class SendEmailCommand {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  }
  class SESv2Client {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_opts: unknown) {}
    async send(_command: SendEmailCommand) {
      return { MessageId: 'ses-e2e-msg-1', $metadata: { requestId: 'e2e-req-1' } };
    }
  }
  return { SESv2Client, SendEmailCommand };
});

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

describe.skipIf(!run)('SES message flow (e2e — needs Postgres + Redis; AWS SDK mocked)', () => {
  afterAll(async () => {
    await closeDb();
  });

  it('submit → dispatch → delivered produces the same normalized Postgres shape the mock/Infobip path does', async () => {
    const tenant = await ensureTenantByName('e2e-tenant-ses');

    const { message } = await submitMessage({
      tenantId: tenant.id,
      channel: 'email',
      to: 'user@example.com',
      content: { subject: 'hi', html: '<p>hi</p>' },
      provider: 'ses',
    });
    expect(message.status).toBe('queued');

    await handleDispatch({
      version: 1,
      tenantId: tenant.id,
      messageId: message.id,
      channel: 'email',
      provider: 'ses',
      generation: message.generation,
      correlationId: 'c1',
    });

    const submitted = await getMessage(tenant.id, message.id);
    expect(submitted?.status).toBe('submitted');
    expect(submitted?.provider).toBe('ses');
    expect(submitted?.providerMessageId).toBe('ses-e2e-msg-1');

    // Shaped like the real SES → SNS → /webhooks/ses/sns payload, already
    // unwrapped from its SNS envelope (that unwrapping is ses-webhook.ts's
    // job, exercised separately — this proves the shared ingestion pipeline
    // downstream of it, same as flow.e2e.test.ts does for 'mock').
    const sesEvent = {
      eventType: 'Delivery',
      mail: {
        messageId: submitted?.providerMessageId,
        timestamp: new Date().toISOString(),
        tags: { maildrill_message_id: [message.id] },
      },
      delivery: { timestamp: new Date().toISOString(), recipients: ['user@example.com'] },
    };
    const wh = await ingestWebhook({
      provider: 'ses',
      kind: 'delivery',
      headers: {},
      body: sesEvent,
      rawBody: JSON.stringify(sesEvent),
    });
    await processWebhookEvent(wh.webhookEventId);

    const delivered = await getMessage(tenant.id, message.id);
    // Same terminal `messages.status` value Infobip/Cloudflare/mock reach for
    // a delivery report — the whole point of the canonical event model.
    expect(delivered?.status).toBe('delivered');

    // Replaying the identical SNS notification (AWS resends on retry) must
    // not change state or double-count — same guarantee as every other provider.
    const wh2 = await ingestWebhook({
      provider: 'ses',
      kind: 'delivery',
      headers: {},
      body: sesEvent,
      rawBody: JSON.stringify(sesEvent),
    });
    expect(wh2.duplicate).toBe(true);
    await processWebhookEvent(wh2.webhookEventId);
    const stillDelivered = await getMessage(tenant.id, message.id);
    expect(stillDelivered?.status).toBe('delivered');
  });
});
