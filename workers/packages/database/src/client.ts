import { drizzle } from 'drizzle-orm/node-postgres';
import type { Logger } from 'drizzle-orm';
import { Pool } from 'pg';
import { config } from '@maildrill/config';
import * as schema from './schema';

/**
 * Connection pool.
 *
 * The defaults left two production hazards: `connectionTimeoutMillis: 0` meant a
 * request waited forever for a connection instead of failing fast, so with a
 * pool of 10 a handful of slow queries stalls the whole API rather than shedding
 * load; and connections were never recycled, so a leak or a server-side memory
 * creep persisted for the life of the process.
 *
 * `statement_timeout` stays OFF by default on purpose: this same pool is used by
 * the seeders and migrations, whose bulk inserts legitimately run for minutes.
 * Set PG_STATEMENT_TIMEOUT_MS in the API's environment (not in CLI jobs) to cap
 * request-path queries.
 */
const statementTimeoutMs = Number(process.env.PG_STATEMENT_TIMEOUT_MS ?? 0);

export const pool = new Pool({
  connectionString: config.db.url,
  max: config.db.poolMax,
  // Fail fast rather than queueing indefinitely behind a saturated pool.
  connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 5_000),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS ?? 30_000),
  // Recycle connections so a long-lived process cannot accumulate bad ones.
  maxLifetimeSeconds: Number(process.env.PG_MAX_LIFETIME_S ?? 1_800),
  keepAlive: true,
  application_name: process.env.PG_APP_NAME ?? 'maildrill',
  ...(statementTimeoutMs > 0
    ? { statement_timeout: statementTimeoutMs, query_timeout: statementTimeoutMs }
    : {}),
});

/**
 * Optional query sink for observability tools (e.g. Node Telescope). It is a
 * no-op until a sink is installed via `setQuerySink`, so production and every
 * other app are unaffected. Fires for every Drizzle query, transactions included.
 */
let querySink: ((sql: string, params: unknown[]) => void) | null = null;
export function setQuerySink(sink: ((sql: string, params: unknown[]) => void) | null): void {
  querySink = sink;
}
const drizzleLogger: Logger = {
  logQuery(query, params) {
    querySink?.(query, params);
  },
};

export const db = drizzle(pool, { schema, casing: 'snake_case', logger: drizzleLogger });

export type DB = typeof db;
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0];

export async function closeDb(): Promise<void> {
  await pool.end();
}
