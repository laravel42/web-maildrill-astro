import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { automationEvents, db, type AutomationEventRow } from '@maildrill/database';
import { createLogger, metrics } from '@maildrill/observability';
import type { PieceTriggerSettings } from '@maildrill/activepieces-core';
import { getTrigger, subscribedEventTypes } from '../pieces/registry';
import { activeVersionsForEvent } from '../runtime/repository';
import { createRun } from '../runtime/runs';

const log = createLogger({ component: 'automation-dispatcher' });

/**
 * Domain event → automation runs.
 *
 * Drains `automation_events` with `FOR UPDATE SKIP LOCKED`, exactly like the outbox
 * publisher, so several dispatchers can run without coordinating. For each event it finds
 * the live automations whose published trigger listens for that event type, applies the
 * trigger's own filter (this list, that segment), and creates one run each.
 *
 * The run's dedupe key is `{versionId}:{eventDedupeKey}`, so:
 *   - a redelivered event cannot start the same automation twice, and
 *   - two different automations DO both run off one event, which is the point.
 */
export interface DispatchResult {
  claimed: number;
  runsCreated: number;
  failed: number;
}

export async function dispatchAutomationEvents(
  batchSize = config.automations.dispatchBatchSize,
): Promise<DispatchResult> {
  const known = new Set(subscribedEventTypes());

  const claimed = await db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(automationEvents)
      .where(
        and(
          eq(automationEvents.status, 'pending'),
          // Compared against the DATABASE's clock, not this process's. `available_at`
          // defaults to the server's `now()`, so a few milliseconds of skew between the
          // app host and Postgres is enough to make a just-inserted row look scheduled in
          // the future and be skipped. That self-heals on the next tick, but it means an
          // event can sit for a poll interval for no reason — and it made the end-to-end
          // test flaky, which is how it was found.
          lte(automationEvents.availableAt, sql`now()`),
        ),
      )
      .orderBy(asc(automationEvents.availableAt))
      .limit(batchSize)
      .for('update', { skipLocked: true });

    if (rows.length === 0) return [] as AutomationEventRow[];
    await tx
      .update(automationEvents)
      .set({ status: 'processing' })
      .where(
        and(
          eq(automationEvents.status, 'pending'),
          // Claim exactly the rows this transaction locked.
          inArray(
            automationEvents.id,
            rows.map((r) => r.id),
          ),
        ),
      );
    return rows;
  });

  let runsCreated = 0;
  let failed = 0;

  for (const event of claimed) {
    try {
      if (!known.has(event.type)) {
        // No trigger listens for this type. Mark it processed rather than retrying
        // forever — the event is recorded, it simply starts nothing today.
        await settle(event.id, 'processed');
        continue;
      }
      runsCreated += await dispatchOne(event);
      await settle(event.id, 'processed');
    } catch (err) {
      failed += 1;
      const message = err instanceof Error ? err.message : String(err);
      log.error(
        { eventId: event.id, type: event.type, err: message },
        'automation dispatch failed',
      );
      await db
        .update(automationEvents)
        .set({
          status: 'pending',
          attemptCount: event.attemptCount + 1,
          lastError: message,
          // Linear backoff: the failure is almost always the database being briefly
          // unavailable, and an event that waits minutes is a workflow that fires late.
          availableAt: new Date(Date.now() + Math.min(event.attemptCount + 1, 10) * 5_000),
        })
        .where(eq(automationEvents.id, event.id));
    }
  }

  if (claimed.length > 0) {
    metrics.inc('automation_events_dispatched_total', {}, claimed.length);
    metrics.setGauge('automation_trigger_latency_ms', latencyOf(claimed));
  }
  return { claimed: claimed.length, runsCreated, failed };
}

function latencyOf(events: AutomationEventRow[]): number {
  const now = Date.now();
  const total = events.reduce((sum, e) => sum + (now - e.occurredAt.getTime()), 0);
  return Math.round(total / events.length);
}

async function settle(id: string, status: 'processed' | 'failed'): Promise<void> {
  await db
    .update(automationEvents)
    .set({ status, processedAt: new Date() })
    .where(eq(automationEvents.id, id));
}

async function dispatchOne(event: AutomationEventRow): Promise<number> {
  const candidates = await activeVersionsForEvent(event.tenantId);
  if (candidates.length === 0) return 0;

  const payload = event.payload;
  const originAutomationId =
    typeof payload._originAutomationId === 'string' ? payload._originAutomationId : null;

  let created = 0;
  for (const { automation, version } of candidates) {
    const trigger = version.trigger as {
      settings?: PieceTriggerSettings;
    };
    const settings = trigger.settings;
    if (!settings?.pieceName || !settings.triggerName) continue;

    const definition = getTrigger(settings.pieceName, settings.triggerName);
    if (!definition || !definition.eventTypes.includes(event.type)) continue;

    // Recursion guard: an automation may not be re-triggered by its own effects. Without
    // this, "tag added → add tag" is an infinite fan-out that the step budget cannot stop,
    // because each iteration is a fresh run.
    if (originAutomationId && originAutomationId === automation.id) {
      metrics.inc('automation_runs_rejected_total', { reason: 'self_trigger' });
      continue;
    }

    if (definition.matches && !definition.matches({ propsValue: settings.input ?? {}, payload })) {
      continue;
    }

    const result = await createRun({
      tenantId: event.tenantId,
      automationId: automation.id,
      automationVersionId: version.id,
      source: 'event',
      triggerPayload: payload,
      dedupeKey: `${version.id}:${event.dedupeKey}`,
    });
    if (result.runId) created += 1;
  }
  return created;
}
