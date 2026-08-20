import { createHmac, timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { db, subscribers } from '@maildrill/database';
import { suppressAddress } from './suppression';

/**
 * One-click unsubscribe links.
 *
 * The link has to work from an email client with no session, so it carries its
 * own proof: an HMAC over the tenant and subscriber. Stateless by design —
 * nothing to store, nothing to expire, and a token cannot be forged without the
 * signing key or altered to unsubscribe somebody else.
 *
 * The key is derived from JWT_SECRET rather than used directly, so a leaked
 * unsubscribe link never yields material that can mint a session.
 */
const KEY = createHmac('sha256', config.auth.jwtSecret)
  .update('maildrill:unsubscribe:v1')
  .digest();

const b64url = (b: Buffer) => b.toString('base64url');

export interface UnsubscribeClaims {
  tenantId: string;
  subscriberId: string;
}

/** `<payload>.<signature>`, both base64url. */
export function unsubscribeToken(claims: UnsubscribeClaims): string {
  const payload = b64url(Buffer.from(`${claims.tenantId}:${claims.subscriberId}`, 'utf8'));
  const sig = b64url(createHmac('sha256', KEY).update(payload).digest());
  return `${payload}.${sig}`;
}

/** Claims when the signature checks out, else null. Constant-time comparison. */
export function verifyUnsubscribeToken(token: string): UnsubscribeClaims | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = b64url(createHmac('sha256', KEY).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [tenantId, subscriberId] = Buffer.from(payload, 'base64url').toString('utf8').split(':');
  if (!tenantId || !subscriberId) return null;
  return { tenantId, subscriberId };
}

/** The full URL to put in an email. */
export function unsubscribeUrl(claims: UnsubscribeClaims): string {
  return `${config.app.url}/unsubscribe?t=${encodeURIComponent(unsubscribeToken(claims))}`;
}

/**
 * Honour an unsubscribe: flip the subscriber's status and suppress the address
 * so nothing else in the workspace mails them. Idempotent — a second click, or
 * a mail client prefetching the one-click POST, changes nothing.
 */
export async function applyUnsubscribe(claims: UnsubscribeClaims): Promise<boolean> {
  const [sub] = await db
    .select({ id: subscribers.id, email: subscribers.email, status: subscribers.status })
    .from(subscribers)
    .where(
      and(eq(subscribers.id, claims.subscriberId), eq(subscribers.tenantId, claims.tenantId)),
    )
    .limit(1);
  if (!sub) return false;
  if (sub.status !== 'unsubscribed') {
    await db
      .update(subscribers)
      .set({ status: 'unsubscribed', updatedAt: new Date() })
      .where(eq(subscribers.id, sub.id));
  }
  await suppressAddress({
    tenantId: claims.tenantId,
    channel: 'email',
    address: sub.email,
    recipientId: sub.id,
    cause: 'unsubscribe',
    detail: 'one_click_unsubscribe',
  });
  return true;
}
