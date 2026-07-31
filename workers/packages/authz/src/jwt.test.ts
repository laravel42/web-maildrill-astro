import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyJwtHS256 } from './jwt';

const b64url = (data: Buffer | string): string =>
  Buffer.from(data).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function sign(claims: Record<string, unknown>, secret: string, alg = 'HS256'): string {
  const h = b64url(JSON.stringify({ alg, typ: 'JWT' }));
  const p = b64url(JSON.stringify(claims));
  const sig = b64url(createHmac('sha256', secret).update(`${h}.${p}`).digest());
  return `${h}.${p}.${sig}`;
}

describe('verifyJwtHS256', () => {
  const secret = 'test-secret';

  it('verifies a valid token and returns its claims', () => {
    const claims = verifyJwtHS256(sign({ tenantId: 't1', sub: 'u1' }, secret), secret);
    expect(claims).toMatchObject({ tenantId: 't1', sub: 'u1' });
  });

  it('rejects malformed tokens', () => {
    expect(() => verifyJwtHS256('nope', secret)).toThrow(/malformed/);
  });

  it('rejects non-HS256 algorithms (alg confusion)', () => {
    expect(() => verifyJwtHS256(sign({ sub: 'u1' }, secret, 'none'), secret)).toThrow(
      /unsupported alg/,
    );
  });

  it('rejects bad signatures', () => {
    expect(() => verifyJwtHS256(sign({ sub: 'u1' }, 'other-secret'), secret)).toThrow(
      /bad signature/,
    );
  });

  it('rejects expired tokens and accepts live ones', () => {
    const past = Math.floor(Date.now() / 1000) - 60;
    const future = Math.floor(Date.now() / 1000) + 60;
    expect(() => verifyJwtHS256(sign({ exp: past }, secret), secret)).toThrow(/expired/);
    expect(verifyJwtHS256(sign({ exp: future }, secret), secret).exp).toBe(future);
  });
});
