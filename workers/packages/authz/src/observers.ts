/**
 * Optional observers for auth decisions and the in-process API-key→tenant
 * cache. No-op until sinks are installed (Node Telescope Gates / Cache).
 */

export interface AuthGateEvent {
  ability: string;
  result: 'allowed' | 'denied';
  method: 'api-key' | 'jwt' | 'bearer-api-key' | 'none';
  tenantId?: string;
  userId?: string;
  path?: string;
}

export interface AuthCacheEvent {
  type: 'hit' | 'miss' | 'set';
  key: string;
  value?: unknown;
}

let gateSink: ((event: AuthGateEvent) => void) | null = null;
let cacheSink: ((event: AuthCacheEvent) => void) | null = null;

export function setAuthGateSink(fn: ((event: AuthGateEvent) => void) | null): void {
  gateSink = fn;
}

export function setAuthCacheSink(fn: ((event: AuthCacheEvent) => void) | null): void {
  cacheSink = fn;
}

export function emitAuthGate(event: AuthGateEvent): void {
  if (!gateSink) return;
  try {
    gateSink(event);
  } catch {
    /* ignore */
  }
}

export function emitAuthCache(event: AuthCacheEvent): void {
  if (!cacheSink) return;
  try {
    cacheSink(event);
  } catch {
    /* ignore */
  }
}
