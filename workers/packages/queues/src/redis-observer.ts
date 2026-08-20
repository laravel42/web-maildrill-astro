/**
 * Optional observer for Redis commands issued through our ioredis clients.
 * Wraps `sendCommand` (no MONITOR mode — that would break BullMQ). No-op until
 * a sink is installed. Blocking/noise commands are filtered at emit time.
 */

import type IORedis from 'ioredis';

export interface RedisCommandEvent {
  command: string;
  connection: 'shared' | 'worker';
  args: string[];
  durationMs: number;
}

let sink: ((event: RedisCommandEvent) => void) | null = null;

export function setRedisCommandSink(fn: ((event: RedisCommandEvent) => void) | null): void {
  sink = fn;
}

export function emitRedisCommand(event: RedisCommandEvent): void {
  if (!sink) return;
  try {
    sink(event);
  } catch {
    /* observation must never break Redis I/O */
  }
}

/** BullMQ internals + connection housekeeping — not useful in the dashboard. */
const IGNORED = new Set([
  'AUTH',
  'HELLO',
  'SELECT',
  'CLIENT',
  'INFO',
  'PING',
  'ECHO',
  'QUIT',
  'BRPOP',
  'BLPOP',
  'BZPOPMIN',
  'BZPOPMAX',
  'BRPOPLPUSH',
  'BLMOVE',
  'BZMPOP',
  'XREAD',
  'XREADGROUP',
  'SUBSCRIBE',
  'PSUBSCRIBE',
  'UNSUBSCRIBE',
  'PUNSUBSCRIBE',
  'SSUBSCRIBE',
]);

const MAX_ARG_LEN = 120;
const MAX_ARGS = 8;

function stringifyArg(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') {
    return value.length > MAX_ARG_LEN ? `${value.slice(0, MAX_ARG_LEN)}…` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Buffer.isBuffer(value)) return `<buf:${value.length}>`;
  try {
    const s = JSON.stringify(value);
    return s.length > MAX_ARG_LEN ? `${s.slice(0, MAX_ARG_LEN)}…` : s;
  } catch {
    return String(value);
  }
}

/**
 * Instrument a client by wrapping `sendCommand`. Safe to call more than once
 * (subsequent calls are no-ops). Emits only when a sink is installed.
 */
export function instrumentRedisClient(redis: IORedis, connection: 'shared' | 'worker'): void {
  const flagged = redis as IORedis & { __telescopeInstrumented?: boolean };
  if (flagged.__telescopeInstrumented) return;
  flagged.__telescopeInstrumented = true;

  const original = redis.sendCommand.bind(redis);
  redis.sendCommand = ((
    command: { name?: string; args?: unknown[]; promise?: Promise<unknown> },
    stream?: unknown,
  ) => {
    const started = performance.now();
    const result = original(command as never, stream as never);
    const name = String(command?.name ?? 'unknown').toUpperCase();
    if (!IGNORED.has(name) && sink) {
      const done = () => {
        const args = (command?.args ?? []).slice(0, MAX_ARGS).map(stringifyArg);
        emitRedisCommand({
          command: name,
          connection,
          args,
          durationMs: Math.round(performance.now() - started),
        });
      };
      Promise.resolve(command?.promise ?? result).then(done, done);
    }
    return result;
  }) as typeof redis.sendCommand;
}
