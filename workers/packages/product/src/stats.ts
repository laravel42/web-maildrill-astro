import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { PgColumn } from 'drizzle-orm/pg-core';
import { config } from '@maildrill/config';
import { campaigns, db, lists, messageEvents, messages, subscribers } from '@maildrill/database';
import type { Channel } from '@maildrill/domain';
import { createLogger } from '@maildrill/observability';
import { FAILED_STATUSES } from './message-status';
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
    /**
     * Read receipts and clicked messages on the TRACKED channels only — the
     * same email + WhatsApp set as `trackedDelivered`, so `opened /
     * trackedDelivered` is a rate whose two sides are drawn from one set.
     *
     * Narrowing these is what the dashboard's open-rate card needed: reads
     * exist on `sms` and `voice` rows in the data even though neither provider
     * can report one, and counting them made the card's context line
     * (300,332) 2.13x the numerator of the rate printed above it (140,919).
     */
    opened: number;
    clicked: number;
  };
  byChannel: ChannelBreakdown[];
  /**
   * Daily series for the dashboard KPI cards and their sparklines — exactly
   * `TREND_DAYS` entries, oldest → newest, zero-filled and day-aligned so
   * entry `k` is always the same calendar day for every series here.
   *
   * DAILY, not weekly, and RAW COUNTS, not cumulative stock or precomputed
   * rates. Both of those are deliberate:
   *
   *  - Weekly buckets could not express the range chips. The dashboard offers
   *    7 / 30 / 90 days and 12 months, and the browser rounded each to whole
   *    weeks (`round(days / 7)`), so "30 days" was really 28 and "12 months"
   *    357 — while the "Sent (30 days)" card beside them sliced a true 30 days
   *    of the daily activity series. One chip, two windows: 38,387 subscribers
   *    against a true 41,129. At daily resolution every card slices exactly
   *    the days its chip names.
   *  - Per-day adds, rather than a running total, are the quantity the cards
   *    actually print. The headline is net adds in the window and the spark
   *    beneath it plotted the cumulative stock, so a card read "9,596" over a
   *    line climbing 962,000 -> 1,000,229 — two subjects on one card.
   *  - Engagement ships as its numerator and denominator rather than as a
   *    rate, so the browser can divide sums over the window it wants. A mean
   *    of daily rates is not the window's rate, and only the summed form can
   *    match the headline, which is Σ opened / Σ delivered from
   *    `channelBreakdown` over the same window and the same two channels.
   */
  trends: {
    /** Subscribers created that day. */
    subscribers: number[];
    /** Lists created that day. */
    lists: number[];
    /** Campaigns that finished sending that day (`completed_at`, status sent). */
    campaigns: number[];
    /**
     * Engagement inputs, tracked channels only (email + WhatsApp) and bucketed
     * on `messages.created_at` — the same column and the same channel set
     * `channelBreakdown` uses, so a window slice of these reproduces the card's
     * headline exactly instead of approximating it.
     */
    trackedDelivered: number[];
    opened: number[];
    clicked: number[];
  };
}

/**
 * Length of every `trends` series: one year of daily points.
 *
 * Sized to the widest range chip (12 months). A card's delta compares its
 * window against the one before it, so a 12-month delta would need two years
 * here; it renders "—" instead, which is what it did at weekly resolution too.
 */
const TREND_DAYS = 365;

const countOf = sql<number>`count(*)::int`;

function totalSent(rows: ReadonlyArray<{ sent: number }>): number {
  return rows.reduce((n, r) => n + r.sent, 0);
}

/**
 * Prefer PostHog when it has at least as much volume as Postgres in the
 * window (live DLRs caught up). Otherwise use Postgres so seeded / historical
 * message rows still drive range-scoped charts when HogQL only has recent events.
 *
 * The two sources now define `failed` identically, which is what makes the swap
 * safe: Postgres counts `FAILED_STATUSES` (failed + expired) and HogQL counts
 * `FAILED_STATUS_GROUPS` (UNDELIVERABLE + REJECTED -> failed, EXPIRED ->
 * expired) — the same set either way. Whichever source wins, the word on the
 * chart means the same thing. Before this, Postgres counted `status = 'failed'`
 * alone and a quiet tenant whose PostHog volume caught up flipped the
 * definition with nothing on screen to say so.
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
 * `opened` carries no channel predicate because the GROUP BY already supplies
 * one: every row here is a single channel's reads beside that same channel's
 * deliveries. Callers must keep them paired — summing `opened` across all four
 * rows and dividing by the two tracked channels' deliveries is the mismatch
 * that put a 112.47% point on the dashboard's open-rate spark.
 *
 * `failed` is `FAILED_STATUSES` — failed + expired, the one definition shared
 * with the campaign counters, the list rollup and HogQL (see message-status.ts).
 * `expired` is a terminal non-delivery: the provider accepted the message and
 * then gave up, so the send failed. Counting `status = 'failed'` alone used to
 * halve every failure rate on this screen — 30 days on the seeded tenant: voice
 * 0 against 1,176 expired calls, WhatsApp 1,178 against a true 2,354.
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
        failed: sql<number>`count(*) filter (where ${messages.status} in ${FAILED_STATUSES})::int`,
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
        // `opened` carries THE SAME channel predicate, and must: it is the
        // numerator over that denominator, and the dashboard prints it as the
        // context line under the open-rate card. Counted across all four
        // channels it read 300,332 — 2.13x the 140,919 reads the rate above it
        // was actually built from, because `sms` and `voice` rows carry a
        // `read` status neither provider can produce.
        total: countOf,
        delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`,
        trackedDelivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read') and ${messages.channel} in ('email', 'whatsapp'))::int`,
        opened: sql<number>`count(*) filter (where ${messages.status} = 'read' and ${messages.channel} in ('email', 'whatsapp'))::int`,
        // failed + expired — `FAILED_STATUSES`, the one definition (message-status.ts).
        failed: sql<number>`count(*) filter (where ${messages.status} in ${FAILED_STATUSES})::int`,
      })
      .from(messages)
      .where(eq(messages.tenantId, tenantId)),
    // "Sent today" counts messages that actually left, not drafts created today.
    db
      .select({ total: countOf })
      .from(messages)
      .where(and(eq(messages.tenantId, tenantId), gte(messages.submittedAt, startOfToday))),
  ]);

  /* Daily growth + engagement series for the KPI cards (TREND_DAYS days).

     `since` is local midnight TREND_DAYS-1 days back — the same anchor
     `channelBreakdown` and `dailyActivity` compute for their own windows, so
     slicing the last N of these covers exactly the calendar days the "Sent
     (N days)" card beside them covers. That agreement is the whole point: the
     row used to hold two windows at once, because these series were weekly and
     the browser rounded a day-range to the nearest whole number of them.

     Each row carries a DAY INDEX, not a date string: `col::date - since::date`
     is an integer offset whose two sides Postgres renders in one timezone,
     which makes the zero-fill below a plain array write. (The activity
     zero-fill nearby matches a `to_char` day against `toISOString()` instead,
     and empties the entire chart on any UTC+ host; nothing here can drift.)

     All five are aggregates rather than row dumps. The growth series used to
     select every `created_at` the tenant owns — a million Dates across the
     wire, then one full scan of that array per output point — to produce 52
     integers; these produce 365 without leaving Postgres. */
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (TREND_DAYS - 1));
  const dayOf = (col: PgColumn) => sql<number>`(${col}::date - ${since}::timestamptz::date)::int`;
  const subDay = dayOf(subscribers.createdAt);
  const listDay = dayOf(lists.createdAt);
  const campDay = dayOf(campaigns.completedAt);
  const msgDay = dayOf(messages.createdAt);
  /* GROUP BY the select-list ORDINAL, not the expression: `since` is a bound
     parameter, and repeating the fragment binds it a second time, so the two
     copies read `$1` and `$2` and Postgres rejects them as different
     expressions ("column must appear in the GROUP BY clause"). The ordinal
     names the one already in the select list. */
  const firstColumn = sql`1`;
  /* Tracked channels only, everywhere engagement is counted — email and
     WhatsApp are the only two whose providers report a read or a click, and a
     numerator drawn from a wider set than its denominator is what produced
     weekly "open rates" of 112.47%. */
  const trackedChannel = sql`${messages.channel} in ('email', 'whatsapp')`;

  const [clickTotalRows, subDaily, listDaily, campDaily, msgDaily, clickDaily] = await Promise.all([
    db
      .select({ clicked: sql<number>`count(distinct ${messageEvents.messageId})::int` })
      .from(messageEvents)
      .innerJoin(messages, eq(messageEvents.messageId, messages.id))
      .where(
        and(eq(messages.tenantId, tenantId), eq(messageEvents.eventType, 'click'), trackedChannel),
      ),
    db
      .select({ idx: subDay, n: countOf })
      .from(subscribers)
      .where(and(eq(subscribers.tenantId, tenantId), gte(subscribers.createdAt, since)))
      .groupBy(firstColumn),
    db
      .select({ idx: listDay, n: countOf })
      .from(lists)
      .where(and(eq(lists.tenantId, tenantId), gte(lists.createdAt, since)))
      .groupBy(firstColumn),
    // Campaigns are dated by the send that finished, not by the row's creation
    // — the same `completed_at` the activity feed orders by. `gte` also drops
    // the NULLs, which is right: an unsent campaign was added to no day.
    db
      .select({ idx: campDay, n: countOf })
      .from(campaigns)
      .where(
        and(
          eq(campaigns.tenantId, tenantId),
          eq(campaigns.status, 'sent'),
          gte(campaigns.completedAt, since),
        ),
      )
      .groupBy(firstColumn),
    db
      .select({
        idx: msgDay,
        trackedDelivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`,
        opened: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`,
      })
      .from(messages)
      .where(
        and(eq(messages.tenantId, tenantId), trackedChannel, gte(messages.createdAt, since)),
      )
      .groupBy(firstColumn),
    // Clicks bucket on the MESSAGE's day, not the event's, so a click and the
    // delivery it belongs to land in the same slot and their ratio is a rate.
    // Bucketed on `occurred_at` the numerator could outrun its own bucket's
    // sends, which is exactly what the weekly series did.
    db
      .select({
        idx: msgDay,
        n: sql<number>`count(distinct ${messageEvents.messageId})::int`,
      })
      .from(messageEvents)
      .innerJoin(messages, eq(messageEvents.messageId, messages.id))
      .where(
        and(
          eq(messages.tenantId, tenantId),
          eq(messageEvents.eventType, 'click'),
          trackedChannel,
          gte(messages.createdAt, since),
        ),
      )
      .groupBy(firstColumn),
  ]);

  /**
   * Scatter day-indexed rows into a zero-filled `TREND_DAYS` array, oldest →
   * newest. Zero-filled rather than compacted: a quiet day has to hold its
   * slot, or entry `k` stops naming the same date in every series and a
   * consumer's `slice(-days)` reaches further back than the days it asked for.
   */
  const daily = <R extends { idx: number }>(rows: readonly R[], pick: (row: R) => number) => {
    const out = new Array<number>(TREND_DAYS).fill(0);
    for (const row of rows) {
      const i = Number(row.idx);
      if (i >= 0 && i < TREND_DAYS) out[i] = Number(pick(row));
    }
    return out;
  };

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
      subscribers: daily(subDaily, (r) => r.n),
      lists: daily(listDaily, (r) => r.n),
      campaigns: daily(campDaily, (r) => r.n),
      trackedDelivered: daily(msgDaily, (r) => r.trackedDelivered),
      opened: daily(msgDaily, (r) => r.opened),
      clicked: daily(clickDaily, (r) => r.n),
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
 * `failed` is `FAILED_STATUSES` — failed + expired (message-status.ts). An
 * expired send is a terminal non-delivery and belongs on the failure line; when
 * this counted `status = 'failed'` alone, `expired` fell into neither this nor
 * `delivered` and left the chart entirely — Voice read "Failed 0.0% / 0" over
 * 1,176 expired calls and the 12-month email view read 6.2% against 11.73%.
 *
 * `cancelled` is still in neither bucket, and correctly so: it is only
 * reachable before dispatch, so the message was never attempted. It is carried
 * by `sent` (count(*)) the same way a queued message is.
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
      failed: sql<number>`count(*) filter (where ${messages.status} in ${FAILED_STATUSES})::int`,
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
