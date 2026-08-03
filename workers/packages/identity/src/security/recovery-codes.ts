import { randomBytes } from 'node:crypto';
import { sha256Hex } from '@maildrill/domain';

/**
 * Pure recovery-code helpers. Codes are XXXX-XXXX over a Crockford-style
 * alphabet (no I/L/O/U — nothing that misreads), 40 bits of entropy each,
 * acceptable for single-use codes behind a strict attempt limiter. Only
 * sha256 hashes are ever stored.
 */

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const RECOVERY_CODE_COUNT = 10;

export function generateRecoveryCode(): string {
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += ALPHABET[(bytes[i] as number) % ALPHABET.length];
    if (i === 3) out += '-';
  }
  return out;
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const seen = new Set<string>();
  while (seen.size < count) seen.add(generateRecoveryCode());
  return [...seen];
}

/** Case/separator-insensitive canonical form: `ab12-cd34` == `AB12CD34`. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function hashRecoveryCode(input: string): string {
  return sha256Hex(normalizeRecoveryCode(input));
}

/** Loose shape check before hitting the DB (8 chars of the alphabet). */
export function looksLikeRecoveryCode(input: string): boolean {
  const normalized = normalizeRecoveryCode(input);
  return normalized.length === 8 && [...normalized].every((c) => ALPHABET.includes(c));
}
