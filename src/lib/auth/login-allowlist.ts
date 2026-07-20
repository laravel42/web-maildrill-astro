/**
 * Login is currently limited to a single confirmed account while the product is
 * in its private-rollout phase. Every other address is sent to the waitlist
 * (sign-up) rather than emailed a sign-in code.
 *
 * Shared by the login form (client) and the /api/login-code proxy (server) so
 * the gate can't be bypassed by hitting the endpoint directly.
 */
export const LOGIN_ALLOWLIST: readonly string[] = ['hello@laravel42.com'];

/** Case-insensitive, whitespace-tolerant membership check. */
export function isAllowedLoginEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return LOGIN_ALLOWLIST.includes(normalized);
}
