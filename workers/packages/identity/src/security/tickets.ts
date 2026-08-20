import { and, eq, gt, isNull } from 'drizzle-orm';
import { db, authTickets } from '@maildrill/database';
import {
  composeOpaqueToken,
  mintOpaqueSecret,
  secretMatchesHash,
  splitOpaqueToken,
} from './crypto';

/**
 * Single-use tickets carrying a login across its steps: `twofa` proves the
 * first factor passed (the emailed code was consumed) while the TOTP challenge
 * is pending; `login` is the terminal grant Auth.js exchanges for a session.
 * A ticket is `<rowId>.<secret>` — only sha256(secret) is stored.
 */

export type TicketPurpose = 'login' | 'twofa';

const TICKET_TTL_MS: Record<TicketPurpose, number> = {
  login: 60_000, // exchanged immediately by the sign-in flow
  twofa: 5 * 60_000, // the user is typing a 6-digit code
};

export interface IssuedTicket {
  ticket: string;
  expiresAt: Date;
}

export async function issueTicket(
  userId: string,
  purpose: TicketPurpose,
  amr: string[],
): Promise<IssuedTicket> {
  const { secret, hash } = mintOpaqueSecret();
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS[purpose]);
  const rows = await db
    .insert(authTickets)
    .values({ userId, purpose, secretHash: hash, amr, expiresAt })
    .returning({ id: authTickets.id });
  return { ticket: composeOpaqueToken(rows[0]!.id, secret), expiresAt };
}

export interface ConsumedTicket {
  userId: string;
  amr: string[];
}

/**
 * Atomically consume a ticket: the `consumed_at` stamp happens in the same
 * guarded UPDATE that checks liveness, so a ticket can never be spent twice
 * even under concurrent presentation.
 */
export async function consumeTicket(
  token: string,
  purpose: TicketPurpose,
): Promise<ConsumedTicket | null> {
  const parts = splitOpaqueToken(token);
  if (!parts) return null;
  const now = new Date();
  const candidates = await db
    .select()
    .from(authTickets)
    .where(
      and(
        eq(authTickets.id, parts.id),
        eq(authTickets.purpose, purpose),
        isNull(authTickets.consumedAt),
        gt(authTickets.expiresAt, now),
      ),
    )
    .limit(1);
  const row = candidates[0];
  if (!row || !secretMatchesHash(parts.secret, row.secretHash)) return null;
  const consumed = await db
    .update(authTickets)
    .set({ consumedAt: now })
    .where(and(eq(authTickets.id, row.id), isNull(authTickets.consumedAt)))
    .returning({ id: authTickets.id });
  if (!consumed[0]) return null;
  return { userId: row.userId, amr: row.amr };
}
