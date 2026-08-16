import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { campaigns, db, lists, messageEvents, messages, subscribers } from '@maildrill/database';
import type { Channel } from '@maildrill/domain';
import { createLogger } from '@maildrill/observability';
import { byChannelFromPostHog, dailyActivityFromPostHog } from './posthog-stats';
import { clamp } from './rules';

const log = createLogger({ component: 'stats' });

/**
 * Per-channel delivery and engagement counts.
 *
 * Engagement comes from provider receipts: `opened` is messages with a
 * read/seen report, `clicked` is messages with at least one click event.
 * Only email and WhatsApp can produce them — SMS/voice rows stay at zero,
 * and callers must not fold those into rate denominators.
 */
export interface ChannelBreakdown {
  channel: string;
  sent: number;
  delivered: number;
  failed: number;
  opened: number;
  clicked: number;
}

export interface WorkspaceSummary {
  subscribers: { total: number; active: number };
  lists: number;
  campaigns: { total: number; sent: number };
  messages: {
    total: number;
    delivered: number;
    /**
     * Deliveries on channels with engagement tracking (email, WhatsApp) — the
     * open/click rate denominator. SMS and voice deliveries can never produce
     * an open, so counting them would dilute the rate.
     */
    trackedDelivered: number;
    failed: number;
    sentToday: number;
    /** Messages with a read/seen receipt, and with at least one click event. */
    opened: number;
    clicked: number;
  };
  byChannel: ChannelBreakdown[];
  /** Weekly series for the dashboard KPI sparklines (52 weeks), oldest → newest. */
  trends: {
    subscribers: number[];
    lists: number[];
    campaigns: number[];
    openRate: number[];
    clickRate: number[];
  };
}

const countOf = sql<number>`count(*)::int`;

function totalSent(rows: ReadonlyArray<{ sent: number }>): number {
  return rows.reduce((n, r) => n + r.sent, 0);
}

/**
 * Prefer PostHog when it has at least as much volume as Postgres in the
 * window (live DLRs caught up). Otherwise use Postgres so seeded / historical
 * message rows still drive range-scoped charts when HogQL only has recent events.
 *
 * The two sources do not define `failed` identically: Postgres counts
 * `status = 'failed'`, HogQL counts `FAILED_STATUS_GROUPS`, which also includes
 * EXPIRED and REJECTED. So whichever source wins also silently decides what the
 * word means on the chart. Postgres wins at every range on the seeded 1M-message
 * tenant; a quiet tenant whose PostHog volume catches up flips the definition
 * with no visible change on screen.
 */
function preferRicherSource<T extends { sent: number }>(
  fromPh: T[] | null | undefined,
  fromPg: T[],
): T[] {
  if (!fromPh) return fromPg;
  return totalSent(fromPh) >= totalSent(fromPg) ? fromPh : fromPg;
}

/**
 * Per-channel outcome counts, in SQL, over the FULL set — never a page.
 *
 * Source: `messages` grouped by `channel`, scoped to the tenant, plus a second
 * pass over `message_events` for clicks (an event, not a status). `since`, when
 * given, windows on `messages.created_at` — a message belongs to the day it was
 * created rather than the day its receipt landed, and clicks are bucketed the
 * same way so the delivery and click series share an x-axis.
 *
 * `delivered` deliberately counts `delivered` + `read`: a read message was
 * delivered, and counting only `status = 'delivered'` undercounts as receipts
 * arrive, which pushes any opened/delivered rate past 100%.
 *
 * `opened` has no channel filter — it is reads on every channel. That is only
 * safe because the caller pairs it per-channel; folding it into a cross-channel
 * rate is the defect flagged in `workspaceSummary` below.
 *
 * KNOWN DEFECT (audit #6): `failed` here means `status = 'failed'` alone, while
 * `messageCounters` (campaign-crud), the list detail rollup and the campaigns
 * board all count `failed | cancelled | expired`. `expired` is a terminal
 * non-delivery, so this definition under-reports and the product carries two
 * incompatible meanings of the same word. On the seeded tenant, 30 days: voice
 * renders 0 failures against 1,176 expired calls; email renders 8 against 13.
 * Analytics and the dashboard read this one.
 */
async function byChannelFromPostgres(tenantId: string, since?: Date): Promise<ChannelBreakdown[]> {
  const conds = [eq(messages.tenantId, tenantId)];
  if (since) conds.push(gte(messages.createdAt, since));

  // Clicks attribute to the message's send window (createdAt), matching how
  // delivered/opened attach to the send rather than to when the receipt landed.
  const clickConds = [eq(messages.tenantId, tenantId), eq(messageEvents.eventType, 'click')];
  if (since) clickConds.push(gte(messages.createdAt, since));

  const [channelRows, clickRows] = await Promise.all([
    db
      .select({
        channel: messages.channel,
        sent: countOf,
        delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`,
        failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')::int`,
        opened: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`,
      })
      .from(messages)
      .where(and(...conds))
      .groupBy(messages.channel),
    db
      .select({
        channel: messages.channel,
        clicked: sql<number>`count(distinct ${messageEvents.messageId})::int`,
      })
      .from(messageEvents)
      .innerJoin(messages, eq(messageEvents.messageId, messages.id))
      .where(and(...clickConds))
      .groupBy(messages.channel),
  ]);

  const clicksBy = new Map(clickRows.map((r) => [r.channel, Number(r.clicked)]));
  return channelRows.map((r) => ({
    channel: r.channel,
    sent: Number(r.sent),
    delivered: Number(r.delivered),
    failed: Number(r.failed),
    opened: Number(r.opened),
    clicked: clicksBy.get(r.channel) ?? 0,
  }));
}

/**
 * Per-channel send/delivery/fail counts for the last `days` days (zero channels
 * omitted). Used by the dashboard range selector and analytics.
 *
 * PostHog wins only when its volume covers the window; otherwise Postgres
 * (message `createdAt`) so timespans reflect historical sends, not just recent DLRs.
 */
export async function channelBreakdown(tenantId: string, days = 30): Promise<ChannelBreakdown[]> {
  const span = clamp(days, 1, 365);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (span - 1));

  const fromPg = await byChannelFromPostgres(tenantId, since);

  if (config.posthog.statsEnabled) {
    try {
      const fromPh = await byChannelFromPostHog(tenantId, since);
      const rows = preferRicherSource(fromPh, fromPg);
      if (rows !== fromPg) {
        // PostHog carries delivery volume only; engagement receipts live in
        // Postgres (the system of record), so graft them onto the winning rows.
        const eng = new Map(fromPg.map((r) => [r.channel, r]));
        return rows.map((r) => ({
          ...r,
          opened: eng.get(r.channel)?.opened ?? 0,
          clicked: eng.get(r.channel)?.clicked ?? 0,
        }));
      }
      return rows;
    } catch (err) {
      log.warn({ err, tenantId }, 'posthog byChannel failed; using postgres');
    }
  }

  return fromPg;
}

export async function workspaceSummary(tenantId: string): Promise<WorkspaceSummary> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [subRows, listRows, campRows, msgRows, todayRows] = await Promise.all([
    db
      .select({
        total: countOf,
        active: sql<number>`count(*) filter (where ${subscribers.status} = 'active')::int`,
      })
      .from(subscribers)
      .where(eq(subscribers.tenantId, tenantId)),
    db.select({ total: countOf }).from(lists).where(eq(lists.tenantId, tenantId)),
    db
      .select({
        total: countOf,
        sent: sql<number>`count(*) filter (where ${campaigns.status} = 'sent')::int`,
      })
      .from(campaigns)
      .where(eq(campaigns.tenantId, tenantId)),
    db
      .select({
        // Whole-workspace message counters, in SQL, over every message the
        // tenant has ever sent. NO DATE WINDOW — this is all-time stock, not a
        // period, and any caller labelling it "this period" is wrong (see
        // AppSettings.tsx, audit #2).
        //
        // `trackedDelivered` narrows to email + whatsapp because those are the
        // only channels whose providers report a read. It is the honest
        // open/click denominator: an SMS delivery can never produce an open, so
        // counting it would dilute the rate toward zero.
        //
        // KNOWN DEFECT (audit #5): `opened` below carries NO channel filter, so
        // it counts reads on every channel while `trackedDelivered` counts
        // deliveries on two. Divide one by the other and the numerator is drawn
        // from a wider set than the denominator. On the seeded tenant that is
        // 300,332 all-channel reads over 140,919 tracked deliveries, and the
        // weekly version of the same pairing below produces rates above 100%.
        total: countOf,
        delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`,
        trackedDelivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read') and ${messages.channel} in ('email', 'whatsapp'))::int`,
        opened: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`,
        failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')::int`,
      })
      .from(messages)
      .where(eq(messages.tenantId, tenantId)),
    // "Sent today" counts messages that actually left, not drafts created today.
    db
      .select({ total: countOf })
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), gte(messages.submittedAt, startOfToday))),
  ]);

  /* Weekly engagement + growth series for the KPI sparklines (52 weeks —
     enough to cover the dashboard's 12-month timespan selector).
     
     Engagement weeks bucket on `messages.sent_at` (the send), clicks on
     `message_events.occurred_at` (the receipt) — the two are joined by week key
     below, so a click that lands in the week after its send is credited to the
     week it happened rather than the week the message left. That asymmetry is
     deliberate for a "click rate this week" reading, and it is why the click
     numerator can exceed its own week's sends on a slow-clicking audience.
     
     Growth series are raw timestamp lists reduced in this process, not in SQL:
     `subscribers.created_at`, `lists.created_at`, and `campaigns.completed_at`
     for sent campaigns only. Full set, one row per record — on the 1M-subscriber
     tenant that is a million Dates crossing the wire to build 52 integers. */
  const TREND_WEEKS = 52;
  const weekOfSent = sql`date_trunc('week', ${messages.sentAt})`;
  const [clickTotalRows, weeklyMsgRows, weeklyClickRows, subDates, listDates, campDates] =
    await Promise.all([
      db
        .select({ clicked: sql<number>`count(distinct ${messageEvents.messageId})::int` })
        .from(messageEvents)
        .innerJoin(messages, eq(messageEvents.messageId, messages.id))
        .where(and(eq(messages.tenantId, tenantId), eq(messageEvents.eventType, 'click'))),
      db
        .select({
          week: sql<string>`${weekOfSent}::text`,
          trackedDelivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read') and ${messages.channel} in ('email', 'whatsapp'))::int`,
          opened: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`,
        })
        .from(messages)
        .where(
          and(
            eq(messages.tenantId, tenantId),
            isNotNull(messages.sentAt),
            gte(messages.sentAt, sql`now() - interval '52 weeks'`),
          ),
        )
        .groupBy(weekOfSent)
        .orderBy(weekOfSent),
      db
        .select({
          week: sql<string>`date_trunc('week', ${messageEvents.occurredAt})::text`,
          clicked: sql<number>`count(distinct ${messageEvents.messageId})::int`,
        })
        .from(messageEvents)
        .innerJoin(messages, eq(messageEvents.messageId, messages.id))
        .where(
          and(
            eq(messages.tenantId, tenantId),
            eq(messageEvents.eventType, 'click'),
            gte(messageEvents.occurredAt, sql`now() - interval '52 weeks'`),
          ),
        )
        .groupBy(sql`date_trunc('week', ${messageEvents.occurredAt})`)
        .orderBy(sql`date_trunc('week', ${messageEvents.occurredAt})`),
      db
        .select({ at: subscribers.createdAt })
        .from(subscribers)
        .where(eq(subscribers.tenantId, tenantId)),
      db.select({ at: lists.createdAt }).from(lists).where(eq(lists.tenantId, tenantId)),
      db
        .select({ at: campaigns.completedAt })
        .from(campaigns)
        .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.status, 'sent'))),
    ]);

  const WEEK = 7 * 86_400_000;
  const now = Date.now();
  /**
   * A cumulative STOCK series: point k is how many records existed by that
   * week's cutoff, not how many were added in it. Consumers that want net adds
   * must difference two points — which `periodNetCompare` in AppDashboard.logic
   * does for the headline, while `weeklySpark` beside it plots these raw
   * cumulative values under that net-adds headline (audit #18: a card reading
   * "9,596" over a line running 962k -> 1,000,229).
   *
   * Computed in this process over the full set of timestamps, not in SQL.
   */
  const cumulative = (dates: (Date | null)[]): number[] => {
    const times = dates.filter((d): d is Date => d != null).map((d) => d.getTime());
    return Array.from({ length: TREND_WEEKS }, (_, k) => {
      const cutoff = now - (TREND_WEEKS - 1 - k) * WEEK;
      return times.filter((t) => t <= cutoff).length;
    });
  };
  const clicksByWeek = new Map(weeklyClickRows.map((r) => [r.week, Number(r.clicked)]));
  const openRateTrend: number[] = [];
  const clickRateTrend: number[] = [];
  for (const w of weeklyMsgRows) {
    /* Denominator: tracked-channel deliveries only (email, WhatsApp), because
       a week that only delivered SMS and voice has no measurable open rate at
       all — a 0% there would read as "nobody engaged" rather than "nothing was
       measured".

       KNOWN DEFECT (audit #5): the numerator `w.opened` is reads on EVERY
       channel (see the select above), so this is an all-channel numerator over
       a two-channel denominator. Reproduced on the seeded tenant: week of
       2026-08-03 yields 10,587 / 9,413 = 112.47%, and the week before 57.00%.
       Those feed the dashboard's open-rate sparkline and its delta, so the card
       renders a mathematically impossible spark peak and a delta (-55.5%) that
       is 2.6x the honest -21.07pp.

       Weeks with no tracked delivery are DROPPED, not zero-filled, so the array
       is not week-aligned and a consumer's `slice(-weeks)` can silently reach
       further back than it thinks. Zero such weeks on this tenant today. */
    const delivered = Number(w.trackedDelivered);
    if (delivered <= 0) continue;
    openRateTrend.push((Number(w.opened) / delivered) * 100);
    clickRateTrend.push(((clicksByWeek.get(w.week) ?? 0) / delivered) * 100);
  }

  /* KNOWN DEFECT (audit #1): unlike `channelBreakdown` above, this swap is
     UNGUARDED — any non-null PostHog result replaces Postgres wholesale, with
     no `preferRicherSource` volume check and no engagement graft. The two
     sources are not comparable in scale here: PostHog holds only the delivery
     reports it has actually received (48 events for this tenant), Postgres
     holds every message row (1,001,068). Whether the swap happens is decided by
     whether HogQL is inside a 429 cooldown, which means `summary.byChannel` can
     swing ~20,850x between two consecutive requests with nothing else changing.

     `byChannel` is consumed only by the Settings usage ledger
     (settings.astro -> AppSettings.tsx), where it is multiplied by per-message
     rates — so the swing lands on money: ~$12,246 from Postgres vs ~$0.63 from
     PostHog. Nothing else on the product reads this field. */
  let byChannel = await byChannelFromPostgres(tenantId);
  if (config.posthog.statsEnabled) {
    try {
      const fromPh = await byChannelFromPostHog(tenantId);
      if (fromPh) byChannel = fromPh;
    } catch (err) {
      log.warn({ err, tenantId }, 'posthog byChannel failed; using postgres');
    }
  }

  return {
    subscribers: {
      total: Number(subRows[0]?.total ?? 0),
      active: Number(subRows[0]?.active ?? 0),
    },
    lists: Number(listRows[0]?.total ?? 0),
    campaigns: {
      total: Number(campRows[0]?.total ?? 0),
      sent: Number(campRows[0]?.sent ?? 0),
    },
    messages: {
      total: Number(msgRows[0]?.total ?? 0),
      delivered: Number(msgRows[0]?.delivered ?? 0),
      trackedDelivered: Number(msgRows[0]?.trackedDelivered ?? 0),
      failed: Number(msgRows[0]?.failed ?? 0),
      sentToday: Number(todayRows[0]?.total ?? 0),
      opened: Number(msgRows[0]?.opened ?? 0),
      clicked: Number(clickTotalRows[0]?.clicked ?? 0),
    },
    byChannel,
    trends: {
      subscribers: cumulative(subDates.map((r) => r.at)),
      lists: cumulative(listDates.map((r) => r.at)),
      campaigns: cumulative(campDates.map((r) => r.at)),
      openRate: openRateTrend,
      clickRate: clickRateTrend,
    },
  };
}

/** One day of send activity. Opens/clicks are absent for the reason above. */
export interface DailyPoint {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
  /**
   * Engagement receipts, attributed to the day the message was sent rather
   * than the day the receipt landed — so a chart lines up with the delivery
   * series above it. Zero on SMS and voice, which cannot report either.
   */
  opened: number;
  clicked: number;
  /**
   * Spam complaints. Not a subset of `failed`: the message was delivered and
   * then reported, which is why it is counted separately rather than folded
   * into the failure bucket.
   */
  complained: number;
  /** Opt-outs recorded against the send. Every channel can produce these. */
  unsubscribed: number;
  /**
   * Voice only: total reconciled talk time in seconds for the day. Zero
   * elsewhere — no other channel has a duration.
   */
  voiceSeconds: number;
}

/**
 * One row per calendar day, in SQL, over the FULL set of the tenant's messages
 * in the window — never a page, and never sampled.
 *
 * Every series buckets on `messages.created_at`, including the three event
 * series (click, complaint, unsubscribed), which are counted as DISTINCT
 * message ids rather than raw events: the question the chart answers is "how
 * many sends produced this outcome", not "how many times did it fire". So a
 * recipient who clicked four links is one click on this chart and four rows in
 * `message_events`.
 *
 * `complained` is deliberately not part of `failed`: the message was delivered
 * and then reported, so adding the two would count one send twice and overstate
 * the failure rate.
 *
 * KNOWN DEFECT (audit #6): `failed` is `status = 'failed'` alone — `expired`
 * and `cancelled` fall into neither this nor `delivered`, so they vanish from
 * the chart entirely. This is what renders Voice "Failed 0.0% / 0" on the
 * analytics screen over 1,176 expired calls, and hides 12,946 expired email
 * messages from the 12-month email view (6.2% shown vs 11.73% true).
 *
 * KNOWN DEFECT (audit #20): `voiceSeconds` sums a column populated on 0 of the
 * tenant's 294,204 voice messages, so the talk-time card reads a measured "0s"
 * for something that is simply not recorded.
 */
async function dailyActivityFromPostgres(
  tenantId: string,
  span: number,
  since: Date,
  channel?: Channel,
): Promise<DailyPoint[]> {
  const conds = [eq(messages.tenantId, tenantId), gte(messages.createdAt, since)];
  if (channel) conds.push(eq(messages.channel, channel));

  const rows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${messages.createdAt}), 'YYYY-MM-DD')`,
      sent: countOf,
      // Same as byChannel / campaign counters: a read message was delivered.
      // Counting only status='delivered' undercounts once opens land and can
      // push open rate (opened / delivered) over 100%.
      delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`,
      failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')::int`,
      opened: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`,
      voiceSeconds: sql<number>`coalesce(sum(${messages.voiceSeconds}), 0)::int`,
    })
    .from(messages)
    .where(and(...conds))
    .groupBy(sql`date_trunc('day', ${messages.createdAt})`)
    .orderBy(sql`date_trunc('day', ${messages.createdAt})`);

  // Clicks live on message_events, so they need their own pass: one row per
  // message that produced at least one click, bucketed by the send day.
  const clickRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${messages.createdAt}), 'YYYY-MM-DD')`,
      clicked: sql<number>`count(distinct ${messageEvents.messageId})::int`,
    })
    .from(messageEvents)
    .innerJoin(messages, eq(messageEvents.messageId, messages.id))
    .where(and(...conds, eq(messageEvents.eventType, 'click')))
    .groupBy(sql`date_trunc('day', ${messages.createdAt})`);
  const clicksBy = new Map(clickRows.map((r) => [r.day, Number(r.clicked)]));

  const complaintRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${messages.createdAt}), 'YYYY-MM-DD')`,
      complained: sql<number>`count(distinct ${messageEvents.messageId})::int`,
    })
    .from(messageEvents)
    .innerJoin(messages, eq(messageEvents.messageId, messages.id))
    .where(and(...conds, eq(messageEvents.eventType, 'complaint')))
    .groupBy(sql`date_trunc('day', ${messages.createdAt})`);
  const complaintsBy = new Map(complaintRows.map((r) => [r.day, Number(r.complained)]));

  const unsubRows = await db
    .select({
      day: sql<string>`to_char(date_trunc('day', ${messages.createdAt}), 'YYYY-MM-DD')`,
      unsubscribed: sql<number>`count(distinct ${messageEvents.messageId})::int`,
    })
    .from(messageEvents)
    .innerJoin(messages, eq(messageEvents.messageId, messages.id))
    .where(and(...conds, eq(messageEvents.eventType, 'unsubscribed')))
    .groupBy(sql`date_trunc('day', ${messages.createdAt})`);
  const unsubsBy = new Map(unsubRows.map((r) => [r.day, Number(r.unsubscribed)]));

  /* Zero-fill so the series is continuous — a chart must not close the gap over
     a quiet day and imply the days either side are adjacent.

     LATENT DEFECT: the group-by key above is `date_trunc('day', created_at)`
     rendered in the DATABASE's zone, while the key matched against it here is
     `toISOString().slice(0,10)` on a LOCAL-midnight Date, i.e. the UTC date. On
     this host both are America/Mexico_City so they agree; on any UTC+ host every
     lookup misses by a day and the whole chart zero-fills to nothing. Same shape
     in `zeroFillDailyActivity` (posthog-stats.ts). */
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const out: DailyPoint[] = [];
  for (let i = 0; i < span; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const hit = byDay.get(key);
    out.push({
      date: key,
      sent: Number(hit?.sent ?? 0),
      delivered: Number(hit?.delivered ?? 0),
      failed: Number(hit?.failed ?? 0),
      opened: Number(hit?.opened ?? 0),
      clicked: clicksBy.get(key) ?? 0,
      complained: complaintsBy.get(key) ?? 0,
      unsubscribed: unsubsBy.get(key) ?? 0,
      voiceSeconds: Number(hit?.voiceSeconds ?? 0),
    });
  }
  return out;
}

/**
 * Daily send activity for the last `days` days, zero-filled so the series is
 * continuous — a chart must not silently close the gap over a quiet day.
 *
 * PostHog HogQL wins when its volume covers the window; otherwise Postgres
 * message rows so range selectors show historical activity, not only recent DLRs.
 */
/**
 * Delivery counts may come from HogQL, but engagement never does: the delivery
 * reports PostHog receives carry no open or click data. Those receipts are
 * reconciled into Postgres by the campaign-delivery poller, so they are lifted
 * from the Postgres series and merged onto whichever source won — otherwise an
 * engagement chart silently reads zero wherever PostHog is the richer source.
 */
function withEngagementFrom(series: DailyPoint[], pg: DailyPoint[]): DailyPoint[] {
  const byDay = new Map(pg.map((p) => [p.date, p]));
  return series.map((p) => ({
    ...p,
    opened: byDay.get(p.date)?.opened ?? p.opened,
    clicked: byDay.get(p.date)?.clicked ?? p.clicked,
    complained: byDay.get(p.date)?.complained ?? p.complained,
    unsubscribed: byDay.get(p.date)?.unsubscribed ?? p.unsubscribed,
    voiceSeconds: byDay.get(p.date)?.voiceSeconds ?? p.voiceSeconds,
  }));
}

export async function dailyActivity(
  tenantId: string,
  days = 30,
  channel?: Channel,
): Promise<DailyPoint[]> {
  const span = clamp(days, 1, 365);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (span - 1));

  const fromPg = await dailyActivityFromPostgres(tenantId, span, since, channel);

  if (config.posthog.statsEnabled) {
    try {
      const fromPh = await dailyActivityFromPostHog(tenantId, span, since, channel);
      return withEngagementFrom(preferRicherSource(fromPh, fromPg), fromPg);
    } catch (err) {
      log.warn({ err, tenantId }, 'posthog dailyActivity failed; using postgres');
    }
  }

  return fromPg;
}

export interface FeedItem {
  type: 'campaign_sent' | 'subscriber_added' | 'unsubscribed';
  title: string;
  detail: string | null;
  at: Date;
  /** Deep-link target for campaign_sent entries. */
  campaignId: string | null;
}

/**
 * Recent workspace happenings for the dashboard feed — campaign sends,
 * sign-ups, and unsubscribes — merged newest-first. Every entry is a real
 * row or provider event; nothing synthesized.
 *
 * A BOUNDED SAMPLE by construction, and correct as one: `limit` newest of each
 * of the three sources, merged and cut to `limit` again. It is a feed, not a
 * count — nothing here is ever summed or divided, so the cap costs nothing.
 *
 * Campaign sends are ordered by `completed_at`, which is the moment the send
 * actually finished. Worth noting against the "Recent campaigns" strip beside
 * this feed on the same screen, which orders by `updated_at` instead and so
 * disagrees about which campaigns are the latest (audit #10).
 */
export async function activityFeed(tenantId: string, limit = 16): Promise<FeedItem[]> {
  const [sentCampaigns, newSubs, unsubEvents] = await Promise.all([
    db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        channel: campaigns.channel,
        at: campaigns.completedAt,
      })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.tenantId, tenantId),
          eq(campaigns.status, 'sent'),
          isNotNull(campaigns.completedAt),
        ),
      )
      .orderBy(desc(campaigns.completedAt))
      .limit(limit),
    db
      .select({ name: subscribers.name, email: subscribers.email, at: subscribers.createdAt })
      .from(subscribers)
      .where(eq(subscribers.tenantId, tenantId))
      .orderBy(desc(subscribers.createdAt))
      .limit(limit),
    db
      .select({
        at: messageEvents.occurredAt,
        name: subscribers.name,
        email: subscribers.email,
      })
      .from(messageEvents)
      .innerJoin(messages, eq(messageEvents.messageId, messages.id))
      .leftJoin(
        subscribers,
        sql`${subscribers.id}::text = ${messages.recipientId} and ${subscribers.tenantId} = ${messages.tenantId}`,
      )
      .where(and(eq(messages.tenantId, tenantId), eq(messageEvents.eventType, 'unsubscribed')))
      .orderBy(desc(messageEvents.occurredAt))
      .limit(limit),
  ]);

  const items: FeedItem[] = [
    ...sentCampaigns
      .filter((c) => c.at)
      .map((c) => ({
        type: 'campaign_sent' as const,
        title: `“${c.name}” was sent`,
        detail: c.channel,
        at: c.at!,
        campaignId: c.id,
      })),
    ...newSubs.map((s) => ({
      type: 'subscriber_added' as const,
      title: `${s.name ?? s.email} subscribed`,
      detail: null,
      at: s.at,
      campaignId: null,
    })),
    ...unsubEvents
      .filter((u) => u.at)
      .map((u) => ({
        type: 'unsubscribed' as const,
        title: `${u.name ?? u.email ?? 'A subscriber'} unsubscribed`,
        detail: null,
        at: u.at!,
        campaignId: null,
      })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
