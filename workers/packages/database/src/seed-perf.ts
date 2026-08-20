/**
 * Performance seeder — fills a dedicated workspace with data at production
 * scale so the app can be measured, not guessed at.
 *
 * Defaults: 1,000,000 subscribers · 1,000 lists · 100 sending domains ·
 * 200 templates · 1,000 campaigns · ~2 memberships per subscriber ·
 * 1,000,000 messages with realistic outcomes.
 *
 * Everything is generated INSIDE Postgres with `generate_series`. A row-by-row
 * insert of a million subscribers is hours of round trips; as set-based SQL it
 * is seconds, and the numbers stay big enough to be worth measuring.
 *
 * Isolation: all of it lands in its own tenant ("Perf Lab"), so the demo
 * workspace the dev seeder builds is never touched. Every existing user gets a
 * membership, so you can switch into it in the UI and feel the real thing.
 *
 * Run (from workers/ or the repo root — env comes from the root .env):
 *   pnpm db:seed:perf              defaults
 *   PERF_SUBSCRIBERS=5000000 pnpm db:seed:perf
 *   pnpm db:seed:perf --drop       remove the workspace and everything in it
 *
 * Tunables: PERF_SUBSCRIBERS, PERF_LISTS, PERF_DOMAINS, PERF_TEMPLATES,
 * PERF_CAMPAIGNS, PERF_MESSAGES, PERF_LISTS_PER_SUBSCRIBER, PERF_BATCH.
 */
import { sql } from 'drizzle-orm';
import { db, pool } from './client';

const num = (name: string, fallback: number) => {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

const CFG = {
  subscribers: num('PERF_SUBSCRIBERS', 1_000_000),
  lists: num('PERF_LISTS', 1_000),
  domains: num('PERF_DOMAINS', 100),
  templates: num('PERF_TEMPLATES', 200),
  campaigns: num('PERF_CAMPAIGNS', 1_000),
  messages: num('PERF_MESSAGES', 1_000_000),
  listsPerSubscriber: num('PERF_LISTS_PER_SUBSCRIBER', 2),
  /** Rows per statement. Keeps any single insert's memory bounded. */
  batch: num('PERF_BATCH', 250_000),
};

/**
 * Perf data lands in a real workspace, so every generated row carries a marker
 * in its name or address. Cleanup matches on those markers and nothing else —
 * the workspace's own lists, templates and campaigns are never touched.
 */
const OWNER_EMAIL = process.env.PERF_TENANT_EMAIL ?? 'hello@laravel42.com';
const MARK = 'Perf ';
/** Namespaced so the globally-unique domain index can never collide with real data. */
const DOMAIN_SUFFIX = 'perf-maildrill.test';

/**
 * Refuse to run against anything that is not obviously a local database.
 * A million synthetic subscribers in production would be unrecoverable, and
 * this script is one mistyped DATABASE_URL away from that.
 */
function assertLocal(): void {
  const url = process.env.DATABASE_URL ?? '';
  const local = /@(localhost|127\.0\.0\.1|host\.docker\.internal|postgres|db)[:/]/.test(url);
  if (!local && process.env.PERF_ALLOW_REMOTE !== '1') {
    throw new Error(
      `Refusing to seed perf data into a non-local database (${url.replace(/\/\/[^@]*@/, '//***@')}). ` +
        'Set PERF_ALLOW_REMOTE=1 only if you are certain.',
    );
  }
}

const started = Date.now();
const step = async (label: string, run: () => Promise<unknown>) => {
  const t0 = Date.now();
  await run();
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ${label.padEnd(34)} ${secs.padStart(7)}s`);
};

/** Run `body(from, to)` over 1..total in PERF_BATCH-sized ranges. */
async function inBatches(total: number, body: (from: number, to: number) => Promise<unknown>) {
  for (let from = 1; from <= total; from += CFG.batch) {
    await body(from, Math.min(from + CFG.batch - 1, total));
  }
}

/** The workspace owned by PERF_TENANT_EMAIL — never a new one. */
async function tenantId(): Promise<{ id: string; name: string }> {
  const found = await db.execute<{ id: string; name: string }>(sql`
    select t.id, t.name
    from tenants t
    join memberships m on m.tenant_id = t.id
    join users u on u.id = m.user_id
    where lower(u.email) = ${OWNER_EMAIL.toLowerCase()}
    order by m.role = 'owner' desc, t.created_at
    limit 1
  `);
  const row = found.rows[0];
  if (!row) {
    throw new Error(
      `No workspace found for ${OWNER_EMAIL}. Sign in once so the account exists, ` +
        'or set PERF_TENANT_EMAIL to an address that has one.',
    );
  }
  return row;
}

/** Deletes only rows this seeder generated, matched by their markers. */
async function clearPerfRows(t: string): Promise<void> {
  await db.execute(sql`delete from messages where tenant_id = ${t}::uuid and to_address like ${'perf%@%' + DOMAIN_SUFFIX}`);
  await db.execute(sql`delete from campaigns where tenant_id = ${t}::uuid and name like ${MARK + 'campaign %'}`);
  await db.execute(sql`delete from list_members where tenant_id = ${t}::uuid and list_id in (select id from lists where tenant_id = ${t}::uuid and name like ${MARK + 'list %'})`);
  await db.execute(sql`delete from lists where tenant_id = ${t}::uuid and name like ${MARK + 'list %'}`);
  await db.execute(sql`delete from subscribers where tenant_id = ${t}::uuid and email like ${'perf%@%' + DOMAIN_SUFFIX}`);
  await db.execute(sql`delete from templates where tenant_id = ${t}::uuid and name like ${MARK + 'template %'}`);
  await db.execute(sql`delete from email_domains where tenant_id = ${t}::uuid and domain_name like ${'%' + DOMAIN_SUFFIX}`);
}

async function drop(): Promise<void> {
  const { id, name } = await tenantId();
  console.log(`Removing perf rows from "${name}" — its own data is left alone…`);
  await clearPerfRows(id);
  console.log('Done.');
}

async function seed(): Promise<void> {
  const { id: t, name } = await tenantId();
  console.log(`\nSeeding into "${name}" (${t}) — the workspace for ${OWNER_EMAIL}`);
  console.log(
    `  ${CFG.subscribers.toLocaleString()} subscribers · ${CFG.lists.toLocaleString()} lists · ` +
      `${CFG.domains} domains · ${CFG.templates} templates · ${CFG.campaigns.toLocaleString()} campaigns · ` +
      `${CFG.messages.toLocaleString()} messages\n`,
  );

  // Idempotent, and surgical: only previously generated perf rows go.
  await step('clear previous perf rows', () => clearPerfRows(t));

  await step('domains', () =>
    db.execute(sql`
      insert into email_domains (tenant_id, domain_name)
      select ${t}::uuid, 'p' || g || '.' || ${DOMAIN_SUFFIX}
      from generate_series(1, ${CFG.domains}::int) g
      on conflict do nothing
    `),
  );

  await step('templates', () =>
    db.execute(sql`
      insert into templates (tenant_id, name, channel, subject, preheader, html, text, category, approval_status, language, created_at)
      select ${t}::uuid,
             'Perf template ' || g,
             (array['email','sms','whatsapp','voice'])[1 + (g % 4)]::channel,
             case when g % 4 = 1 then 'Subject {{name}} #' || g end,
             case when g % 4 = 1 then 'Preheader for ' || g end,
             case when g % 4 = 1 then '<h1>Hi {{name}}</h1><p>Body ' || g || '</p><a href="{{unsubscribe}}">Unsubscribe</a>' end,
             'Hi {{name}}, this is perf template ' || g,
             (array['Promotional','Newsletter','Transactional'])[1 + (g % 3)],
             case when g % 4 = 3 then 'approved'::template_approval_status end,
             'en',
             now() - (g % 365) * interval '1 day'
      from generate_series(1, ${CFG.templates}::int) g
    `),
  );

  await step('lists', () =>
    db.execute(sql`
      insert into lists (tenant_id, name, color, tags, channels, gdpr_consent, created_at)
      select ${t}::uuid,
             'Perf list ' || g,
             (array['#4f46e5','#22c55e','#f59e0b','#ef4444','#0891b2'])[1 + (g % 5)],
             to_jsonb(array['perf', 'seg' || (g % 20)]::text[]),
             case g % 4
               when 0 then '["email"]'::jsonb
               when 1 then '["email","sms"]'::jsonb
               when 2 then '["whatsapp","voice"]'::jsonb
               else '["email","sms","whatsapp","voice"]'::jsonb
             end,
             g % 2 = 0,
             now() - (g % 365) * interval '1 day'
      from generate_series(1, ${CFG.lists}::int) g
    `),
  );

  // The big one. Statuses follow a realistic mix: ~92% active, the rest split
  // across unsubscribed / bounced / complained / invalid, so list-health and
  // deliverability queries have something to chew on.
  await step('subscribers', () =>
    inBatches(CFG.subscribers, (from, to) =>
      db.execute(sql`
        insert into subscribers (tenant_id, email, phone, name, status, attributes, created_at)
        select ${t}::uuid,
               'perf' || g || '@' || 'p' || (1 + (g % ${CFG.domains})) || '.' || ${DOMAIN_SUFFIX},
               case when g % 3 = 0 then '+1' || lpad((2000000000 + g % 900000000)::text, 10, '0') end,
               'Perf Subscriber ' || g,
               (case
                  when g % 100 < 92 then 'active'
                  when g % 100 < 96 then 'unsubscribed'
                  when g % 100 < 98 then 'bounced'
                  when g % 100 < 99 then 'complained'
                  else 'invalid'
                end)::subscriber_status,
               jsonb_build_object('company', 'Company ' || (g % 5000), 'plan', (array['free','pro','scale'])[1 + (g % 3)]),
               now() - ((g % 730) * interval '1 day')
        from generate_series(${from}::int, ${to}::int) g
      `),
    ),
  );

  // Memberships spread deterministically so every list gets a share and no
  // (list, subscriber) pair repeats — the table's primary key.
  await step('list members', () =>
    inBatches(CFG.subscribers, (from, to) =>
      db.execute(sql`
        insert into list_members (list_id, subscriber_id, tenant_id, created_at)
        select l.id, s.id, ${t}::uuid, s.created_at
        from (
          select id, created_at, row_number() over (order by email) as rn
          from subscribers
          where tenant_id = ${t}::uuid and email like ${'perf%@%' + DOMAIN_SUFFIX}
          order by email offset ${from - 1}::int limit ${to - from + 1}::int
        ) s
        cross join generate_series(0, ${Math.max(0, CFG.listsPerSubscriber - 1)}::int) k
        join (
          select id, row_number() over (order by name) as ln
          from lists where tenant_id = ${t}::uuid and name like ${MARK + 'list %'}
        ) l on l.ln = 1 + ((s.rn * 7 + k) % ${Math.max(1, CFG.lists)})
        on conflict do nothing
      `),
    ),
  );

  await step('campaigns', () =>
    db.execute(sql`
      insert into campaigns (tenant_id, name, status, channel, list_id, template_id, content, started_at, completed_at, created_at)
      select ${t}::uuid,
             'Perf campaign ' || g,
             (case when g % 20 = 0 then 'draft' when g % 20 = 1 then 'scheduled' when g % 20 = 2 then 'sending' else 'sent' end),
             (array['email','sms','whatsapp','voice'])[1 + (g % 4)]::channel,
             (select id from lists where tenant_id = ${t}::uuid and name like ${MARK + 'list %'}
              order by name offset (g % ${Math.max(1, CFG.lists)}) limit 1),
             (select id from templates where tenant_id = ${t}::uuid and name like ${MARK + 'template %'}
              order by name offset (g % ${Math.max(1, CFG.templates)}) limit 1),
             jsonb_build_object('subject', 'Perf subject ' || g),
             case when g % 20 > 2 then now() - ((g % 365) * interval '1 day') end,
             case when g % 20 > 2 then now() - ((g % 365) * interval '1 day') + interval '20 min' end,
             now() - ((g % 365) * interval '1 day')
      from generate_series(1, ${CFG.campaigns}::int) g
    `),
  );

  // Messages carry the outcome mix the dashboards aggregate: ~88% delivered
  // (a third of those read), ~7% failed, the rest still in flight.
  await step('messages', () =>
    inBatches(CFG.messages, (from, to) =>
      db.execute(sql`
        with sendable as (
          select id, channel, started_at, row_number() over (order by name) as rn
          from campaigns
          where tenant_id = ${t}::uuid and name like ${MARK + 'campaign %'} and started_at is not null
        ),
        sendable_n as (select greatest(count(*), 1) as n from sendable),
        subs as (
          select id, email, row_number() over (order by email) as rn
          from subscribers where tenant_id = ${t}::uuid and email like ${'perf%@%' + DOMAIN_SUFFIX}
        )
        insert into messages (tenant_id, campaign_id, recipient_id, to_address, content, channel, provider, status,
                              queued_at, submitted_at, sent_at, delivered_at, read_at, failed_at, last_error_permanent, created_at)
        select ${t}::uuid, c.id, s.id::text, s.email, '{}'::jsonb, c.channel, 'infobip',
               (case when g % 100 < 30 then 'read' when g % 100 < 88 then 'delivered'
                     when g % 100 < 95 then 'failed' else 'submitted' end)::message_status,
               c.started_at, c.started_at + interval '30 s',
               c.started_at + interval '45 s',
               case when g % 100 < 88 then c.started_at + interval '2 min' end,
               case when g % 100 < 30 then c.started_at + interval '9 min' end,
               case when g % 100 >= 88 and g % 100 < 95 then c.started_at + interval '1 min' end,
               case when g % 100 >= 88 and g % 100 < 95 then g % 3 = 0 end,
               c.started_at
        from generate_series(${from}::int, ${to}::int) g
        join sendable c on c.rn = 1 + (g % (select n from sendable_n))
        join subs s on s.rn = 1 + (g % ${Math.max(1, CFG.subscribers)})
      `),
    ),
  );

  await step('analyze', () => db.execute(sql`analyze`));

  const counts = await db.execute<{ table_name: string; n: string }>(sql`
    select 'subscribers' as table_name, count(*)::text as n from subscribers where tenant_id = ${t}::uuid and email like ${'perf%@%' + DOMAIN_SUFFIX}
    union all select 'lists', count(*)::text from lists where tenant_id = ${t}::uuid and name like ${MARK + 'list %'}
    union all select 'list_members', count(*)::text from list_members lm where lm.tenant_id = ${t}::uuid and lm.list_id in (select id from lists where tenant_id = ${t}::uuid and name like ${MARK + 'list %'})
    union all select 'email_domains', count(*)::text from email_domains where tenant_id = ${t}::uuid and domain_name like ${'%' + DOMAIN_SUFFIX}
    union all select 'templates', count(*)::text from templates where tenant_id = ${t}::uuid and name like ${MARK + 'template %'}
    union all select 'campaigns', count(*)::text from campaigns where tenant_id = ${t}::uuid and name like ${MARK + 'campaign %'}
    union all select 'messages', count(*)::text from messages where tenant_id = ${t}::uuid and to_address like ${'perf%@%' + DOMAIN_SUFFIX}
  `);
  console.log('\nSeeded:');
  for (const r of counts.rows) console.log(`  ${r.table_name.padEnd(14)} ${Number(r.n).toLocaleString().padStart(12)}`);
  console.log(
    `\nTotal ${((Date.now() - started) / 1000).toFixed(1)}s. Counts above are perf rows only; ` +
      `"${name}" keeps everything it already had.\n`,
  );
}

async function main() {
  assertLocal();
  if (process.argv.includes('--drop')) await drop();
  else await seed();
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
