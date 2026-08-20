import { definePiece, defineTrigger, Property } from '@maildrill/activepieces-core';
import type { MaildrillPieceContext } from './context';

/**
 * Entry points that are not domain events: an inbound webhook, and a manual start.
 *
 * Neither declares `eventTypes`, so the dispatcher ignores them — they are started by the
 * webhook route and the "Run test" button respectively.
 */
export const webhookPiece = definePiece<MaildrillPieceContext>({
  name: '@maildrill/webhook',
  displayName: 'Webhook',
  description: 'Start an automation from an external system.',
  version: '1.0.0',
  accent: '--text3',
  actions: [],
  triggers: [
    defineTrigger({
      name: 'catch_webhook',
      displayName: 'Incoming webhook',
      description:
        'Publishing this automation mints a private URL. Anything POSTed to it starts a run, and the body is available as {{trigger.body}}.',
      category: 'Webhooks',
      accent: '--text3',
      props: {},
      eventTypes: [],
      samplePayload: {
        body: { orderId: 'A-1042', email: 'ada@example.com' },
        query: { source: 'shop' },
        headers: { 'content-type': 'application/json' },
        receivedAt: '2026-01-01T00:00:00.000Z',
      },
    }),
  ],
});

export const manualPiece = definePiece<MaildrillPieceContext>({
  name: '@maildrill/manual',
  displayName: 'Manual',
  description: 'Start an automation by hand.',
  version: '1.0.0',
  accent: '--text3',
  actions: [],
  triggers: [
    defineTrigger({
      name: 'manual_trigger',
      displayName: 'Manual trigger',
      description: 'Runs only when someone presses Run — useful while building.',
      category: 'Manual',
      accent: '--text3',
      props: {
        samplePayload: Property.Json({
          displayName: 'Test payload',
          description: 'The JSON handed to the run as {{trigger}}.',
        }),
      },
      eventTypes: [],
      samplePayload: { startedBy: 'you@example.com' },
    }),
  ],
});
