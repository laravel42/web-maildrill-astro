import { describe, expect, it } from 'vitest';
import {
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { FakeAuthenticator } from './testing/fake-authenticator';

/**
 * Exercises the REAL @simplewebauthn/server verification (signatures, CBOR,
 * rpId hashes, origins, counters) against a software authenticator — the same
 * calls and parameters `security/webauthn.ts` uses. Nothing here mocks the
 * cryptographic checks.
 */

const RP_ID = 'localhost';
const ORIGIN = 'http://localhost:4321';
const CHALLENGE = Buffer.from('test-challenge-000000000000000001').toString('base64url');

async function register(authr: FakeAuthenticator, challenge = CHALLENGE) {
  return verifyRegistrationResponse({
    response: authr.register(challenge) as never,
    expectedChallenge: challenge,
    expectedOrigin: [ORIGIN],
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });
}

describe('passkey registration verification', () => {
  it('accepts a valid attestation and extracts the credential', async () => {
    const authr = new FakeAuthenticator();
    const result = await register(authr);
    expect(result.verified).toBe(true);
    const cred = result.registrationInfo!.credential;
    expect(cred.id).toBe(authr.credentialId.toString('base64url'));
    expect(cred.counter).toBe(0);
    expect(cred.publicKey.length).toBeGreaterThan(70);
  });

  it('rejects a response signed over the wrong challenge', async () => {
    const authr = new FakeAuthenticator();
    const other = Buffer.from('a-different-challenge-value-here').toString('base64url');
    await expect(
      verifyRegistrationResponse({
        response: authr.register(other) as never,
        expectedChallenge: CHALLENGE,
        expectedOrigin: [ORIGIN],
        expectedRPID: RP_ID,
        requireUserVerification: false,
      }),
    ).rejects.toThrow(/challenge/i);
  });

  it('rejects a response from the wrong origin', async () => {
    const authr = new FakeAuthenticator();
    await expect(
      verifyRegistrationResponse({
        response: authr.register(CHALLENGE, { origin: 'https://evil.example.com' }) as never,
        expectedChallenge: CHALLENGE,
        expectedOrigin: [ORIGIN],
        expectedRPID: RP_ID,
        requireUserVerification: false,
      }),
    ).rejects.toThrow(/origin/i);
  });
});

describe('passkey authentication verification', () => {
  async function registeredCredential(authr: FakeAuthenticator) {
    const reg = await register(authr);
    const cred = reg.registrationInfo!.credential;
    return {
      id: cred.id,
      publicKey: cred.publicKey,
      counter: cred.counter,
      transports: undefined,
    };
  }

  it('accepts a valid assertion and reports the new counter', async () => {
    const authr = new FakeAuthenticator();
    const credential = await registeredCredential(authr);
    const result = await verifyAuthenticationResponse({
      response: authr.authenticate(CHALLENGE) as never,
      expectedChallenge: CHALLENGE,
      expectedOrigin: [ORIGIN],
      expectedRPID: RP_ID,
      credential,
      requireUserVerification: false,
    });
    expect(result.verified).toBe(true);
    expect(result.authenticationInfo.newCounter).toBe(1);
  });

  it('rejects an assertion signed by a different key', async () => {
    const authr = new FakeAuthenticator();
    const impostor = new FakeAuthenticator();
    const credential = await registeredCredential(authr);
    // Same credential id on the wire, but the impostor's signature.
    const assertion = impostor.authenticate(CHALLENGE);
    assertion.id = authr.credentialId.toString('base64url');
    assertion.rawId = assertion.id;
    const result = await verifyAuthenticationResponse({
      response: assertion as never,
      expectedChallenge: CHALLENGE,
      expectedOrigin: [ORIGIN],
      expectedRPID: RP_ID,
      credential,
      requireUserVerification: false,
    }).catch(() => ({ verified: false }));
    expect(result.verified).toBe(false);
  });

  it('rejects the wrong relying-party id', async () => {
    const authr = new FakeAuthenticator();
    const credential = await registeredCredential(authr);
    const result = await verifyAuthenticationResponse({
      response: authr.authenticate(CHALLENGE, { rpId: 'evil.example.com' }) as never,
      expectedChallenge: CHALLENGE,
      expectedOrigin: [ORIGIN],
      expectedRPID: RP_ID,
      credential,
      requireUserVerification: false,
    }).catch(() => ({ verified: false }));
    expect(result.verified).toBe(false);
  });

  it('rejects the wrong origin', async () => {
    const authr = new FakeAuthenticator();
    const credential = await registeredCredential(authr);
    await expect(
      verifyAuthenticationResponse({
        response: authr.authenticate(CHALLENGE, { origin: 'https://evil.example.com' }) as never,
        expectedChallenge: CHALLENGE,
        expectedOrigin: [ORIGIN],
        expectedRPID: RP_ID,
        credential,
        requireUserVerification: false,
      }),
    ).rejects.toThrow(/origin/i);
  });

  it('rejects a replayed challenge value signed for another ceremony', async () => {
    const authr = new FakeAuthenticator();
    const credential = await registeredCredential(authr);
    const other = Buffer.from('another-ceremony-challenge-value').toString('base64url');
    await expect(
      verifyAuthenticationResponse({
        response: authr.authenticate(other) as never,
        expectedChallenge: CHALLENGE,
        expectedOrigin: [ORIGIN],
        expectedRPID: RP_ID,
        credential,
        requireUserVerification: false,
      }),
    ).rejects.toThrow(/challenge/i);
  });
});
