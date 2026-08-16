import { afterAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { closeDb, db, messages, subscribers } from '@maildrill/database';
import { ensureTenantByName } from './tenants';
import { applyProviderOutcome, applyTrackingOutcome } from './events';
import {
  engagementDeltaFor,
  reconcileSubscriberEngagement,
  seedSubscriberEngagement,
} from './engagement';

describe('engagementDeltaFor', () => {
  it('counts a delivery once, however the message got there', () => {
    // Infobip's SEEN report routinely lands before the DLR, so a message can
    // reach `read` from `sent` without passing through `delivered`. Both routes
    // have to add exactly one delivery.
    expect(engagementDeltaFor('submitted', 'delivered', 'email')).toEqual({
      delivered: 1,
      trackedDelivered: 1,
      opened: 0,
      clicked: 0,
    });
    expect(engagementDeltaFor('sent', 'read', 'email')).toEqual({
      delivered: 1,
      trackedDelivered: 1,
      opened: 1,
      clicked: 0,
    });
    // delivered → read is the open only; the delivery was already counted.
    expect(engagementDeltaFor('delivered', 'read', 'email')).toEqual({
      delivered: 0,
      trackedDelivered: 0,
      opened: 1,
      clicked: 0,
    });
  });

  it('keeps SMS and voice out of the rate denominator', () => {
    // Neither channel can report an open, so counting their deliveries would
    // push every rate down by however much SMS the workspace sends.
    expect(engagementDeltaFor('sent', 'delivered', 'sms').trackedDelivered).toBe(0);
    expect(engagementDeltaFor('sent', 'delivered', 'voice').trackedDelivered).toBe(0);
    expect(engagementDeltaFor('sent', 'delivered', 'whatsapp').trackedDelivered).toBe(1);
  });

  it('is a difference, so a state that loses its delivery gives it back', () => {
    expect(engagementDeltaFor('read', 'failed', 'email')).toEqual({
      delivered: -1,
      trackedDelivered: -1,
      opened: -1,
      clicked: 0,
    });
  });
});

// Real Postgres. Enable with:
//   docker compose up -d && pnpm db:migrate && RUN_E2E=1 pnpm test
const run = process.env.RUN_E2E === '1';

describe.skipIf(!run)('subscriber_engagement stays current (e2e — needs Postgres)', () => {
  afterAll(async () => {
    await closeDb();
  });

  it('follows delivery, open and click, and agrees with a full recompute', async () => {
    const tenant = await ensureTenantByName('engagement-e2e-tenant');
    const email = `rollup-${Date.now()}@example.com`;
    const [sub] = await db
      .insert(subscribers)
      .values({ tenantId: tenant.id, email, name: 'Rollup Probe' })
      .returning({ id: subscribers.id });
    const subscriberId = sub!.id;

    const readRollup = async () => {
      const rows = await db.execute<{
        delivered: number;
        tracked_delivered: number;
        opened: number;
        clicked: number;
        opens_bucket: number;
        clicks_bucket: number;
      }>(sql`select delivered, tracked_delivered, opened, clicked, opens_bucket, clicks_bucket
               from subscriber_engagement where subscriber_id = ${subscriberId}::uuid`);
      return rows.rows[0];
    };

    try {
      await seedSubscriberEngagement(db, tenant.id, subscriberId);
      // Never mailed is -1, not 0: it is a different fact from "mailed, never
      // opened", and it is the bucket the roster's "—" used to hide.
      expect(await readRollup()).toMatchObject({ opens_bucket: -1, clicks_bucket: -1 });

      const [msg] = await db
        .insert(messages)
        .values({
          tenantId: tenant.id,
          recipientId: subscriberId,
          toAddress: email,
          channel: 'email',
          provider: 'mock',
          status: 'submitted',
        })
        .returning({ id: messages.id });
      const messageId = msg!.id;

      await applyProviderOutcome({
        messageId,
        tenantId: tenant.id,
        channel: 'email',
        provider: 'mock',
        currentStatus: 'submitted',
        outcome: 'delivered',
        statusGroup: 'DELIVERED',
      });
      expect(await readRollup()).toMatchObject({
        delivered: 1,
        tracked_delivered: 1,
        opened: 0,
        opens_bucket: 0,
        clicks_bucket: 0,
      });

      await applyProviderOutcome({
        messageId,
        tenantId: tenant.id,
        channel: 'email',
        provider: 'mock',
        currentStatus: 'delivered',
        outcome: 'read',
        statusGroup: 'SEEN',
      });
      expect(await readRollup()).toMatchObject({ delivered: 1, opened: 1, opens_bucket: 3 });

      await applyTrackingOutcome({
        messageId,
        tenantId: tenant.id,
        channel: 'email',
        provider: 'mock',
        currentStatus: 'read',
        notificationType: 'CLICKED',
        fingerprint: `click-a-${messageId}`,
      });
      expect(await readRollup()).toMatchObject({ clicked: 1, clicks_bucket: 3 });

      // A second click on the SAME message must not move the counter: the click
      // rate counts messages clicked, not clicks.
      await applyTrackingOutcome({
        messageId,
        tenantId: tenant.id,
        channel: 'email',
        provider: 'mock',
        currentStatus: 'read',
        notificationType: 'CLICKED',
        fingerprint: `click-b-${messageId}`,
      });
      expect(await readRollup()).toMatchObject({ clicked: 1, clicks_bucket: 3 });

      // The strongest assertion available: recomputing from `messages` changes
      // nothing, so the incremental path and the reconciler agree.
      const repaired = await reconcileSubscriberEngagement({ tenantId: tenant.id });
      expect(repaired.written).toBe(0);
    } finally {
      await db.delete(messages).where(eq(messages.recipientId, subscriberId));
      await db
        .delete(subscribers)
        .where(and(eq(subscribers.id, subscriberId), eq(subscribers.tenantId, tenant.id)));
    }
  });
});
