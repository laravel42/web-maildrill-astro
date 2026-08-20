import { and, desc, eq, lt, sql } from 'drizzle-orm';
import { createLogger } from '@maildrill/observability';
import {
  db,
  pricingTiers,
  wallets,
  walletTransactions,
  type Tx,
  type PricingTierRow,
  type WalletRow,
  type WalletTransactionRow,
} from '@maildrill/database';

const log = createLogger({ component: 'billing-wallet' });

/**
 * Wallet lifecycle + read models. One wallet per workspace, created lazily on
 * first billing touch. Balance lives in the ledger (`ledger.ts`); this module
 * never mutates `balance_micro` directly.
 */

export async function getOrCreateWallet(tenantId: string, tx?: Tx): Promise<WalletRow> {
  const executor = tx ?? db;
  const [existing] = await executor.select().from(wallets).where(eq(wallets.tenantId, tenantId));
  if (existing) return existing;
  // Concurrent first-touch is resolved by the unique tenant index.
  const [created] = await executor
    .insert(wallets)
    .values({ tenantId })
    .onConflictDoNothing({ target: [wallets.tenantId] })
    .returning();
  if (created) return created;
  const [raced] = await executor.select().from(wallets).where(eq(wallets.tenantId, tenantId));
  return raced!;
}

export interface WalletSummary {
  walletId: string;
  currency: string;
  balanceMicro: number;
  reservedMicro: number;
  lowBalanceMicro: number;
  lowBalance: boolean;
  tier: Pick<PricingTierRow, 'code' | 'name' | 'discountBps' | 'commitmentMonths'> | null;
  updatedAt: string;
}

export async function getWalletSummary(tenantId: string): Promise<WalletSummary> {
  const wallet = await getOrCreateWallet(tenantId);
  let tier: PricingTierRow | null = null;
  if (wallet.pricingTierId) {
    const [row] = await db
      .select()
      .from(pricingTiers)
      .where(eq(pricingTiers.id, wallet.pricingTierId));
    tier = row ?? null;
  }
  return {
    walletId: wallet.id,
    currency: wallet.currency,
    balanceMicro: wallet.balanceMicro,
    reservedMicro: wallet.reservedMicro,
    lowBalanceMicro: wallet.lowBalanceMicro,
    lowBalance: wallet.balanceMicro < wallet.lowBalanceMicro,
    tier: tier
      ? {
          code: tier.code,
          name: tier.name,
          discountBps: tier.discountBps,
          commitmentMonths: tier.commitmentMonths,
        }
      : null,
    updatedAt: wallet.updatedAt.toISOString(),
  };
}

export interface TransactionPage {
  data: WalletTransactionRow[];
  nextCursor: string | null;
}

/**
 * Ledger history, newest first, keyset-paginated on `created_at` so the query
 * stays indexed at millions of rows (no OFFSET scans).
 */
export async function listWalletTransactions(
  tenantId: string,
  opts: { limit?: number; cursor?: string | null } = {},
): Promise<TransactionPage> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const conditions = [eq(walletTransactions.tenantId, tenantId)];
  if (opts.cursor) {
    const cursorDate = new Date(opts.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      conditions.push(lt(walletTransactions.createdAt, cursorDate));
    }
  }
  const rows = await db
    .select()
    .from(walletTransactions)
    .where(and(...conditions))
    .orderBy(desc(walletTransactions.createdAt), desc(walletTransactions.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? page[page.length - 1]!.createdAt.toISOString() : null;
  return { data: page, nextCursor };
}

export interface ReconciliationResult {
  walletId: string;
  ledgerSumMicro: number;
  walletTotalMicro: number;
  driftMicro: number;
  consistent: boolean;
}

/**
 * Audit check: the cached wallet projection must equal the ledger.
 * Invariant — `balance + reserved = SUM(wallet_transactions.amount)`.
 * Read-only; surfacing drift is an operator decision, not an auto-fix.
 */
export async function reconcileWallet(tenantId: string): Promise<ReconciliationResult> {
  const wallet = await getOrCreateWallet(tenantId);
  const [sum] = await db
    .select({ total: sql<string>`coalesce(sum(${walletTransactions.amountMicro}), 0)` })
    .from(walletTransactions)
    .where(eq(walletTransactions.walletId, wallet.id));
  const ledgerSumMicro = Number(sum?.total ?? 0);
  const walletTotalMicro = wallet.balanceMicro + wallet.reservedMicro;
  const driftMicro = walletTotalMicro - ledgerSumMicro;
  if (driftMicro !== 0) {
    log.error({ tenantId, walletId: wallet.id, driftMicro }, 'wallet drift detected');
  }
  return {
    walletId: wallet.id,
    ledgerSumMicro,
    walletTotalMicro,
    driftMicro,
    consistent: driftMicro === 0,
  };
}
