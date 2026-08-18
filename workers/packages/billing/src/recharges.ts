import { and, asc, eq, sql } from 'drizzle-orm';
import { createLogger } from '@maildrill/observability';
import {
  campaigns,
  creditRecharges,
  db,
  tenants,
  walletTransactions,
  type CreditRechargeRow,
  type Tx,
} from '@maildrill/database';
import { receiptNumber, renderReceiptPdf } from './invoice-pdf';
import { microToUsd } from './money';
import { getOrCreateWallet } from './wallet';

const log = createLogger({ component: 'billing-recharges' });

/**
 * Recharge history — the 1-N table behind a wallet's single balance.
 *
 * A wallet stores one number. That answers "how much is left" and nothing
 * else: not when the credit arrived, not what it paid for, not whether the
 * campaign that drained it was the expensive one. This table keeps one row per
 * top-up, and each row carries a rollup of the spend allocated to it.
 *
 * THE ROLLUP IS DERIVED, NOT ACCUMULATED
 * --------------------------------------
 * `spending` is rebuilt from the ledger, never incremented in place by
 * whichever campaign happens to be charging. Two campaigns completing at once
 * would contend on the same JSONB row and one update would be lost — silently,
 * with no way to detect it afterwards, because there would be nothing to
 * compare against. Deriving it means a wrong rollup is fixed by rebuilding
 * rather than by hand-editing money, and `rebuiltAt` says how stale it is.
 *
 * ALLOCATION IS FIFO
 * ------------------
 * Credits are consumed in the order they arrived: the oldest recharge with
 * remaining balance absorbs the next debit. This matches how prepaid credit is
 * normally understood ("my January top-up ran out in March") and, unlike
 * proportional allocation, it makes `remainingMicro` per recharge meaningful.
 */

export interface RechargeCampaignSpend {
  campaignId: string;
  name: string | null;
  channel: string | null;
  /** Micro-credits of this campaign's spend paid by this recharge. */
  amountMicro: number;
  /** Ledger entries behind it, split by how the figure was arrived at. */
  estimatedMicro: number;
  /** Signed provider-usage corrections (see `usage.ts`). */
  reconciledMicro: number;
}

export interface RechargeSpending {
  consumedMicro: number;
  remainingMicro: number;
  campaigns: RechargeCampaignSpend[];
  /** Debits not attributable to a campaign (one-off sends, manual corrections). */
  other: Array<{ referenceType: string | null; referenceId: string | null; amountMicro: number }>;
  rebuiltAt: string;
}

/**
 * Record a recharge alongside the ledger entry that granted it.
 *
 * Called inside the same transaction as the grant so the two can never
 * disagree: `wallet_transaction_id` is unique, so a replayed webhook that
 * hits the ledger's idempotency key also cannot insert a second recharge.
 */
export async function recordRecharge(
  tx: Tx,
  input: {
    tenantId: string;
    walletId: string;
    walletTransactionId: string;
    amountMicro: number;
    currency?: string;
    source?: CreditRechargeRow['source'];
    paymentAttemptId?: string | null;
    createdAt?: Date;
  },
): Promise<void> {
  if (input.amountMicro <= 0) return;
  await tx
    .insert(creditRecharges)
    .values({
      tenantId: input.tenantId,
      walletId: input.walletId,
      walletTransactionId: input.walletTransactionId,
      amountMicro: input.amountMicro,
      currency: input.currency ?? 'USD',
      source: input.source ?? 'purchase',
      paymentAttemptId: input.paymentAttemptId ?? null,
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
    })
    .onConflictDoNothing({ target: creditRecharges.walletTransactionId });
}

/**
 * Recompute every recharge rollup for one tenant from the ledger.
 *
 * Walks debits oldest-first and fills recharges oldest-first, so the result is
 * a pure function of `wallet_transactions` — run it twice and nothing changes.
 * Campaign names are joined in for display; a deleted campaign keeps its id and
 * loses its name rather than dropping the spend.
 */
export async function rebuildRechargeSpending(tenantId: string): Promise<{
  recharges: number;
  allocatedMicro: number;
  unallocatedMicro: number;
}> {
  const wallet = await getOrCreateWallet(tenantId);
  await repairMissingRecharges(tenantId, wallet.id);

  const rows = await db
    .select()
    .from(creditRecharges)
    .where(and(eq(creditRecharges.tenantId, tenantId), eq(creditRecharges.walletId, wallet.id)))
    .orderBy(asc(creditRecharges.createdAt), asc(creditRecharges.id));
  if (rows.length === 0) return { recharges: 0, allocatedMicro: 0, unallocatedMicro: 0 };

  // Debits, oldest first, with the campaign each one points at. Estimates
  // (`consumption` against a campaign) and provider corrections
  // (`adjustment` against `campaign_usage`) both land here, which is what makes
  // the rollup agree with the wallet after reconciliation moves money.
  const debits = await db
    .select({
      amountMicro: walletTransactions.amountMicro,
      entryType: walletTransactions.entryType,
      referenceType: walletTransactions.referenceType,
      referenceId: walletTransactions.referenceId,
      campaignName: campaigns.name,
      campaignChannel: campaigns.channel,
    })
    .from(walletTransactions)
    .leftJoin(
      campaigns,
      and(
        sql`${walletTransactions.referenceType} IN ('campaign', 'campaign_usage')`,
        sql`${walletTransactions.referenceId}::uuid = ${campaigns.id}`,
      ),
    )
    .where(
      and(eq(walletTransactions.tenantId, tenantId), sql`${walletTransactions.amountMicro} < 0`),
    )
    .orderBy(asc(walletTransactions.createdAt), asc(walletTransactions.id));

  // FIFO cursor over recharges.
  const buckets = rows.map((r) => ({ row: r, remaining: r.amountMicro, spend: newSpending() }));
  let cursor = 0;
  let allocatedMicro = 0;
  let unallocatedMicro = 0;

  for (const debit of debits) {
    let owed = -debit.amountMicro; // debits are negative; owe the positive part
    while (owed > 0 && cursor < buckets.length) {
      const bucket = buckets[cursor]!;
      if (bucket.remaining <= 0) {
        cursor += 1;
        continue;
      }
      const take = Math.min(owed, bucket.remaining);
      bucket.remaining -= take;
      owed -= take;
      allocatedMicro += take;
      applySpend(bucket.spend, debit, take);
    }
    // Spend beyond every recharge on record — a trial grant or an overdraft
    // correction. Surfaced rather than dropped so the numbers stay checkable.
    if (owed > 0) unallocatedMicro += owed;
  }

  const rebuiltAt = new Date();
  for (const bucket of buckets) {
    const consumedMicro = bucket.row.amountMicro - bucket.remaining;
    const spending: RechargeSpending = {
      consumedMicro,
      remainingMicro: bucket.remaining,
      campaigns: [...bucket.spend.campaigns.values()].sort((a, b) => b.amountMicro - a.amountMicro),
      other: [...bucket.spend.other.values()],
      rebuiltAt: rebuiltAt.toISOString(),
    };
    await db
      .update(creditRecharges)
      .set({
        consumedMicro,
        spending: spending as unknown as Record<string, unknown>,
        rebuiltAt,
        updatedAt: rebuiltAt,
      })
      .where(eq(creditRecharges.id, bucket.row.id));
  }

  log.info(
    { tenantId, recharges: rows.length, allocatedMicro, unallocatedMicro },
    'rebuilt recharge spending',
  );
  return { recharges: rows.length, allocatedMicro, unallocatedMicro };
}

/**
 * Insert a recharge row for any credit that doesn't have one.
 *
 * `appendLedgerEntry` records recharges for every positive entry, so in steady
 * state this finds nothing. It exists for the seam: credits granted between
 * the migration that created the table and the deploy that started recording
 * them have no row, and so would silently shrink every rollup below — a
 * recharge that isn't there can't absorb spend, and the difference would
 * surface as `unallocatedMicro` rather than as an error. Self-healing keeps
 * "sum of recharges = sum of credits" true after any rebuild instead of
 * requiring a one-off script nobody remembers to run.
 */
async function repairMissingRecharges(tenantId: string, walletId: string): Promise<number> {
  const inserted = await db.execute(sql`
    INSERT INTO credit_recharges
      (tenant_id, wallet_id, source, amount_micro, currency,
       wallet_transaction_id, created_at, updated_at)
    SELECT
      wt.tenant_id,
      wt.wallet_id,
      (CASE wt.entry_type
         WHEN 'purchase'  THEN 'purchase'
         WHEN 'promotion' THEN 'promotion'
         WHEN 'bonus'     THEN 'bonus'
         ELSE 'adjustment'
       END)::recharge_source,
      wt.amount_micro,
      wt.currency,
      wt.id,
      wt.created_at,
      wt.created_at
    FROM wallet_transactions wt
    LEFT JOIN credit_recharges cr ON cr.wallet_transaction_id = wt.id
    WHERE wt.tenant_id = ${tenantId}
      AND wt.wallet_id = ${walletId}
      AND wt.amount_micro > 0
      AND cr.id IS NULL
    ON CONFLICT (wallet_transaction_id) DO NOTHING
  `);
  const count = inserted.rowCount ?? 0;
  if (count > 0) log.warn({ tenantId, count }, 'backfilled recharges missing from the ledger seam');
  return count;
}

type SpendAccumulator = {
  campaigns: Map<string, RechargeCampaignSpend>;
  other: Map<string, { referenceType: string | null; referenceId: string | null; amountMicro: number }>;
};

function newSpending(): SpendAccumulator {
  return { campaigns: new Map(), other: new Map() };
}

function applySpend(
  acc: SpendAccumulator,
  debit: {
    entryType: string;
    referenceType: string | null;
    referenceId: string | null;
    campaignName: string | null;
    campaignChannel: string | null;
  },
  amountMicro: number,
): void {
  const isCampaign =
    (debit.referenceType === 'campaign' || debit.referenceType === 'campaign_usage') &&
    Boolean(debit.referenceId);
  if (isCampaign) {
    const key = debit.referenceId!;
    const entry = acc.campaigns.get(key) ?? {
      campaignId: key,
      name: debit.campaignName,
      channel: debit.campaignChannel,
      amountMicro: 0,
      estimatedMicro: 0,
      reconciledMicro: 0,
    };
    entry.amountMicro += amountMicro;
    if (debit.referenceType === 'campaign_usage') entry.reconciledMicro += amountMicro;
    else entry.estimatedMicro += amountMicro;
    acc.campaigns.set(key, entry);
    return;
  }
  const key = `${debit.referenceType ?? ''}:${debit.referenceId ?? ''}`;
  const entry = acc.other.get(key) ?? {
    referenceType: debit.referenceType,
    referenceId: debit.referenceId,
    amountMicro: 0,
  };
  entry.amountMicro += amountMicro;
  acc.other.set(key, entry);
}

/** Recharge history for the billing UI, newest first. */
export async function listRecharges(
  tenantId: string,
  limit = 50,
): Promise<CreditRechargeRow[]> {
  return db
    .select()
    .from(creditRecharges)
    .where(eq(creditRecharges.tenantId, tenantId))
    .orderBy(sql`${creditRecharges.createdAt} DESC`)
    .limit(limit);
}

/**
 * Ledger entry type → recharge source.
 *
 * `adjustment` and `correction` are deliberately collapsed into `adjustment`:
 * both are manual credit and the distinction only matters to the ledger, which
 * keeps its own `entry_type`. A trial grant is recognised by its reference
 * rather than its type, because it is posted as a promotion.
 */
export function rechargeSourceFor(
  entryType: string,
  referenceType: string | null,
): CreditRechargeRow['source'] {
  if (referenceType === 'trial') return 'trial';
  switch (entryType) {
    case 'purchase':
      return 'purchase';
    case 'bonus':
      return 'bonus';
    case 'promotion':
      return 'promotion';
    default:
      return 'adjustment';
  }
}

/** One recharge by id, scoped to its tenant. Null when it isn't theirs. */
export async function getRecharge(
  tenantId: string,
  id: string,
): Promise<CreditRechargeRow | null> {
  const [row] = await db
    .select()
    .from(creditRecharges)
    .where(and(eq(creditRecharges.tenantId, tenantId), eq(creditRecharges.id, id)));
  return row ?? null;
}

/**
 * Assemble the receipt for one top-up.
 *
 * Lives here rather than in the route because it reads three tables — the
 * recharge, its tenant for the workspace name, and the rollup it carries — and
 * a route that reaches into the database directly is how the billing figures
 * on one screen end up derived differently from the same figures on another.
 *
 * Returns null when the recharge isn't this tenant's, which the caller turns
 * into a 404: whether a given uuid exists is not something to leak.
 */
export async function buildRechargeReceipt(
  tenantId: string,
  rechargeId: string,
  buyerEmail: string | null,
): Promise<{ pdf: Buffer; filename: string } | null> {
  const [row] = await db
    .select({
      recharge: creditRecharges,
      workspaceName: tenants.name,
    })
    .from(creditRecharges)
    .leftJoin(tenants, eq(tenants.id, creditRecharges.tenantId))
    .where(and(eq(creditRecharges.tenantId, tenantId), eq(creditRecharges.id, rechargeId)));
  if (!row) return null;

  const { recharge } = row;
  const spending = (recharge.spending ?? {}) as { consumedMicro?: number };
  const consumedMicro = spending.consumedMicro ?? recharge.consumedMicro;
  const number = receiptNumber(recharge.id, recharge.createdAt);

  const pdf = renderReceiptPdf({
    number,
    issuedAt: recharge.createdAt,
    workspaceName: row.workspaceName ?? 'Workspace',
    // Placeholder: workspaces carry no billing address yet, and inventing one
    // on a financial document is worse than saying it is missing.
    //
    // The email is dropped when it IS the workspace name — workspaces created
    // from a signup are named after the address, so the receipt printed
    // `hello@example.com` as the heading and again as the contact line
    // directly beneath it.
    billTo: [
      'Billing address not set',
      buyerEmail && buyerEmail !== row.workspaceName ? buyerEmail : '',
    ].filter(Boolean),
    currency: recharge.currency,
    lines: [
      {
        description: `Prepaid credit — ${recharge.source}`,
        amount: microToUsd(recharge.amountMicro),
      },
    ],
    total: microToUsd(recharge.amountMicro),
    // Stated only once the rollup exists. Before that "spent" is unknown, and
    // printing $0.00 on a receipt would be a claim we cannot support.
    notes: recharge.rebuiltAt
      ? [
          `Spent so far: ${fmtMoney(microToUsd(consumedMicro), recharge.currency)}`,
          `Remaining: ${fmtMoney(
            microToUsd(recharge.amountMicro - consumedMicro),
            recharge.currency,
          )}`,
        ]
      : undefined,
  });

  return { pdf, filename: `${number}.pdf` };
}

function fmtMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
