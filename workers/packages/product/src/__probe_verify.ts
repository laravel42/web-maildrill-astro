/* probe: new paginated board vs the old whole-tenant JS/SQL semantics */
import { db, lists } from '@maildrill/database';
import * as P from './index';
import { sql } from 'drizzle-orm';

const T = '76b963e5-4c62-4615-9d25-d8747baa118b';

// Walk every page with the cursor-free offset path and collect all rows.
const all: any[] = [];
for (let page = 1; ; page++) {
  const rows = await P.listListsPage(T, { limit: 51, offset: (page - 1) * 50 });
  all.push(...rows.slice(0, 50));
  if (rows.length <= 50) break;
}
console.log('paged rows:', all.length, 'unique:', new Set(all.map((r) => r.id)).size);

const [{ n }] = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(lists)
  .where(sql`tenant_id = ${T}`);
console.log('lists in db:', n);

// Independent SQL replicating the OLD semantics, per list.
const expected = await db.execute(sql`
  with wk as (select now() as n),
  mem as (
    select lm.list_id,
      count(*)::int as member_count,
      count(*) filter (where s.status = 'active')::int as active_member_count,
      count(*) filter (where lm.created_at > now() - interval '7 days')::int as added_last7,
      count(*) filter (where lm.created_at > now() - interval '14 days' and lm.created_at <= now() - interval '7 days')::int as added_prev7
    from list_members lm join subscribers s on s.id = lm.subscriber_id
    where lm.tenant_id = ${T} group by lm.list_id
  ),
  out2 as (
    select c.list_id,
      count(*) filter (where m.status in ('delivered','read'))::int as delivered,
      count(*) filter (where m.status in ('delivered','read') and m.channel in ('email','whatsapp'))::int as tracked,
      count(*) filter (where m.status = 'read')::int as opened
    from messages m join campaigns c on m.campaign_id = c.id
    where m.tenant_id = ${T} group by c.list_id
  ),
  clk as (
    select c.list_id, count(distinct e.message_id)::int as clicked
    from message_events e join messages m on e.message_id = m.id join campaigns c on m.campaign_id = c.id
    where m.tenant_id = ${T} and e.event_type = 'click' group by c.list_id
  )
  select l.id,
    coalesce(mem.member_count,0) member_count, coalesce(mem.active_member_count,0) active_member_count,
    coalesce(mem.added_last7,0) added_last7, coalesce(mem.added_prev7,0) added_prev7,
    coalesce(out2.delivered,0) delivered, coalesce(out2.tracked,0) tracked,
    coalesce(out2.opened,0) opened, coalesce(clk.clicked,0) clicked
  from lists l
  left join mem on mem.list_id = l.id
  left join out2 on out2.list_id = l.id
  left join clk on clk.list_id = l.id
  where l.tenant_id = ${T}
`);

const exp = new Map((expected as any).rows.map((r: any) => [r.id, r]));
const got = new Map(all.map((r) => [r.id, r]));
let diffs = 0, missing = 0;
const fields: [string, string][] = [
  ['memberCount', 'member_count'], ['activeMemberCount', 'active_member_count'],
  ['addedLast7', 'added_last7'], ['addedPrev7', 'added_prev7'],
  ['delivered', 'delivered'], ['trackedDelivered', 'tracked'],
  ['opened', 'opened'], ['clicked', 'clicked'],
];
for (const [id, e] of exp) {
  const g = got.get(id as string);
  if (!g) { missing++; continue; }
  for (const [gk, ek] of fields) {
    if (Number(g[gk]) !== Number((e as any)[ek])) {
      if (diffs < 8) console.log('DIFF', id, gk, 'api', g[gk], 'sql', (e as any)[ek]);
      diffs++;
    }
  }
}
console.log('expected rows', exp.size, 'missing from api', missing, 'field diffs', diffs);

// trend sanity: monotone non-decreasing, last point <= memberCount+slack
let bad = 0;
for (const r of all) {
  for (let i = 1; i < r.trend.length; i++) if (r.trend[i] < r.trend[i - 1]) bad++;
}
console.log('non-monotone trend points:', bad);

// zero-member list present?
const zero = all.filter((r) => r.memberCount === 0);
console.log('zero-member lists returned:', zero.length, zero.slice(0, 2).map((z) => z.name));
process.exit(0);
