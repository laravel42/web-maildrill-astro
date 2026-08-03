/**
 * The authentication assurance policy — the single place that decides which
 * factors a login needs and what a completed challenge is worth. Routes and
 * UI must consult this instead of re-deriving rules.
 */

export type AuthMethod = 'code' | 'totp' | 'recovery' | 'webauthn' | 'trusted_device';

export interface LoginPolicyInput {
  /** The user has a confirmed authenticator app. */
  totpEnabled: boolean;
  /** A valid, unexpired, unrevoked trusted-device token accompanied the login. */
  trustedDevice: boolean;
}

export interface LoginPolicyDecision {
  requiresSecondFactor: boolean;
  /** Methods recorded on the session when the first factor alone suffices. */
  amr: AuthMethod[];
}

/**
 * Magic-link (email code) login: when the account has TOTP enabled, a second
 * factor is required unless the device is already trusted.
 */
export function decideCodeLogin(input: LoginPolicyInput): LoginPolicyDecision {
  if (input.totpEnabled && !input.trustedDevice) {
    return { requiresSecondFactor: true, amr: ['code'] };
  }
  return {
    requiresSecondFactor: false,
    amr: input.totpEnabled ? ['code', 'trusted_device'] : ['code'],
  };
}

/**
 * Passkey login is explicitly treated as phishing-resistant MFA: the ceremony
 * proves possession (the credential) plus user verification (biometric/PIN,
 * enforced by requiring UV in the WebAuthn verification). It therefore never
 * triggers the TOTP challenge.
 */
export function decidePasskeyLogin(): LoginPolicyDecision {
  return { requiresSecondFactor: false, amr: ['webauthn'] };
}

/** Does a session's method set count as multi-factor? */
export function isMfaSatisfied(amr: readonly string[]): boolean {
  if (amr.includes('webauthn')) return true;
  return amr.includes('code') && (amr.includes('totp') || amr.includes('recovery'));
}
