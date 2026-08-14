import { randomBytes, createHash } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import {
  db,
  pendingListConfirmations,
  lists,
  type ListRow,
} from '@maildrill/database';
import { addToList, removeFromList } from './lists';

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: hashToken(raw) };
}

export interface PendingConfirmation {
  id: string;
  tenantId: string;
  listId: string;
  subscriberId: string;
  action: 'subscribe' | 'unsubscribe';
  token: string;
}

/**
 * Create a pending list confirmation. Returns the raw token that should be
 * embedded in the confirmation email link.
 */
export async function createListConfirmation(input: {
  tenantId: string;
  listId: string;
  subscriberId: string;
  action: 'subscribe' | 'unsubscribe';
}): Promise<PendingConfirmation> {
  const { raw, hash } = generateToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const rows = await db
    .insert(pendingListConfirmations)
    .values({
      tenantId: input.tenantId,
      listId: input.listId,
      subscriberId: input.subscriberId,
      action: input.action,
      tokenHash: hash,
      expiresAt,
    })
    .returning();

  return {
    id: rows[0]!.id,
    tenantId: input.tenantId,
    listId: input.listId,
    subscriberId: input.subscriberId,
    action: input.action,
    token: raw,
  };
}

/**
 * Consume a confirmation token — performs the subscribe/unsubscribe action
 * and deletes the pending row. Returns the list name on success, or null if
 * the token is invalid/expired.
 */
export async function confirmListAction(
  confirmationId: string,
  rawToken: string,
): Promise<{ action: 'subscribe' | 'unsubscribe'; listName: string } | null> {
  const now = new Date();
  const hash = hashToken(rawToken);

  const rows = await db
    .select()
    .from(pendingListConfirmations)
    .where(
      and(
        eq(pendingListConfirmations.id, confirmationId),
        eq(pendingListConfirmations.tokenHash, hash),
        gt(pendingListConfirmations.expiresAt, now),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  const pending = rows[0]!;

  // Perform the action.
  if (pending.action === 'subscribe') {
    await addToList(pending.tenantId, pending.listId, pending.subscriberId);
  } else {
    await removeFromList(pending.listId, pending.subscriberId);
  }

  // Delete the consumed confirmation.
  await db
    .delete(pendingListConfirmations)
    .where(eq(pendingListConfirmations.id, pending.id));

  // Look up the list name for the response.
  const listRows = await db
    .select({ name: lists.name })
    .from(lists)
    .where(eq(lists.id, pending.listId))
    .limit(1);

  return {
    action: pending.action,
    listName: listRows[0]?.name ?? 'the list',
  };
}

/**
 * Check whether a list requires confirmation for a given action.
 * Returns the template ID to use (per-list or workspace fallback), or null
 * if no confirmation is needed.
 */
export function listRequiresConfirmation(
  list: ListRow,
  action: 'subscribe' | 'unsubscribe',
  workspaceSettings?: Record<string, unknown>,
): string | null {
  if (action === 'subscribe' && list.doubleOptIn) {
    return (
      list.doubleOptInTemplateId ??
      (workspaceSettings?.doubleOptInTemplateId as string | undefined) ??
      null
    );
  }
  if (action === 'unsubscribe' && list.doubleOptOut) {
    return (
      list.doubleOptOutTemplateId ??
      (workspaceSettings?.doubleOptOutTemplateId as string | undefined) ??
      null
    );
  }
  return null;
}
