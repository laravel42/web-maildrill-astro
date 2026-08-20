import { desc, eq } from 'drizzle-orm';
import { db, securityEvents, type SecurityEventRow } from '@maildrill/database';
import type { Tx } from '@maildrill/database';
import { createLogger } from '@maildrill/observability';

const log = createLogger({ component: 'security-events' });

/** Canonical security-activity event types shown on the Profile page. */
export type SecurityEventType =
  | 'magic_link_requested'
  | 'login_completed'
  | 'failed_second_factor'
  | 'passkey_registered'
  | 'passkey_renamed'
  | 'passkey_removed'
  | 'passkey_login_failed'
  | 'totp_setup_started'
  | 'totp_enabled'
  | 'totp_disabled'
  | 'recovery_codes_generated'
  | 'recovery_code_used'
  | 'recovery_codes_regenerated'
  | 'trusted_device_added'
  | 'trusted_device_revoked'
  | 'trusted_devices_revoked_others'
  | 'session_revoked'
  | 'sessions_revoked_others'
  | 'sessions_revoked_all'
  | 'reauth_succeeded'
  | 'reauth_failed';

export interface SecurityEventInput {
  userId: string;
  type: SecurityEventType;
  sessionId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Id of the affected entity (passkey, device, session…). */
  entityId?: string | null;
  /** Safe structured context only — never secrets, tokens, or codes. */
  metadata?: Record<string, unknown>;
}

/**
 * Append a security event. Accepts an optional transaction so multi-record
 * mutations log atomically with their data change. Outside a transaction,
 * failures are swallowed after logging — the audit trail must never take the
 * primary operation down.
 */
export async function logSecurityEvent(input: SecurityEventInput, tx?: Tx): Promise<void> {
  const values = {
    userId: input.userId,
    eventType: input.type,
    sessionId: input.sessionId ?? null,
    ip: input.ip ?? null,
    userAgent: input.userAgent ?? null,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? {},
  };
  if (tx) {
    await tx.insert(securityEvents).values(values);
    return;
  }
  try {
    await db.insert(securityEvents).values(values);
  } catch (err) {
    log.error({ err, type: input.type }, 'security event insert failed');
  }
}

export async function listSecurityEvents(userId: string, limit = 50): Promise<SecurityEventRow[]> {
  return db
    .select()
    .from(securityEvents)
    .where(eq(securityEvents.userId, userId))
    .orderBy(desc(securityEvents.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}
