import { lookup as dnsLookup, type LookupAddress } from 'node:dns';
import { request as httpRequest, type IncomingMessage } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { AutomationStepError } from '../domain/retry';
import type { AutomationLimits } from '../domain/limits';

/**
 * Outbound HTTP for the "HTTP request" action.
 *
 * A workflow's URL is user input that the *server* dereferences, which is the textbook
 * SSRF shape: without a guard, an automation is a proxy into the private network, the
 * cloud metadata endpoint, and every internal service that trusts its own subnet.
 *
 * The guard is applied at the DNS layer, not by inspecting the URL string. `node:http`
 * accepts a custom `lookup`, so the address that is *validated* is the same address that
 * is *connected to* — closing the DNS-rebinding window that a "resolve, check, then fetch"
 * implementation leaves open (the attacker's second answer never reaches the socket,
 * because there is no second resolution).
 *
 * Redirects are followed manually so every hop is re-validated: a public URL that 302s to
 * 169.254.169.254 is exactly the attack this must stop.
 */

/** IPv4 ranges that must never be reachable from a workflow. */
function isBlockedIPv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a = 0, b = 0] = parts;
  if (a === 0) return true; // "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 168) return true; // private
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true; // multicast + reserved + broadcast
  return false;
}

function isBlockedIPv6(address: string): boolean {
  const lower = address.toLowerCase().split('%')[0] ?? '';
  if (lower === '::' || lower === '::1') return true; // unspecified, loopback
  // IPv4-mapped (::ffff:10.0.0.1) inherits the v4 verdict.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (mapped?.[1]) return isBlockedIPv4(mapped[1]);
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
  if (lower.startsWith('fe8') || lower.startsWith('fe9')) return true; // link-local
  if (lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
  if (lower.startsWith('ff')) return true; // multicast
  return false;
}

export function isBlockedAddress(address: string, family: number): boolean {
  return family === 6 ? isBlockedIPv6(address) : isBlockedIPv4(address);
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

/** `lookup` for node:http that refuses to hand back a private address. */
function guardedLookup(hostname: string, options: unknown, callback: LookupCallback): void {
  dnsLookup(hostname, { all: true }, (err, addresses) => {
    if (err) {
      callback(err, '');
      return;
    }
    const list = Array.isArray(addresses) ? addresses : [];
    const allowed = list.filter((a) => !isBlockedAddress(a.address, a.family));
    if (allowed.length === 0) {
      const blocked: NodeJS.ErrnoException = new Error(
        `refusing to connect to ${hostname}: it resolves to a private or reserved address`,
      );
      blocked.code = 'EBLOCKED';
      callback(blocked, '');
      return;
    }
    const all = (options as { all?: boolean } | null)?.all === true;
    if (all) {
      callback(null, allowed);
      return;
    }
    const first = allowed[0]!;
    callback(null, first.address, first.family);
  });
}

export interface HttpActionRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpActionResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  truncated: boolean;
}

/** Headers a workflow may not set — they would let it forge Maildrill's own identity. */
const FORBIDDEN_HEADERS = new Set(['host', 'content-length', 'connection', 'transfer-encoding']);

export async function performHttpRequest(
  req: HttpActionRequest,
  limits: AutomationLimits,
): Promise<HttpActionResponse> {
  let current = req.url;
  for (let hop = 0; hop <= limits.httpMaxRedirects; hop += 1) {
    const result = await singleRequest({ ...req, url: current }, limits, hop > 0);
    if (result.kind === 'response') return result.response;
    current = result.location;
  }
  throw new AutomationStepError(
    `HTTP request exceeded ${limits.httpMaxRedirects} redirects`,
    'permanent',
  );
}

type SingleResult =
  { kind: 'response'; response: HttpActionResponse } | { kind: 'redirect'; location: string };

function singleRequest(
  req: HttpActionRequest,
  limits: AutomationLimits,
  isRedirect: boolean,
): Promise<SingleResult> {
  let url: URL;
  try {
    url = new URL(req.url);
  } catch {
    throw new AutomationStepError(`"${req.url}" is not a valid URL`, 'validation');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new AutomationStepError(
      `only http and https URLs can be requested (got ${url.protocol})`,
      'validation',
    );
  }

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!FORBIDDEN_HEADERS.has(key.toLowerCase())) headers[key] = value;
  }
  // A redirect must not carry the original request's credentials to a new origin.
  if (isRedirect) {
    delete headers.Authorization;
    delete headers.authorization;
  }
  if (
    req.body !== undefined &&
    !Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')
  ) {
    headers['content-type'] = 'application/json';
  }

  const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;

  return new Promise<SingleResult>((resolve, reject) => {
    const request = transport(
      url,
      {
        method: req.method,
        headers,
        timeout: limits.httpTimeoutMs,
        // The whole point: validate at connect time so the checked address is the
        // connected address. `httpAllowPrivate` exists only for local development stacks.
        ...(limits.httpAllowPrivate ? {} : { lookup: guardedLookup }),
      },
      (res: IncomingMessage) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && typeof location === 'string') {
          res.resume(); // drain, we are not reading this body
          resolve({ kind: 'redirect', location: new URL(location, url).toString() });
          return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > limits.httpMaxResponseBytes) {
            // Stop reading rather than buffering an unbounded response into the run log.
            truncated = true;
            res.destroy();
            return;
          }
          chunks.push(chunk);
        });
        res.on('close', () => {
          if (!truncated) return;
          resolve({
            kind: 'response',
            response: {
              status,
              headers: flattenHeaders(res.headers),
              body: Buffer.concat(chunks).toString('utf8'),
              truncated: true,
            },
          });
        });
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          const contentType = String(res.headers['content-type'] ?? '');
          let body: unknown = raw;
          if (contentType.includes('json') && raw.length > 0) {
            try {
              body = JSON.parse(raw) as unknown;
            } catch {
              body = raw;
            }
          }
          resolve({
            kind: 'response',
            response: { status, headers: flattenHeaders(res.headers), body, truncated: false },
          });
        });
      },
    );

    request.on('timeout', () => {
      request.destroy(
        new AutomationStepError(
          `HTTP request timed out after ${limits.httpTimeoutMs}ms`,
          'temporary',
        ),
      );
    });
    request.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EBLOCKED') {
        reject(new AutomationStepError(err.message, 'permanent'));
        return;
      }
      reject(err);
    });

    if (req.body !== undefined) request.write(req.body);
    request.end();
  });
}

function flattenHeaders(headers: IncomingMessage['headers']): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return out;
}
