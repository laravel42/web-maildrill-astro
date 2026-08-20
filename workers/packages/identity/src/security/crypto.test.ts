import { describe, expect, it } from 'vitest';
import {
  composeOpaqueToken,
  decryptSecret,
  encryptSecret,
  mintOpaqueSecret,
  secretMatchesHash,
  splitOpaqueToken,
} from './crypto';

describe('encryption at rest', () => {
  it('round-trips a secret', () => {
    const ct = encryptSecret('JBSWY3DPEHPK3PXP');
    expect(ct).toMatch(/^v1\./);
    expect(ct).not.toContain('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(ct)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('uses a fresh IV per encryption', () => {
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('rejects tampered ciphertext (authenticated encryption)', () => {
    const ct = encryptSecret('sensitive');
    const [v, iv, body, tag] = ct.split('.');
    const flipped = Buffer.from(body!, 'base64url');
    flipped[0] = (flipped[0] as number) ^ 0xff;
    const tampered = [v, iv, flipped.toString('base64url'), tag].join('.');
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('rejects unknown formats', () => {
    expect(() => decryptSecret('v2.a.b.c')).toThrow();
    expect(() => decryptSecret('garbage')).toThrow();
  });
});

describe('opaque tokens', () => {
  const ROW_ID = '0b7bb0bc-1b2a-4c3d-8e4f-5a6b7c8d9e0f';

  it('mints, composes, splits, and verifies', () => {
    const { secret, hash } = mintOpaqueSecret();
    const token = composeOpaqueToken(ROW_ID, secret);
    const parts = splitOpaqueToken(token);
    expect(parts).toEqual({ id: ROW_ID, secret });
    expect(secretMatchesHash(secret, hash)).toBe(true);
  });

  it('rejects a wrong secret in constant-time compare', () => {
    const { hash } = mintOpaqueSecret();
    const { secret: other } = mintOpaqueSecret();
    expect(secretMatchesHash(other, hash)).toBe(false);
  });

  it('rejects malformed tokens, including non-UUID row ids', () => {
    expect(splitOpaqueToken('nodot')).toBeNull();
    expect(splitOpaqueToken('.secret')).toBeNull();
    expect(splitOpaqueToken(`${ROW_ID}.`)).toBeNull();
    expect(splitOpaqueToken('bogus.secret')).toBeNull(); // would break the uuid column
  });
});
