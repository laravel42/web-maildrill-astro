import { randomBytes } from 'node:crypto';
import * as OTPAuth from 'otpauth';
import { config } from '@maildrill/config';

/**
 * Pure TOTP helpers (RFC 6238 via otpauth) — SHA-1 / 6 digits / 30s period,
 * the profile every mainstream authenticator app (1Password, Google &
 * Microsoft Authenticator, Authy, Bitwarden) supports.
 */

export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** ±1 step tolerance for clock drift without opening a wide replay window. */
export const TOTP_WINDOW = 1;

export function generateTotpSecret(): string {
  // 20 random bytes, base32 — the RFC 4226 recommended secret length.
  return new OTPAuth.Secret({ buffer: randomBytes(20).buffer as ArrayBuffer }).base32;
}

function buildTotp(secretBase32: string, accountLabel: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: config.security.rpName,
    label: accountLabel,
    algorithm: 'SHA1',
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD_SECONDS,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

/** otpauth:// URI for the QR code / manual entry during setup. */
export function totpSetupUri(secretBase32: string, accountLabel: string): string {
  return buildTotp(secretBase32, accountLabel).toString();
}

export interface TotpCheck {
  ok: boolean;
  /** Absolute time-step of the accepted code — persist to block replays. */
  step: number | null;
}

/**
 * Validate a submitted code against the secret. `lastUsedStep` rejects a code
 * from a time-step at or before the last accepted one, so an intercepted code
 * can't be replayed inside the tolerance window.
 */
export function verifyTotpCode(
  secretBase32: string,
  token: string,
  opts: { lastUsedStep?: number | null; now?: number } = {},
): TotpCheck {
  const clean = token.replace(/\D/g, '');
  if (clean.length !== TOTP_DIGITS) return { ok: false, step: null };
  const timestamp = opts.now ?? Date.now();
  const totp = buildTotp(secretBase32, 'verify');
  const delta = totp.validate({ token: clean, timestamp, window: TOTP_WINDOW });
  if (delta === null) return { ok: false, step: null };
  const step = Math.floor(timestamp / 1000 / TOTP_PERIOD_SECONDS) + delta;
  if (opts.lastUsedStep != null && step <= opts.lastUsedStep) return { ok: false, step: null };
  return { ok: true, step };
}

/** Generate a code for a secret — test/dev helper, never exposed via HTTP. */
export function totpCodeAt(secretBase32: string, timestamp: number): string {
  return buildTotp(secretBase32, 'verify').generate({ timestamp });
}
