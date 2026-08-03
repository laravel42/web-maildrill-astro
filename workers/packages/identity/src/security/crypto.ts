import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from 'node:crypto';
import { config } from '@maildrill/config';
import { sha256Hex } from '@maildrill/domain';
import { createLogger } from '@maildrill/observability';

const log = createLogger({ component: 'security-crypto' });

/**
 * Authenticated encryption for security secrets at rest (currently TOTP
 * secrets). AES-256-GCM with a server-side env key; the ciphertext format is
 * versioned (`v1.<iv>.<ciphertext>.<tag>`, base64url) so the scheme can
 * rotate.
 */

let cachedKey: Buffer | null = null;
let warnedDerived = false;

function parseKey(raw: string): Buffer | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return Buffer.from(trimmed, 'hex');
  const b64 = Buffer.from(trimmed, 'base64');
  if (b64.length === 32) return b64;
  throw new Error('SECURITY_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)');
}

function encryptionKey(): Buffer {
  if (cachedKey) return cachedKey;
  const configured = parseKey(config.security.encryptionKey);
  if (configured) {
    cachedKey = configured;
    return cachedKey;
  }
  if (config.isProd) {
    throw new Error(
      'SECURITY_ENCRYPTION_KEY must be set in production before two-factor secrets can be stored',
    );
  }
  // Dev/test convenience only: derive a stable key from JWT_SECRET.
  if (!warnedDerived) {
    warnedDerived = true;
    log.warn('SECURITY_ENCRYPTION_KEY unset — deriving a dev-only key from JWT_SECRET');
  }
  cachedKey = scryptSync(config.auth.jwtSecret, 'maildrill-security-enc', 32);
  return cachedKey;
}

const b64url = (b: Buffer): string => b.toString('base64url');

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v1.${b64url(iv)}.${b64url(ct)}.${b64url(cipher.getAuthTag())}`;
}

export function decryptSecret(payload: string): string {
  const [version, ivB64, ctB64, tagB64] = payload.split('.');
  if (version !== 'v1' || !ivB64 || !ctB64 || !tagB64) {
    throw new Error('unrecognized ciphertext format');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivB64, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Opaque bearer secrets (auth tickets, trusted-device cookies). The caller
 * stores `hash` and hands out `token` = `<rowId>.<secret>` exactly once; a
 * presented token is split on the first dot, the row looked up by id, and the
 * secret compared in constant time against the stored hash.
 */
export interface MintedSecret {
  secret: string;
  hash: string;
}

export function mintOpaqueSecret(): MintedSecret {
  const secret = randomBytes(32).toString('base64url');
  return { secret, hash: sha256Hex(secret) };
}

export function composeOpaqueToken(rowId: string, secret: string): string {
  return `${rowId}.${secret}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function splitOpaqueToken(token: string): { id: string; secret: string } | null {
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const id = token.slice(0, dot);
  // Row ids are UUIDs; anything else would make Postgres reject the lookup —
  // fail the parse instead so garbage tokens read as plain "invalid".
  if (!UUID_RE.test(id)) return null;
  return { id, secret: token.slice(dot + 1) };
}

/** Constant-time compare of a presented secret against a stored sha256 hash. */
export function secretMatchesHash(secret: string, storedHash: string): boolean {
  const presented = Buffer.from(sha256Hex(secret), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return presented.length === stored.length && timingSafeEqual(presented, stored);
}

/** Reset the cached key — test hook. */
export function resetEncryptionKeyCache(): void {
  cachedKey = null;
}
