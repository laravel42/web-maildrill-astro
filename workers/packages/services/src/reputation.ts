import { and, count, eq, gte, inArray, sql } from 'drizzle-orm';
import { db, messageEvents, messages } from '@maildrill/database';
import { ConflictError, type Channel } from '@maildrill/domain';

/**
 * Deliverability guard rails.
 *
 * Mailing a list that bounces hard is how a sending domain gets burned — for
 * the workspace doing it and for every other workspace sharing the account.
 * These are the numbers that decide whether a send is allowed to start, and
 * whether one already running should be stopped.
 *
 * Only meaningful because the feedback loop is closed (see `suppression.ts`):
 * a hard bounce now removes the address, so a bad rate is something a customer
 * can actually recover from by sending again to what is left.
 */

/**
 * Thresholds, as fractions.
 *
 * Anchored to the bulk-sender rules Gmail and Yahoo publish: complaints must
 * stay under 0.3% and ideally under 0.1%, so 0.3% is where we stop. Bounces
 * have no published number, but mailbox providers and ESPs treat 5% as the
 * warning line and suspend around 10% — blocking at 8% leaves room to react
 * without waiting for the provider to act first.
 */
export const DELIVERABILITY_LIMITS = Object.freeze({
  /** Hard bounces ÷ (delivered + failed). */
  hardBounceRate: 0.08,
  /** Complaints ÷ delivered. */
  complaintRate: 0.003,
});

/**
 * Below this many resolved messages the rates are noise — one bounce out of
 * three sends is 33% and means nothing. A new workspace must be able to send
 * its first test campaign without tripping anything.
 */
export const MIN_SAMPLE = 50;

/** How far back the rates look. Old failures should stop counting. */
export const WINDOW_DAYS = 30;

export interface Deliverability {
  /** Messages that reached a terminal outcome in the window. */
  sample: number;
  hardBounces: number;
  complaints: number;
  hardBounceRate: number;
  complaintRate: number;
  /** False while `sample < MIN_SAMPLE` — rates exist but must not be acted on. */
  significant: boolean;
}

/** Terminal outcomes — a queued message has not proven anything yet. */
const RESOLVED = ['delivered', 'read', 'failed'] as const;

/**
 * Recent deliverability for one workspace + channel.
 *
 * Hard bounces are counted from `lastErrorPermanent`, not from "failed": a
 * temporary failure (full mailbox, handset off) is not the customer's fault
 * and must not count against them.
 */
export async function deliverabilityFor(
  tenantId: string,
  channel: Channel,
  since = new Date(Date.now() - WINDOW_DAYS * 86_400_000),
): Promise<Deliverability> {
  const scope = and(
    eq(messages.tenantId, tenantId),
    eq(messages.channel, channel),
    gte(messages.createdAt, since),
  );

  const [totals] = await db
    .select({
      sample: count(),
      hardBounces: sql<number>`count(*) filter (where ${messages.lastErrorPermanent} is true)`,
    })
    .from(messages)
    .where(and(scope, inArray(messages.status, [...RESOLVED])));

  const [complaintRow] = await db
    .select({ complaints: count() })
    .from(messageEvents)
    .innerJoin(messages, eq(messageEvents.messageId, messages.id))
    .where(and(scope, eq(messageEvents.eventType, 'complaint')));

  const sample = Number(totals?.sample ?? 0);
  const hardBounces = Number(totals?.hardBounces ?? 0);
  const complaints = Number(complaintRow?.complaints ?? 0);

  return {
    sample,
    hardBounces,
    complaints,
    hardBounceRate: sample === 0 ? 0 : hardBounces / sample,
    complaintRate: sample === 0 ? 0 : complaints / sample,
    significant: sample >= MIN_SAMPLE,
  };
}

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

/** The reason a send is refused, or null when it is fine to proceed. */
export function deliverabilityBreach(stats: Deliverability): string | null {
  if (!stats.significant) return null;
  if (stats.hardBounceRate > DELIVERABILITY_LIMITS.hardBounceRate) {
    return (
      `hard bounce rate is ${pct(stats.hardBounceRate)} over the last ${WINDOW_DAYS} days ` +
      `(${stats.hardBounces} of ${stats.sample}), above the ${pct(DELIVERABILITY_LIMITS.hardBounceRate)} limit`
    );
  }
  if (stats.complaintRate > DELIVERABILITY_LIMITS.complaintRate) {
    return (
      `spam complaint rate is ${pct(stats.complaintRate)} over the last ${WINDOW_DAYS} days ` +
      `(${stats.complaints} of ${stats.sample}), above the ${pct(DELIVERABILITY_LIMITS.complaintRate)} limit`
    );
  }
  return null;
}

/**
 * Refuse a send when recent deliverability is bad enough to endanger the
 * sending domain. Throws `ConflictError('deliverability_blocked')`.
 *
 * Recovery is real, not theoretical: the bounced addresses are already
 * suppressed, so the next send goes to a cleaner list and the rate falls out
 * of the window as it ages.
 */
export async function assertDeliverabilityOk(tenantId: string, channel: Channel): Promise<void> {
  const breach = deliverabilityBreach(await deliverabilityFor(tenantId, channel));
  if (!breach) return;
  throw new ConflictError(
    `deliverability_blocked: ${breach}. Bounced and complained addresses have been ` +
      'suppressed automatically — clean the list and try again.',
  );
}
