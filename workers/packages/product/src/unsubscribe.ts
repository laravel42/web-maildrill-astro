import { createHmac } from 'node:crypto';
import { config } from '@maildrill/config';

/**
 * Generate a signed unsubscribe URL for a subscriber + list pair.
 * The signature prevents forged unsubscribes — only someone who received
 * the email (or the system) can produce a valid link.
 */
export function generateUnsubscribeUrl(
  listId: string,
  subscriberId: string,
  appUrl?: string,
): string {
  const base = appUrl ?? process.env.APP_URL ?? 'https://app.maildrill.net';
  const sig = signUnsubscribe(listId, subscriberId);
  return `${base}/unsubscribe/${listId}/${subscriberId}/${sig}`;
}

/**
 * Verify an unsubscribe signature. Returns true if valid.
 */
export function verifyUnsubscribeSignature(
  listId: string,
  subscriberId: string,
  signature: string,
): boolean {
  const expected = signUnsubscribe(listId, subscriberId);
  // Constant-time compare to prevent timing attacks.
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

function signUnsubscribe(listId: string, subscriberId: string): string {
  const secret = config.auth.jwtSecret;
  return createHmac('sha256', secret)
    .update(`unsubscribe:${listId}:${subscriberId}`)
    .digest('base64url');
}
