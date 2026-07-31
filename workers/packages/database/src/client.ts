import { drizzle } from 'drizzle-orm/node-postgres';
import type { Logger } from 'drizzle-orm';
import { Pool } from 'pg';
import { config } from '@maildrill/config';
import * as schema from './schema';

export const pool = new Pool({
  connectionString: config.db.url,
  max: config.db.poolMax,
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
