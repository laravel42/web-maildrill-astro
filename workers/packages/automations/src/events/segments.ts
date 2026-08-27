import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { config } from '@maildrill/config';
import {
  automations,
  automationSegmentState,
  automationVersions,
  db,
  segments,
  subscribers,
  type SegmentRow,
} from '@maildrill/database';
import {
  emitMaildrillEvent,
  eventDedupeKey,
  projectSubscriber,
  type MaildrillEventType,
} from '@maildrill/domain';
import { evaluateSegment } from '@maildrill/product';
import { createLogger, metrics } from '@maildrill/observability';
import type { PieceTriggerSettings } from '@maildrill/activepieces-core';

const log = createLogger({ component: 'automation-segments' });

/**
 * Segment enter/exit detection.
 *
 * Segments are rule-derived: there is no membership write to observe, so "entered" can
 * only be discovered by diffing. This keeps a materialised membership set
 * (`automation_segment_state`) for exactly the segments an active automation watches, and
 * emits the difference between two passes.
 *
 * Consequences worth stating plainly:
 *   - these triggers are near-real-time, not instant (default 60s);
 *   - the FIRST pass over a segment seeds the set without emitting, otherwise publishing a
 *     workflow would immediately mail every existing member of a segment.
 */
export interface SegmentSweepResult {
  segmentsChecked: number;
  entered: number;
  exited: number;
}

/** Segment ids referenced by a published, active segment trigger. */
async function watchedSegmentIds(): Promise<Map<string, Set<string>>> {
  const rows = await db
    .select({
      tenantId: automations.tenantId,
      trigger: automationVersions.trigger,
    })
    .from(automations)
    .innerJoin(automationVersions, eq(automationVersions.id, automations.publishedVersionId))
    .where(eq(automations.status, 'active'));

  const byTenant = new Map<string, Set<string>>();
  for (const row of rows) {
    const trigger = row.trigger as { settings?: PieceTriggerSettings };
    const settings = trigger.settings;
    if (settings?.pieceName !== '@maildrill/subscribers') continue;
    if (
      settings.triggerName !== 'subscriber_enters_segment' &&
      settings.triggerName !== 'subscriber_exits_segment'
    ) {
      continue;
    }
    const segmentId = settings.input?.segmentId;
    if (typeof segmentId !== 'string' || segmentId.length === 0) continue;
    const set = byTenant.get(row.tenantId) ?? new Set<string>();
    set.add(segmentId);
    byTenant.set(row.tenantId, set);
  }
  return byTenant;
}

export async function sweepSegmentMembership(
  maxSubscribers = config.automations.segmentMaxSubscribers,
): Promise<SegmentSweepResult> {
  const watched = await watchedSegmentIds();
  let segmentsChecked = 0;
  let entered = 0;
  let exited = 0;

  for (const [tenantId, segmentIds] of watched) {
    const rows = await db
      .select()
      .from(segments)
      .where(and(eq(segments.tenantId, tenantId), inArray(segments.id, [...segmentIds])));

    for (const segment of rows) {
      try {
        const diff = await sweepOne(tenantId, segment, maxSubscribers);
        segmentsChecked += 1;
        entered += diff.entered;
        exited += diff.exited;
      } catch (err) {
        log.error(
          {
            tenantId,
            segmentId: segment.id,
            err: err instanceof Error ? err.message : String(err),
          },
          'segment membership sweep failed',
        );
      }
    }
  }

  if (entered > 0 || exited > 0) {
    metrics.inc('automation_segment_transitions_total', {}, entered + exited);
  }
  return { segmentsChecked, entered, exited };
}

async function sweepOne(
  tenantId: string,
  segment: SegmentRow,
  maxSubscribers: number,
): Promise<{ entered: number; exited: number }> {
  const members = (await evaluateSegment(tenantId, segment.id, { limit: maxSubscribers })) ?? [];
  const currentIds = new Set(members.map((m) => m.id));

  const previousRows = await db
    .select({ subscriberId: automationSegmentState.subscriberId })
    .from(automationSegmentState)
    .where(
      and(
        eq(automationSegmentState.tenantId, tenantId),
        eq(automationSegmentState.segmentId, segment.id),
      ),
    );
  const previousIds = new Set(previousRows.map((r) => r.subscriberId));

  // First observation of this segment: seed silently. Emitting here would treat every
  // existing member as having "just entered", which for a welcome workflow means mailing
  // the entire segment the moment it is published.
  const seeding = previousRows.length === 0;

  const enteredMembers = members.filter((m) => !previousIds.has(m.id));
  const exitedIds = [...previousIds].filter((id) => !currentIds.has(id));

  if (enteredMembers.length > 0) {
    await db
      .insert(automationSegmentState)
      .values(
        enteredMembers.map((m) => ({
          tenantId,
          segmentId: segment.id,
          subscriberId: m.id,
        })),
      )
      .onConflictDoNothing();
  }
  if (exitedIds.length > 0) {
    await db
      .delete(automationSegmentState)
      .where(
        and(
          eq(automationSegmentState.segmentId, segment.id),
          inArray(automationSegmentState.subscriberId, exitedIds),
        ),
      );
  }

  if (seeding) return { entered: 0, exited: 0 };

  const stamp = new Date().toISOString();
  for (const member of enteredMembers) {
    await emitSegmentEvent('subscriber.segment.entered', tenantId, segment, member, stamp);
  }
  if (exitedIds.length > 0) {
    // Exits need the subscriber record, which the segment query no longer returns.
    const exitedSubscribers = await db
      .select()
      .from(subscribers)
      .where(and(eq(subscribers.tenantId, tenantId), inArray(subscribers.id, exitedIds)));
    for (const member of exitedSubscribers) {
      await emitSegmentEvent('subscriber.segment.exited', tenantId, segment, member, stamp);
    }
  }

  return { entered: enteredMembers.length, exited: exitedIds.length };
}

async function emitSegmentEvent(
  type: Extract<MaildrillEventType, 'subscriber.segment.entered' | 'subscriber.segment.exited'>,
  tenantId: string,
  segment: SegmentRow,
  subscriber: Parameters<typeof projectSubscriber>[0],
  stamp: string,
): Promise<void> {
  await emitMaildrillEvent({
    type,
    tenantId,
    // The stamp is part of the key on purpose: leaving and re-entering a segment is two
    // real occurrences, and a workflow that welcomes returning members must see both.
    dedupeKey: eventDedupeKey(type, tenantId, segment.id, subscriber.id, stamp),
    data: {
      subscriber: projectSubscriber(subscriber),
      subscriberId: subscriber.id,
      segmentId: segment.id,
      segmentName: segment.name,
    },
  });
}

/**
 * Drop materialised state for segments nothing watches any more, so pausing an automation
 * does not leave its segment's membership set growing forever. Re-activating the
 * automation re-seeds silently, which is the correct behaviour: a paused workflow should
 * not fire for everything that happened while it was off.
 */
export async function pruneUnwatchedSegments(): Promise<number> {
  const watched = await watchedSegmentIds();
  const ids = [...watched.values()].flatMap((set) => [...set]);
  const result = await db
    .delete(automationSegmentState)
    .where(ids.length > 0 ? notInArray(automationSegmentState.segmentId, ids) : undefined)
    .returning({ segmentId: automationSegmentState.segmentId });
  return result.length;
}
