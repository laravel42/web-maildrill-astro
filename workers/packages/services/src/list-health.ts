import { and, count, eq, inArray, sql } from 'drizzle-orm';
import { db, listMembers, lists, subscribers } from '@maildrill/database';
import { ConflictError } from '@maildrill/domain';
import { createLogger, metrics } from '@maildrill/observability';

const log = createLogger({ component: 'list-health' });

/**
 * List-level quality gate.
 *
 * The trial tier is protected by validating every recipient against Infobip
 * before a send — affordable only because the trial caps sending at 100
 * emails. A paying account sends orders of magnitude more, so per-address
 * validation at $0.0077 (15× the cost of the send) is not an option. What we
 * can do for free is watch what the list is *made of*: addresses already known
 * to be undeliverable, because they failed validation, hard bounced, or
 * complained.
 *
 * A list that is mostly those is not a mailing list, it is a liability — and
 * mailing it again damages the sending domain for every tenant on the shared
 * account. So it gets suspended until someone cleans it.
 */

/** Statuses that mean "this member can never receive mail". */
const DEAD_STATUSES = ['invalid', 'bounced', 'complained'] as const;

/**
 * Share of dead members that suspends a list.
 *
 * Deliberately far above the 8% hard-bounce send limit: that one measures a
 * *send* going wrong, while this measures a list that was bad before anyone
 * pressed send. A third of a list being undeliverable is not a bad import, it
 * is a list that should not be mailed.
 */
export const LIST_DEAD_SHARE_LIMIT = 0.3;

/**
 * Below this, the share is noise. A five-member list with two bounces is 40%
 * and means nothing.
 */
export const LIST_MIN_MEMBERS = 25;

export interface ListHealth {
  members: number;
  dead: number;
  deadShare: number;
  significant: boolean;
  suspended: boolean;
  reason?: string | null;
}

export async function listHealth(tenantId: string, listId: string): Promise<ListHealth> {
  const [row] = await db
    .select({
      members: count(),
      dead: sql<number>`count(*) filter (where ${inArray(subscribers.status, [...DEAD_STATUSES])})::int`,
    })
    .from(listMembers)
    .innerJoin(subscribers, eq(listMembers.subscriberId, subscribers.id))
    .where(and(eq(listMembers.listId, listId), eq(subscribers.tenantId, tenantId)));

  const [meta] = await db
    .select({ suspendedAt: lists.suspendedAt, reason: lists.suspendedReason })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.tenantId, tenantId)))
    .limit(1);

  const members = Number(row?.members ?? 0);
  const dead = Number(row?.dead ?? 0);
  return {
    members,
    dead,
    deadShare: members === 0 ? 0 : dead / members,
    significant: members >= LIST_MIN_MEMBERS,
    suspended: Boolean(meta?.suspendedAt),
    reason: meta?.reason ?? null,
  };
}

/**
 * Suspend a list whose membership has gone bad, and refuse to send to one that
 * is already suspended.
 *
 * Evaluated at send time rather than on a schedule: it is the moment the
 * decision matters, the numbers are cheap to compute, and a list that has been
 * cleaned since is automatically allowed again — the check is derived from
 * current membership, so removing the dead addresses lifts the suspension on
 * the next attempt.
 */
export async function assertListSendable(tenantId: string, listId: string): Promise<void> {
  const health = await listHealth(tenantId, listId);

  if (health.suspended) {
    // Re-derive: a list cleaned since suspension should not stay locked out.
    if (health.significant && health.deadShare > LIST_DEAD_SHARE_LIMIT) {
      throw new ConflictError(
        `list_suspended: ${health.reason ?? 'too many undeliverable addresses'}. ` +
          'Remove the invalid, bounced and complained members to send to this list again.',
      );
    }
    await db
      .update(lists)
      .set({ suspendedAt: null, suspendedReason: null, updatedAt: new Date() })
      .where(and(eq(lists.id, listId), eq(lists.tenantId, tenantId)));
    log.info({ tenantId, listId }, 'list suspension lifted — membership cleaned');
    return;
  }

  if (!health.significant || health.deadShare <= LIST_DEAD_SHARE_LIMIT) return;

  const pct = `${(health.deadShare * 100).toFixed(1)}%`;
  const reason = `${pct} of members are undeliverable (${health.dead} of ${health.members})`;
  await db
    .update(lists)
    .set({ suspendedAt: new Date(), suspendedReason: reason, updatedAt: new Date() })
    .where(and(eq(lists.id, listId), eq(lists.tenantId, tenantId)));
  metrics.inc('list_suspended_total');
  log.warn({ tenantId, listId, dead: health.dead, members: health.members }, 'list suspended');

  throw new ConflictError(
    `list_suspended: ${reason}. Remove the invalid, bounced and complained members ` +
      'to send to this list again.',
  );
}

/** Members that can still be mailed — used to report what a cleanup would leave. */
export async function liveMemberCount(tenantId: string, listId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(listMembers)
    .innerJoin(subscribers, eq(listMembers.subscriberId, subscribers.id))
    .where(
      and(
        eq(listMembers.listId, listId),
        eq(subscribers.tenantId, tenantId),
        eq(subscribers.status, 'active'),
      ),
    );
  return Number(row?.n ?? 0);
}
