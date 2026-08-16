import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '@maildrill/config';

/**
 * "View in browser" links.
 *
 * Same stateless design as the unsubscribe token, with its own derived key and
 * context string so a webview link can never be replayed as an unsubscribe (or
 * the reverse), and neither can be turned into session material.
 *
 * The token names the campaign and recipient rather than a stored copy of the
 * email: the page re-renders from the same template and campaign content the
 * send used, so nothing per-recipient has to be persisted.
 */
const KEY = createHmac('sha256', config.auth.jwtSecret).update('maildrill:webview:v1').digest();

const b64url = (b: Buffer) => b.toString('base64url');

export interface WebviewClaims {
  tenantId: string;
  subscriberId: string;
  /** Absent for a template preview with no campaign behind it. */
  campaignId?: string;
}

export function webviewToken(claims: WebviewClaims): string {
  const payload = b64url(
    Buffer.from(
      `${claims.tenantId}:${claims.subscriberId}:${claims.campaignId ?? ''}`,
      'utf8',
    ),
  );
  return `${payload}.${b64url(createHmac('sha256', KEY).update(payload).digest())}`;
}

export function verifyWebviewToken(token: string): WebviewClaims | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = b64url(createHmac('sha256', KEY).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const [tenantId, subscriberId, campaignId] = Buffer.from(payload, 'base64url')
    .toString('utf8')
    .split(':');
  if (!tenantId || !subscriberId) return null;
  return { tenantId, subscriberId, ...(campaignId ? { campaignId } : {}) };
}

export function webviewUrl(claims: WebviewClaims): string {
  return `${config.app.url}/view?t=${encodeURIComponent(webviewToken(claims))}`;
}
