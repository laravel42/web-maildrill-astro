import { and, eq, lte, sql } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { ConflictError, ValidationError, type Channel } from '@maildrill/domain';
import { createLogger } from '@maildrill/observability';
import {
  db,
  creditReservations,
  wallets,
  type Tx,
  type CreditReservationRow,
} from '@maildrill/database';
import { appendLedgerEntry, lockWallet } from './ledger';
import { getOrCreateWallet } from './wallet';
import { assertMicro } from './money';

const log = createLogger({ component: 'billing-reservations' });

/**
 * Credit holds for in-flight sends: reserve before dispatch, commit per
 * delivered message, release whatever is left when the batch settles.
 * Reservations move credits between `balance_micro` and `reserved_micro`
 * without touching the ledger — only a commit produces a `consumption` entry.
 *
 * Idempotency: one reservation per (tenant, referenceType, referenceId);
 * commits are keyed per message via the ledger idempotency key, so BullMQ
 * retries and duplicate delivery reports can never double-charge.
 */

export interface ReserveInput {
  tenantId: string;
  amountMicro: number;
  referenceType: string;
  referenceId: string;
  ttlMinutes?: number;
}

export async function reserveCredits(input: ReserveInput): Promise<CreditReservationRow> {
  assertMicro(input.amountMicro, 'amountMicro');
  if (input.amountMicro <= 0) throw new ValidationError('reservation amount must be positive');
  const wallet = await getOrCreateWallet(input.tenantId);
  const ttlMinutes = input.ttlMinutes ?? config.billing.reservationTtlMinutes;

  return db.transaction(async (tx) => {
    // Idempotent per business reference: a retried campaign send reuses its hold.
    const [existing] = await tx
      .select()
      .from(creditReservations)
      .where(
        and(
          eq(creditReservations.tenantId, input.tenantId),
          eq(creditReservations.referenceType, input.referenceType),
          eq(creditReservations.referenceId, input.referenceId),
        ),
      );
    if (existing && existing.status === 'held') return existing;
    if (existing) {
      throw new ConflictError(
        `reservation for ${input.referenceType}:${input.referenceId} already ${existing.status}`,
      );
    }

    const locked = await lockWallet(tx, wallet.id);
    if (locked.balanceMicro < input.amountMicro) {
      throw new ConflictError('insufficient_credits');
    }

    await tx
      .update(wallets)
      .set({
        balanceMicro: locked.balanceMicro - input.amountMicro,
        reservedMicro: locked.reservedMicro + input.amountMicro,
        version: sql`${wallets.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, wallet.id));

    const [reservation] = await tx
      .insert(creditReservations)
      .values({
        tenantId: input.tenantId,
        walletId: wallet.id,
        amountMicro: input.amountMicro,
        remainingMicro: input.amountMicro,
        referenceType: input.referenceType,
        referenceId: input.referenceId,
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      })
      .returning();
    return reservation!;
  });
}

export interface CommitInput {
  tenantId: string;
  referenceType: string;
  referenceId: string;
  /** Positive micro-credits actually consumed by this unit of work. */
  amountMicro: number;
  channel: Channel;
  /** At-most-once key, e.g. `consume:<messageId>`. */
  idempotencyKey: string;
  messageId?: string;
  description?: string;
}

/**
 * Consume part of a hold: writes the `consumption` ledger entry from reserved
 * credits and shrinks the reservation. Falls back to a direct balance debit
 * when no hold exists (one-off sends outside a reserved batch).
 */
export async function commitReservedCredits(input: CommitInput): Promise<{ duplicate: boolean }> {
  assertMicro(input.amountMicro, 'amountMicro');
  if (input.amountMicro <= 0) throw new ValidationError('commit amount must be positive');
  const wallet = await getOrCreateWallet(input.tenantId);

  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(creditReservations)
      .where(
        and(
          eq(creditReservations.tenantId, input.tenantId),
          eq(creditReservations.referenceType, input.referenceType),
          eq(creditReservations.referenceId, input.referenceId),
          eq(creditReservations.status, 'held'),
        ),
      )
      .for('update');

    const fromReserved = reservation != null && reservation.remainingMicro >= input.amountMicro;
    const result = await appendLedgerEntry(tx, {
      tenantId: input.tenantId,
      walletId: wallet.id,
      entryType: 'consumption',
      amountMicro: -input.amountMicro,
      channel: input.channel,
      referenceType: input.messageId ? 'message' : input.referenceType,
      referenceId: input.messageId ?? input.referenceId,
      idempotencyKey: input.idempotencyKey,
      description: input.description,
      fromReserved,
    });
    if (result.duplicate) return { duplicate: true };

    if (fromReserved && reservation) {
      await tx
        .update(creditReservations)
        .set({
          remainingMicro: reservation.remainingMicro - input.amountMicro,
          updatedAt: new Date(),
        })
        .where(eq(creditReservations.id, reservation.id));
    }
    return { duplicate: false };
  });
}

/**
 * Return a hold's remaining credits to the wallet. Safe to call repeatedly —
 * a reservation that is already settled is a no-op.
 */
export async function releaseReservation(
  tenantId: string,
  referenceType: string,
  referenceId: string,
  finalStatus: 'released' | 'expired' = 'released',
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [reservation] = await tx
      .select()
      .from(creditReservations)
      .where(
        and(
          eq(creditReservations.tenantId, tenantId),
          eq(creditReservations.referenceType, referenceType),
          eq(creditReservations.referenceId, referenceId),
          eq(creditReservations.status, 'held'),
        ),
      )
      .for('update');
    if (!reservation) return false;
    await settleReservation(tx, reservation, finalStatus);
    return true;
  });
}

async function settleReservation(
  tx: Tx,
  reservation: CreditReservationRow,
  finalStatus: 'released' | 'expired' | 'committed',
): Promise<void> {
  if (reservation.remainingMicro > 0) {
    const locked = await lockWallet(tx, reservation.walletId);
    await tx
      .update(wallets)
      .set({
        balanceMicro: locked.balanceMicro + reservation.remainingMicro,
        reservedMicro: locked.reservedMicro - reservation.remainingMicro,
        version: sql`${wallets.version} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, reservation.walletId));
  }
  const settled = reservation.remainingMicro === 0 ? 'committed' : finalStatus;
  await tx
    .update(creditReservations)
    .set({ status: settled, remainingMicro: 0, updatedAt: new Date() })
    .where(eq(creditReservations.id, reservation.id));
}

/** Maintenance sweep: return stale holds to their wallets. */
export async function expireStaleReservations(now = new Date()): Promise<number> {
  const stale = await db
    .select({ id: creditReservations.id })
    .from(creditReservations)
    .where(and(eq(creditReservations.status, 'held'), lte(creditReservations.expiresAt, now)))
    .limit(200);
  let swept = 0;
  for (const { id } of stale) {
    await db.transaction(async (tx) => {
      const [reservation] = await tx
        .select()
        .from(creditReservations)
        .where(and(eq(creditReservations.id, id), eq(creditReservations.status, 'held')))
        .for('update');
      if (!reservation) return;
      await settleReservation(tx, reservation, 'expired');
      swept += 1;
    });
  }
  if (swept > 0) log.info({ swept }, 'expired stale credit reservations');
  return swept;
}
