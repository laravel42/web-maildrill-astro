import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

/**
 * Prove the migrations apply cleanly from EVERY starting state, not just from
 * an empty database.
 *
 *   pnpm db:migrate:verify
 *
 * Why this exists: `pnpm db:migrate` from scratch is not a deploy. A deployed
 * server is already at some migration k, and the deploy applies k+1..n — and
 * Drizzle runs that whole remainder inside ONE transaction. A migration pair
 * can therefore be perfectly fine from scratch and fail in production.
 *
 * That is not hypothetical. 0019 added an enum value and 0028 used it in an
 * index predicate. Postgres allows a new enum value to be used in the same
 * transaction ONLY when the type was also created there — true when replaying
 * from 0001, false on a server that already had 0001-0018 committed. The deploy
 * failed with 55P04 while every local run passed.
 *
 * So this walks the boundary: for each k, apply 0..k in one committed run, then
 * the remainder in a second. n+1 runs against throwaway databases. Slow enough
 * to be a command rather than a test, fast enough to run before any deploy that
 * touches migrations.
 */

const ADMIN_DB = 'postgres';
const DB_PREFIX = 'md_migverify';

function urlFor(base: string, dbName: string): string {
  return `${base.slice(0, base.lastIndexOf('/'))}/${dbName}`;
}

function psql(url: string, sql: string): void {
  execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-c', sql], { stdio: 'pipe' });
}

/** Journal trimmed to the first `count` entries, in a throwaway folder. */
function partialMigrations(source: string, count: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'mig-'));
  cpSync(source, dir, { recursive: true });
  const journalPath = join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  journal.entries = journal.entries.slice(0, count);
  writeFileSync(journalPath, JSON.stringify(journal, null, 2));
  return dir;
}

async function applyTo(url: string, folder: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: url });
  try {
    await migrate(drizzle(pool), { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  const base = process.env.DATABASE_URL ?? '';
  if (!/@(localhost|127\.0\.0\.1|host\.docker\.internal|postgres|db)[:/]/.test(base)) {
    throw new Error('Refusing to run against a non-local DATABASE_URL — this creates and drops databases.');
  }
  const admin = urlFor(base, ADMIN_DB);
  const source = new URL('../../../migrations', import.meta.url).pathname;
  const all = JSON.parse(readFileSync(join(source, 'meta', '_journal.json'), 'utf8')) as {
    entries: Array<{ idx: number; tag: string }>;
  };
  const n = all.entries.length;
  console.log(`Verifying ${n} migrations across ${n} resume points\n`);

  const failures: string[] = [];
  for (let k = 1; k <= n; k += 1) {
    const dbName = `${DB_PREFIX}_${k}`;
    const url = urlFor(base, dbName);
    const partial = partialMigrations(source, k);
    psql(admin, `DROP DATABASE IF EXISTS ${dbName}`);
    psql(admin, `CREATE DATABASE ${dbName}`);
    const stoppedAt = all.entries[k - 1]!.tag;
    try {
      // Two separate runs = two separate transactions, exactly like a server
      // that deployed once before and is now deploying again.
      await applyTo(url, partial);
      await applyTo(url, source);
      process.stdout.write('.');
    } catch (err) {
      const e = err as { code?: string; message?: string };
      failures.push(`  after ${stoppedAt}: ${e.code ?? ''} ${String(e.message).split('\n')[0]}`);
      process.stdout.write('F');
    } finally {
      rmSync(partial, { recursive: true, force: true });
      psql(admin, `DROP DATABASE IF EXISTS ${dbName}`);
    }
  }

  console.log('\n');
  if (failures.length > 0) {
    console.error(`${failures.length} resume point(s) fail:\n${failures.join('\n')}`);
    process.exit(1);
  }
  console.log(`All ${n} resume points apply cleanly.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
