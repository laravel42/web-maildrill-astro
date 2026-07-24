import { createHmac, timingSafeEqual } from "node:crypto";

function b64urlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export interface JwtClaims {
  tenantId?: string;
  sub?: string;
  exp?: number;
  [key: string]: unknown;
}

/**
 * Minimal HS256 JWT verification (no external dep). Used for service-to-service
 * / programmatic callers that present a signed token instead of an API key.
 */
export function verifyJwtHS256(token: string, secret: string): JwtClaims {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("malformed token");
  const [h, p, sig] = parts as [string, string, string];

  const header = JSON.parse(b64urlDecode(h).toString("utf8")) as { alg?: string };
  if (header.alg !== "HS256") throw new Error("unsupported alg");

  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const provided = b64urlDecode(sig);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error("bad signature");
  }

  const claims = JSON.parse(b64urlDecode(p).toString("utf8")) as JwtClaims;
  if (typeof claims.exp === "number" && claims.exp * 1000 < Date.now()) {
    throw new Error("token expired");
  }
  return claims;
}
