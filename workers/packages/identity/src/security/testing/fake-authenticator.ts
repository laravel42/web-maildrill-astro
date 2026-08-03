/**
 * A minimal software WebAuthn authenticator for tests.
 *
 * Produces registration and authentication responses that pass
 * @simplewebauthn/server's real verification (ES256, attestation "none"),
 * so tests exercise genuine signature/origin/rpId/challenge/counter checks
 * instead of mocking the verifier.
 */
import { createHash, createSign, generateKeyPairSync, randomBytes, type KeyObject } from 'node:crypto';

const b64url = (b: Buffer | Uint8Array): string => Buffer.from(b).toString('base64url');

/** Tiny CBOR encoder — just the shapes WebAuthn payloads need. */
function cborEncode(value: unknown): Buffer {
  if (typeof value === 'number' && Number.isInteger(value)) {
    if (value >= 0) return cborHead(0, value);
    return cborHead(1, -value - 1);
  }
  if (typeof value === 'string') {
    const bytes = Buffer.from(value, 'utf8');
    return Buffer.concat([cborHead(3, bytes.length), bytes]);
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const bytes = Buffer.from(value);
    return Buffer.concat([cborHead(2, bytes.length), bytes]);
  }
  if (value instanceof Map) {
    const parts: Buffer[] = [cborHead(5, value.size)];
    for (const [k, v] of value) parts.push(cborEncode(k), cborEncode(v));
    return Buffer.concat(parts);
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    const parts: Buffer[] = [cborHead(5, entries.length)];
    for (const [k, v] of entries) parts.push(cborEncode(k), cborEncode(v));
    return Buffer.concat(parts);
  }
  throw new Error(`cborEncode: unsupported value ${String(value)}`);
}

function cborHead(major: number, length: number): Buffer {
  if (length < 24) return Buffer.from([(major << 5) | length]);
  if (length < 256) return Buffer.from([(major << 5) | 24, length]);
  if (length < 65536) {
    const b = Buffer.alloc(3);
    b[0] = (major << 5) | 25;
    b.writeUInt16BE(length, 1);
    return b;
  }
  throw new Error('cborHead: length too large for test encoder');
}

export interface FakeAuthenticatorOptions {
  rpId?: string;
  origin?: string;
  /** Sent as the userHandle on assertions (discoverable-credential style). */
  userHandle?: string;
}

export class FakeAuthenticator {
  readonly credentialId: Buffer;
  readonly rpId: string;
  readonly origin: string;
  counter: number;
  private readonly privateKey: KeyObject;
  private readonly cosePublicKey: Buffer;
  private readonly userHandle?: string;

  constructor(opts: FakeAuthenticatorOptions = {}) {
    this.rpId = opts.rpId ?? 'localhost';
    this.origin = opts.origin ?? 'http://localhost:4321';
    this.userHandle = opts.userHandle;
    this.credentialId = randomBytes(32);
    this.counter = 0;
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    this.privateKey = privateKey;
    const jwk = publicKey.export({ format: 'jwk' });
    const x = Buffer.from(String(jwk.x), 'base64url');
    const y = Buffer.from(String(jwk.y), 'base64url');
    // COSE_Key: kty(1)=EC2(2), alg(3)=ES256(-7), crv(-1)=P-256(1), x(-2), y(-3)
    this.cosePublicKey = cborEncode(
      new Map<number, unknown>([
        [1, 2],
        [3, -7],
        [-1, 1],
        [-2, x],
        [-3, y],
      ]),
    );
  }

  private rpIdHash(rpId = this.rpId): Buffer {
    return createHash('sha256').update(rpId).digest();
  }

  private clientDataJSON(type: 'webauthn.create' | 'webauthn.get', challenge: string, origin?: string): Buffer {
    return Buffer.from(
      JSON.stringify({ type, challenge, origin: origin ?? this.origin, crossOrigin: false }),
      'utf8',
    );
  }

  /** Build a RegistrationResponseJSON for the given options challenge. */
  register(challenge: string, overrides: { origin?: string; rpId?: string } = {}) {
    const flags = 0x45; // UP | UV | AT
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32BE(this.counter, 0);
    const credIdLen = Buffer.alloc(2);
    credIdLen.writeUInt16BE(this.credentialId.length, 0);
    const authData = Buffer.concat([
      this.rpIdHash(overrides.rpId),
      Buffer.from([flags]),
      counterBuf,
      Buffer.alloc(16), // AAGUID
      credIdLen,
      this.credentialId,
      this.cosePublicKey,
    ]);
    const attestationObject = cborEncode({ fmt: 'none', attStmt: {}, authData });
    return {
      id: b64url(this.credentialId),
      rawId: b64url(this.credentialId),
      response: {
        clientDataJSON: b64url(this.clientDataJSON('webauthn.create', challenge, overrides.origin)),
        attestationObject: b64url(attestationObject),
        transports: ['internal'] as string[],
      },
      type: 'public-key' as const,
      clientExtensionResults: {},
      authenticatorAttachment: 'platform' as const,
    };
  }

  /** Build an AuthenticationResponseJSON. Increments the counter by default. */
  authenticate(
    challenge: string,
    overrides: { origin?: string; rpId?: string; counter?: number } = {},
  ) {
    this.counter = overrides.counter ?? this.counter + 1;
    const flags = 0x05; // UP | UV
    const counterBuf = Buffer.alloc(4);
    counterBuf.writeUInt32BE(this.counter, 0);
    const authenticatorData = Buffer.concat([this.rpIdHash(overrides.rpId), Buffer.from([flags]), counterBuf]);
    const clientData = this.clientDataJSON('webauthn.get', challenge, overrides.origin);
    const clientDataHash = createHash('sha256').update(clientData).digest();
    const signature = createSign('SHA256')
      .update(Buffer.concat([authenticatorData, clientDataHash]))
      .sign(this.privateKey);
    return {
      id: b64url(this.credentialId),
      rawId: b64url(this.credentialId),
      response: {
        clientDataJSON: b64url(clientData),
        authenticatorData: b64url(authenticatorData),
        signature: b64url(signature),
        ...(this.userHandle ? { userHandle: b64url(Buffer.from(this.userHandle)) } : {}),
      },
      type: 'public-key' as const,
      clientExtensionResults: {},
    };
  }
}
