import { and, eq, sql } from 'drizzle-orm';
import { ValidationError } from '@maildrill/domain';
import {
  wallets,
  walletTransactions,
  type Tx,
  type WalletRow,
  type WalletTransactionRow,
} from '@maildrill/database';
import { assertMicro } from './money';
import { recordRecharge, rechargeSourceFor } from './recharges';

/**
 * The append-only ledger core. Every financial effect in Maildrill funnels
 * through `appendLedgerEntry`, which — inside the caller's transaction —
 * locks the wallet row, validates the entry sign, refuses overdrafts, writes
 * the immutable `wallet_transactions` row with a `balance_after_micro`
 * snapshot, and updates the cached wallet projection. Nothing else may write
 * `wallets.balance_micro`.
 */

export type LedgerEntryType = WalletTransactionRow['entryType'];

/** Sign rules per entry type: +1 credits the wallet, -1 debits, 0 = either. */
export function expectedSign(entryType: LedgerEntryType): -1 | 0 | 1 {
  switch (entryType) {
    case 'purchase':
    case 'promotion':
    case 'bonus':
      return 1;
    case 'consumption':
    case 'refund':
      return -1;
    case 'adjustment':
    case 'correction':
      return 0;
  }
}

export function validateEntryAmount(entryType: LedgerEntryType, amountMicro: number): void {
  assertMicro(amountMicro, 'amountMicro');
  if (amountMicro === 0) throw new ValidationError('ledger entries must move a non-zero amount');
  const sign = expectedSign(entryType);
  if (sign === 1 && amountMicro < 0) {
    throw new ValidationError(`${entryType} entries must be positive`);
  }
  if (sign === -1 && amountMicro > 0) {
    throw new ValidationError(`${entryType} entries must be negative`);
  }
}

export interface AppendEntryInput {
  tenantId: string;
  walletId: string;
  entryType: LedgerEntryType;
  /** Signed micro-credits (see `expectedSign`). */
  amountMicro: number;
  channel?: WalletTransactionRow['channel'];
  referenceType?: string;
  referenceId?: string;
  /** At-most-once key (unique per tenant). Replays return the original row. */
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  /**
   * Debits normally come out of available balance. Debits that settle an
   * existing hold (`fromReserved`) come out of `reserved_micro` instead —
   * used when a reservation commit consumes held credits.
   */
  fromReserved?: boolean;
  /** `true` skips the overdraft check (manual corrections may go negative). */
  allowNegativeBalance?: boolean;
}

export interface AppendEntryResult {
  entry: WalletTransactionRow;
  /** True when the idempotency key had already been applied — no new effect. */
  duplicate: boolean;
  wallet: WalletRow;
}

/** Lock and load the wallet row for update inside `tx`. */
export async function lockWallet(tx: Tx, walletId: string): Promise<WalletRow> {
  const [wallet] = await tx.select().from(wallets).where(eq(wallets.id, walletId)).for('update');
  if (!wallet) throw new ValidationError(`wallet ${walletId} not found`);
  return wallet;
}

export async function appendLedgerEntry(
  tx: Tx,
  input: AppendEntryInput,
): Promise<AppendEntryResult> {
  validateEntryAmount(input.entryType, input.amountMicro);

  // Idempotency short-circuit before locking: replays are cheap and common
  // (webhook redeliveries, BullMQ retries).
  if (input.idempotencyKey) {
    const [existing] = await tx
      .select()
      .from(walletTransactions)
      .where(
        and(
          eq(walletTransactions.tenantId, input.tenantId),
          eq(walletTransactions.idempotencyKey, input.idempotencyKey),
        ),
      );
    if (existing) {
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.id, input.walletId));
      return { entry: existing, duplicate: true, wallet: wallet! };
    }
  }

  const wallet = await lockWallet(tx, input.walletId);
  if (wallet.tenantId !== input.tenantId) {
    throw new ValidationError('wallet does not belong to tenant');
  }

  const fromReserved = input.fromReserved === true && input.amountMicro < 0;
  const nextBalance = fromReserved ? wallet.balanceMicro : wallet.balanceMicro + input.amountMicro;
  const nextReserved = fromReserved
    ? wallet.reservedMicro + input.amountMicro
    : wallet.reservedMicro;

  if (!input.allowNegativeBalance && (nextBalance < 0 || nextReserved < 0)) {
    throw new ValidationError('insufficient_credits');
  }

  const [entry] = await tx
    .insert(walletTransactions)
    .values({
      tenantId: input.tenantId,
      walletId: input.walletId,
      entryType: input.entryType,
      amountMicro: input.amountMicro,
      balanceAfterMicro: nextBalance,
      currency: wallet.currency,
      channel: input.channel ?? null,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
    })
    .returning();

  const [updated] = await tx
    .update(wallets)
    .set({
      balanceMicro: nextBalance,
      reservedMicro: nextReserved,
      version: sql`${wallets.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, wallet.id))
    .returning();

  // Every credit that enters a wallet gets a recharge row, recorded here
  // rather than at each grant site. Wiring it per-caller was the first
  // attempt and it immediately drifted: a positive `adjustment` posted
  // directly through this function bypassed it, leaving 42 recharges against
  // 43 credits. This is the one funnel every financial effect passes through,
  // so it is the only place the two can be kept in step.
  if (input.amountMicro > 0) {
    await recordRecharge(tx, {
      tenantId: input.tenantId,
      walletId: input.walletId,
      walletTransactionId: entry!.id,
      amountMicro: input.amountMicro,
      currency: wallet.currency,
      source: rechargeSourceFor(input.entryType, input.referenceType ?? null),
      paymentAttemptId:
        input.referenceType === 'payment_attempt' ? (input.referenceId ?? null) : null,
    });
  }

  return { entry: entry!, duplicate: false, wallet: updated! };
}
