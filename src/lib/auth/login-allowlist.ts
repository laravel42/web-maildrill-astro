/**
 * Optional allowlist for sign-in codes.
 *
 * Registration is self-service: verifying a code creates the user, their
 * workspace and its Infobip entity (see `verifyLoginCode` in workers). The
 * allowlist exists only to close that down during a private rollout.
 *
 * An empty list means open registration — anyone can request a code and get an
 * account. Set `PUBLIC_LOGIN_ALLOWLIST` to a comma-separated list of addresses
 * to restrict it again; the same value is read by the login form (client) and
 * the /api/login-code proxy (server), so the gate cannot be bypassed by hitting
 * the endpoint directly.
 */
const RAW = (import.meta.env.PUBLIC_LOGIN_ALLOWLIST ?? '') as string;

export const LOGIN_ALLOWLIST: readonly string[] = RAW.split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** True when registration is open to anyone (no allowlist configured). */
export const REGISTRATION_OPEN = LOGIN_ALLOWLIST.length === 0;

/** Case-insensitive, whitespace-tolerant membership check. */
export function isAllowedLoginEmail(email: string): boolean {
  if (REGISTRATION_OPEN) return true;
  return LOGIN_ALLOWLIST.includes(email.trim().toLowerCase());
}
