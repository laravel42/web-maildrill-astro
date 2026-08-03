import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
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
  const credential = await startRegistration({ optionsJSON: options });
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
  const credential = await startAuthentication({ optionsJSON: options });
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
  const credential = await startAuthentication({ optionsJSON: options });
  await api.post('me/security/reauth/passkey', { challengeId, credential });
}
