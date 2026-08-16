/**
 * Backfill / reconcile `subscriber_engagement` — the per-subscriber open and
 * click rollup the roster filters on (migration 0025).
 *
 * Batched and resumable by design: migration 0025 deliberately ships the table
 * empty, because loading a million rows inside the migration transaction holds
 * it open for the whole load and cannot pick up where it stopped.
 *
 * Run (root .env via @maildrill/config):
 *   pnpm --dir workers db:backfill:engagement
 *   pnpm --dir workers db:backfill:engagement --tenant=hello@laravel42.com
 *   pnpm --dir workers db:backfill:engagement --reconcile      # recompute every row
 *   pnpm --dir workers db:backfill:engagement --batch=10000
 *   pnpm --dir workers db:backfill:engagement --max=100000     # time-box a run
 *   pnpm --dir workers db:backfill:engagement --after=<uuid>   # resume
 *
 * Default mode only touches subscribers that have no rollup row, so an
 * interrupted run is resumed by running it again — `--after` is only a
 * shortcut past the already-done prefix. `--reconcile` recomputes everything
 * and rewrites just the rows whose counters drifted, which is the mode the
 * nightly repair uses.
 */
import { eq } from 'drizzle-orm';
import { db, pool, tenants } from '@maildrill/database';
import { reconcileSubscriberEngagement } from '@maildrill/services';

function argValue(flag: string): string | null {
  const eqArg = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eqArg) return eqArg.slice(flag.length + 1);
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith('-')) {
    return process.argv[i + 1]!;
  }
  return null;
}

async function resolveTenantId(nameOrId: string): Promise<string> {
  if (/^[0-9a-f-]{36}$/i.test(nameOrId)) return nameOrId;
  const rows = await db.select().from(tenants).where(eq(tenants.name, nameOrId)).limit(1);
  const row = rows[0];
  if (!row) throw new Error(`tenant not found: ${nameOrId}`);
  return row.id;
}

async function main(): Promise<void> {
  const tenantArg = argValue('--tenant');
  const tenantId = tenantArg ? await resolveTenantId(tenantArg) : undefined;
  const reconcile = process.argv.includes('--reconcile');
  const batchSize = Number(argValue('--batch') ?? 5000);
  const maxSubscribers = Number(argValue('--max') ?? 0);
  const after = argValue('--after') ?? undefined;

  const mode = reconcile ? 'reconcile (recompute all)' : 'backfill (missing rows only)';
  // eslint-disable-next-line no-console
  console.log(
    `subscriber_engagement ${mode}` +
      `${tenantId ? ` · tenant ${tenantId}` : ' · all tenants'} · batch ${batchSize}`,
  );

  let lastLogged = 0;
  const result = await reconcileSubscriberEngagement({
    tenantId,
    batchSize,
    maxSubscribers,
    after,
    onlyMissing: !reconcile,
    onBatch: ({ scanned, written, lastId }) => {
      // One line per ~50k so a million-row run is readable, plus enough detail
      // to resume from if the run is killed.
      if (scanned - lastLogged < 50_000) return;
      lastLogged = scanned;
      // eslint-disable-next-line no-console
      console.log(`  ${scanned} scanned · ${written} written · --after=${lastId}`);
    },
  });

  // eslint-disable-next-line no-console
  console.log(
    `done: ${result.scanned} scanned, ${result.written} written in ${result.durationMs}ms` +
      `${result.complete ? '' : ` · not finished, resume with --after=${result.lastId}`}`,
  );
}

main()
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
