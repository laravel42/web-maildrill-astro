import {
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { api } from './api';

/**
 * Browser-side WebAuthn ceremonies. Options come from the server, the
 * assertion/attestation goes straight back for server-side verification —
 * nothing is trusted client-side beyond driving the browser API.
 */

export function passkeysSupported(): boolean {
  return browserSupportsWebAuthn();
}

/** Thrown when the user cancels the browser prompt — callers show no error. */
export function isWebAuthnCancel(err: unknown): boolean {
  return err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'AbortError');
}

/**
 * No authenticator responded before our deadline. Distinct from a cancel so
 * callers can show `message` (user-facing) instead of failing silently.
 */
export class WebAuthnTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebAuthnTimeoutError';
  }
}

/** Backstop when the device has a built-in authenticator (prompt is instant). */
export const CEREMONY_TIMEOUT_MS = 90_000;
/**
 * Deadline when the device has NO built-in authenticator: the browser sits
 * waiting for a security key or phone that may simply not exist, so give up
 * quickly and tell the user what the device is missing.
 */
export const NO_PLATFORM_AUTH_TIMEOUT_MS = 10_000;

/**
 * Race a WebAuthn ceremony against a deadline. On timeout, `onTimeout` runs
 * (used to abort the native prompt) and the returned promise rejects with a
 * WebAuthnTimeoutError carrying `message`. The late AbortError from the
 * cancelled ceremony settles into the already-rejected promise harmlessly.
 */
export function withCeremonyTimeout<T>(
  ceremony: Promise<T>,
  timeoutMs: number,
  message: string,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout?.();
      reject(new WebAuthnTimeoutError(message));
    }, timeoutMs);
    ceremony.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/** Start a ceremony with a deadline tuned to the device's hardware. */
async function runCeremony<T>(start: () => Promise<T>): Promise<T> {
  const hasPlatformAuth = await platformAuthenticatorIsAvailable().catch(() => false);
  const timeoutMs = hasPlatformAuth ? CEREMONY_TIMEOUT_MS : NO_PLATFORM_AUTH_TIMEOUT_MS;
  const message = hasPlatformAuth
    ? 'The passkey request timed out — no authenticator responded. Try again.'
    : 'No passkey device responded. This device has no built-in authenticator (like Touch ID or Windows Hello) — insert a security key or use your phone, then try again.';
  return withCeremonyTimeout(start(), timeoutMs, message, () =>
    WebAuthnAbortService.cancelCeremony(),
  );
}

export interface RegisteredPasskey {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

/** Full registration ceremony from the Profile page (authenticated). */
export async function registerPasskey(name?: string): Promise<RegisteredPasskey> {
  const { options, challengeId } = await api.post<{
    options: PublicKeyCredentialCreationOptionsJSON;
    challengeId: string;
  }>('me/security/passkeys/options');
  const credential = await runCeremony(() => startRegistration({ optionsJSON: options }));
  const { passkey } = await api.post<{ passkey: RegisteredPasskey }>('me/security/passkeys', {
    challengeId,
    credential,
    ...(name ? { name } : {}),
  });
  return passkey;
}

/** Login-page ceremony (unauthenticated): returns a one-time login ticket. */
export async function passkeyLoginTicket(): Promise<string> {
  const optRes = await fetch('/api/passkey-login-options', { method: 'POST' });
  if (!optRes.ok) throw new Error('Passkey sign-in is unavailable right now.');
  const { options, challengeId } = (await optRes.json()) as {
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeId: string;
  };
  const credential = await runCeremony(() => startAuthentication({ optionsJSON: options }));
  const verifyRes = await fetch('/api/passkey-login-verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ challengeId, credential }),
  });
  if (!verifyRes.ok) throw new Error('That passkey was not recognized.');
  const { ticket } = (await verifyRes.json()) as { ticket: string };
  return ticket;
}

/** Step-up ceremony from the Profile page (authenticated). */
export async function reauthWithPasskey(): Promise<void> {
  const { options, challengeId } = await api.post<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeId: string;
  }>('me/security/reauth/passkey/options');
  const credential = await runCeremony(() => startAuthentication({ optionsJSON: options }));
  await api.post('me/security/reauth/passkey', { challengeId, credential });
}
