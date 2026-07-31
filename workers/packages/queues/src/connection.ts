import IORedis from 'ioredis';
import { config } from '@maildrill/config';
import { instrumentRedisClient } from './redis-observer';

export type RedisConnectionKind = 'shared' | 'worker';

/** BullMQ requires `maxRetriesPerRequest: null` on its connections. */
export function createRedis(kind: RedisConnectionKind = 'worker'): IORedis {
  const redis = new IORedis(config.redis.url, { maxRetriesPerRequest: null });
  // Always wrap; emit is a no-op until a sink is installed. Worker BRPOP/etc.
  // are filtered inside the observer so they don't flood the dashboard.
  instrumentRedisClient(redis, kind);
  return redis;
}

let shared: IORedis | null = null;

/** Shared connection for producers (queues). Workers get their own. */
export function sharedConnection(): IORedis {
  return (shared ??= createRedis('shared'));
}

export async function closeSharedConnection(): Promise<void> {
  if (shared) {
    await shared.quit();
    shared = null;
  }
}
