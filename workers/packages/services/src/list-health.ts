import { and, count, eq, gte, inArray, sql } from 'drizzle-orm';
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
 * Two bars, because the two signals mean opposite things.
 *
 * `invalid` is an address that failed validation *before it was ever mailed* —
 * bad syntax, a domain with no MX, a disposable provider. That is the
 * fingerprint of a purchased or scraped list, and a legitimately collected one
 * should have almost none. Measured against the real lists in this workspace,
 * healthy sits at 0–1.4% dead overall, so 10% here is already generous.
 *
 * `bounced`/`complained` are verdicts from real sends, and they accumulate with
 * age: a list decays roughly 20–30% a year as people change jobs, and nothing
 * removes those members automatically. A well-run three-year-old list can
 * therefore be a third dead and still be healthy — so the combined bar has to
 * stay well above the invalid one.
 *
 * Both shares are scoped to members added inside `LIST_WINDOW_DAYS`, which is
 * what makes them mean anything: the question is "of what you have put on this
 * list recently, how much is bad?", not "how old is this list?". Without the
 * window a well-run three-year-old list trips the bar through nothing but
 * honest decay, because a bounced member stays in the list forever.
 *
 * A list nobody has added to inside the window is not judged here at all —
 * there is no recent sourcing to judge. It is still covered downstream by the
 * send-time bounce gate and the in-flight campaign breaker.
 */
export const LIST_INVALID_SHARE_LIMIT = 0.1;
export const LIST_DEAD_SHARE_LIMIT = 0.2;

/**
 * How far back "recently added" reaches. Six months is long enough that a
 * normal drip of sign-ups accumulates a meaningful sample, and short enough
 * that a list's ancient history stops counting against it.
 */
export const LIST_WINDOW_DAYS = 180;

/**
 * Below this, the share is noise. A five-member list with two bounces is 40%
 * and means nothing.
 */
export const LIST_MIN_MEMBERS = 25;

export interface ListHealth {
  /** Members added inside the window — the denominator for both shares. */
  members: number;
  dead: number;
  deadShare: number;
  /** Members that failed validation and were never mailed. */
  invalid: number;
  invalidShare: number;
  significant: boolean;
  suspended: boolean;
  reason?: string | null;
}

export async function listHealth(
  tenantId: string,
  listId: string,
  since = new Date(Date.now() - LIST_WINDOW_DAYS * 86_400_000),
): Promise<ListHealth> {
  const [row] = await db
    .select({
      members: count(),
      dead: sql<number>`count(*) filter (where ${inArray(subscribers.status, [...DEAD_STATUSES])})::int`,
      invalid: sql<number>`count(*) filter (where ${eq(subscribers.status, 'invalid')})::int`,
    })
    .from(listMembers)
    .innerJoin(subscribers, eq(listMembers.subscriberId, subscribers.id))
    .where(
      and(
        eq(listMembers.listId, listId),
        eq(subscribers.tenantId, tenantId),
        // Judge recent sourcing, not the list's whole history.
        gte(listMembers.addedAt, since),
      ),
    );

  const [meta] = await db
    .select({ suspendedAt: lists.suspendedAt, reason: lists.suspendedReason })
    .from(lists)
    .where(and(eq(lists.id, listId), eq(lists.tenantId, tenantId)))
    .limit(1);

  const members = Number(row?.members ?? 0);
  const dead = Number(row?.dead ?? 0);
  const invalid = Number(row?.invalid ?? 0);
  return {
    members,
    dead,
    deadShare: members === 0 ? 0 : dead / members,
    invalid,
    invalidShare: members === 0 ? 0 : invalid / members,
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
/**
 * Why a list should not be mailed, or null when it is fine. Either bar alone
 * is enough: a list can be freshly scraped (high invalid) or long dead (high
 * bounced), and both are reasons to stop.
 */
export function listBreach(health: ListHealth): string | null {
  if (!health.significant) return null;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  if (health.invalidShare > LIST_INVALID_SHARE_LIMIT) {
    return (
      `${pct(health.invalidShare)} of members failed address validation and have never ` +
      `been mailed (${health.invalid} of ${health.members}) — this list looks purchased or scraped`
    );
  }
  if (health.deadShare > LIST_DEAD_SHARE_LIMIT) {
    return `${pct(health.deadShare)} of members are undeliverable (${health.dead} of ${health.members})`;
  }
  return null;
}

export async function assertListSendable(tenantId: string, listId: string): Promise<void> {
  const health = await listHealth(tenantId, listId);
  const breach = listBreach(health);

  if (health.suspended) {
    // Re-derive: a list cleaned since suspension should not stay locked out.
    if (breach) {
      throw new ConflictError(
        `list_suspended: ${health.reason ?? breach}. ` +
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

  if (!breach) return;

  const reason = breach;
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
