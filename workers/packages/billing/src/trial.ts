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
  TRIAL_ALLOWANCES,
  TRIAL_ALLOWANCE_UNITS,
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
 * Allowance already spent on a channel. Counts messages that actually went
 * out; queued/failed/cancelled rows never consumed anything, so a failed send
 * does not cost the trial.
 *
 * Voice counts calls — see TRIAL_ALLOWANCES for why minutes are not summed.
 */
export async function trialUsage(
  tenantId: string,
  channel: Channel,
  tx: Tx | typeof db = db,
): Promise<number> {
  const [row] = await tx
    .select({ used: count() })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.channel, channel),
        inArray(messages.status, [...SPENT_STATUSES]),
      ),
    );
  return row?.used ?? 0;
}

export interface TrialAllowance {
  onTrial: boolean;
  allowed: number;
  used: number;
  remaining: number;
}

/** Current standing on one channel — powers both the gate and any UI meter. */
export async function trialAllowance(
  tenantId: string,
  channel: Channel,
): Promise<TrialAllowance> {
  const allowed = TRIAL_ALLOWANCES[channel];
  if (!(await isTenantOnTrial(tenantId))) {
    return { onTrial: false, allowed, used: 0, remaining: Number.POSITIVE_INFINITY };
  }
  const used = await trialUsage(tenantId, channel);
  return { onTrial: true, allowed, used, remaining: Math.max(0, allowed - used) };
}

/**
 * Gate `count` outbound messages on `channel`.
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

  const unit = TRIAL_ALLOWANCE_UNITS[channel];
  throw new ConflictError(
    `trial_allowance_exhausted: the free trial covers ${state.allowed} ${unit} — ` +
      `${state.used} used, ${state.remaining} left, ${requested} requested. ` +
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
