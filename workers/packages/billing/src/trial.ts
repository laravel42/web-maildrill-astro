import { and, count, eq, inArray } from 'drizzle-orm';
import {
  db,
  messages,
  walletTransactions,
  wallets,
  type Tx,
} from '@maildrill/database';
import {
  ConflictError,
  estimateVoiceSeconds,
  TRIAL_ALLOWANCES,
  TRIAL_ALLOWANCE_UNITS,
  TRIAL_ALLOWANCE_UNIT_KIND,
  TRIAL_VOICE_SECONDS,
  type Channel,
} from '@maildrill/domain';

/**
 * Free-trial allowance gate.
 *
 * A workspace that has never paid still gets to send — up to what `/signup`
 * advertises (`TRIAL_ALLOWANCES`). This is a product allowance, not money, so
 * it is deliberately NOT behind `BILLING_ENFORCEMENT`: the wallet can be
 * switched on independently, and until it is the trial is the only thing
 * standing between a fresh account and unlimited sending.
 *
 * Trial state is read from the wallet, not `users.tier`. Sending is a
 * workspace act and a user can belong to several workspaces, so the tenant's
 * own payment history is the only sound source; `users.tier` mirrors it for
 * display. A workspace leaves the trial the moment it buys anything.
 */

/** Statuses that mean the message left the building and consumed allowance. */
const SPENT_STATUSES = ['submitted', 'sent', 'delivered', 'read'] as const;

/**
 * True when the workspace has never completed a purchase and holds no
 * commitment tier. Cheap enough to call per send: two indexed lookups.
 */
export async function isTenantOnTrial(tenantId: string, tx: Tx | typeof db = db): Promise<boolean> {
  const [wallet] = await tx
    .select({ id: wallets.id, pricingTierId: wallets.pricingTierId })
    .from(wallets)
    .where(eq(wallets.tenantId, tenantId))
    .limit(1);

  // No wallet yet — nothing has ever been bought, so the trial applies.
  if (!wallet) return true;
  if (wallet.pricingTierId) return false;

  const [purchase] = await tx
    .select({ id: walletTransactions.id })
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.walletId, wallet.id),
        eq(walletTransactions.entryType, 'purchase'),
      ),
    )
    .limit(1);
  return !purchase;
}

/**
 * Allowance already spent on a channel — messages for most, estimated seconds
 * for voice. Counts only messages that actually went out; queued/failed rows
 * never consumed anything, so a failed send does not cost the trial.
 *
 * Voice re-estimates from each call's stored content rather than reading a
 * recorded duration, because no provider reports one back. The scan is bounded
 * by the budget itself: the gate stops the workspace long before the row count
 * gets interesting, and a paid workspace never reaches this code.
 */
export async function trialUsage(
  tenantId: string,
  channel: Channel,
  tx: Tx | typeof db = db,
): Promise<number> {
  const spent = and(
    eq(messages.tenantId, tenantId),
    eq(messages.channel, channel),
    inArray(messages.status, [...SPENT_STATUSES]),
  );

  if (channel === 'voice') {
    // Reconciled: a call the provider has reported on costs what it actually
    // ran; one still in flight costs what we estimated at send time. So the
    // budget is right from the moment of sending and self-corrects as DLRs
    // land, instead of drifting on scripts that were cut short or went to
    // voicemail. `voiceSeconds` of 0 is a real answer (nobody picked up) and
    // must not fall back to the estimate — hence the null check, not `??` on a
    // falsy value.
    const rows = await tx
      .select({ content: messages.content, voiceSeconds: messages.voiceSeconds })
      .from(messages)
      .where(spent);
    return rows.reduce(
      (total, r) =>
        total + (r.voiceSeconds === null ? estimateVoiceSeconds(r.content) : r.voiceSeconds),
      0,
    );
  }

  const [row] = await tx.select({ used: count() }).from(messages).where(spent);
  return row?.used ?? 0;
}

export interface TrialAllowance {
  onTrial: boolean;
  allowed: number;
  used: number;
  remaining: number;
  /** What `allowed`/`used`/`remaining` are counted in. Voice is time. */
  unit: 'messages' | 'seconds';
}

/** The budget for a channel, in the unit the gate spends. */
function allowanceFor(channel: Channel): number {
  return channel === 'voice' ? TRIAL_VOICE_SECONDS : TRIAL_ALLOWANCES[channel];
}

/** Current standing on one channel — powers both the gate and any UI meter. */
export async function trialAllowance(
  tenantId: string,
  channel: Channel,
): Promise<TrialAllowance> {
  const allowed = allowanceFor(channel);
  const unit = TRIAL_ALLOWANCE_UNIT_KIND[channel];
  if (!(await isTenantOnTrial(tenantId))) {
    return { onTrial: false, allowed, used: 0, remaining: Number.POSITIVE_INFINITY, unit };
  }
  const used = await trialUsage(tenantId, channel);
  return { onTrial: true, allowed, used, remaining: Math.max(0, allowed - used), unit };
}

/**
 * Gate an outbound send. `requested` is messages for most channels and
 * **estimated seconds** for voice — callers size it with
 * `estimateVoiceSeconds`, since a 10-second call and a 3-minute one cannot
 * both cost \"one\".
 *
 * Throws `ConflictError('trial_allowance_exhausted')` when the send would take
 * the workspace past its trial allowance — all-or-nothing, matching how the
 * credit reservation rejects a campaign it cannot fully cover, so nothing ends
 * up half-sent. A paid workspace is never gated.
 */
export async function assertTrialAllowance(
  tenantId: string,
  channel: Channel,
  requested: number,
): Promise<void> {
  if (requested <= 0) return;
  const state = await trialAllowance(tenantId, channel);
  if (!state.onTrial || requested <= state.remaining) return;

  // Voice reads in minutes even though it is spent in seconds — nobody thinks
  // about a call budget in seconds.
  const toDisplay = (n: number) => (channel === 'voice' ? Math.round((n / 60) * 10) / 10 : n);
  throw new ConflictError(
    `trial_allowance_exhausted: the free trial covers ${TRIAL_ALLOWANCES[channel]} ` +
      `${TRIAL_ALLOWANCE_UNITS[channel]} — ${toDisplay(state.used)} used, ` +
      `${toDisplay(state.remaining)} left, ${toDisplay(requested)} requested. ` +
      'Add credit to keep sending.',
  );
}

/** Every channel's standing at once, for the settings/usage screens. */
export async function trialAllowanceSummary(
  tenantId: string,
): Promise<Record<Channel, TrialAllowance>> {
  const channels = Object.keys(TRIAL_ALLOWANCES) as Channel[];
  const entries = await Promise.all(
    channels.map(async (c) => [c, await trialAllowance(tenantId, c)] as const),
  );
  return Object.fromEntries(entries) as Record<Channel, TrialAllowance>;
}
