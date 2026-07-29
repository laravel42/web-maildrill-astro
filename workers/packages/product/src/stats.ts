import { and, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { campaigns, db, lists, messageEvents, messages, subscribers } from '@maildrill/database';
import type { Channel } from '@maildrill/domain';
import { createLogger } from '@maildrill/observability';
import { byChannelFromPostHog, dailyActivityFromPostHog } from './posthog-stats';
import { clamp } from './rules';

const log = createLogger({ component: 'stats' });

/**
 * Workspace counters for the dashboard.
 *
 * Engagement rates are deliberately absent rather than zero: no provider open
 * or click events are normalized yet, so any number here would be invented.
 * Callers render "—" for what isn't measured.
 */
export interface ChannelBreakdown {
  channel: string;
  sent: number;
  delivered: number;
  failed: number;
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
 */
function preferRicherSource<T extends { sent: number }>(
  fromPh: T[] | null | undefined,
  fromPg: T[],
): T[] {
  if (!fromPh) return fromPg;
  return totalSent(fromPh) >= totalSent(fromPg) ? fromPh : fromPg;
}

async function byChannelFromPostgres(
  tenantId: string,
  since?: Date,
): Promise<ChannelBreakdown[]> {
  const conds = [eq(messages.tenantId, tenantId)];
  if (since) conds.push(gte(messages.createdAt, since));

  const channelRows = await db
    .select({
      channel: messages.channel,
      sent: countOf,
      delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`,
      failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')::int`,
    })
    .from(messages)
    .where(and(...conds))
    .groupBy(messages.channel);

  return channelRows.map((r) => ({
    channel: r.channel,
    sent: Number(r.sent),
    delivered: Number(r.delivered),
    failed: Number(r.failed),
  }));
}

/**
 * Per-channel send/delivery/fail counts for the last `days` days (zero channels
 * omitted). Used by the dashboard range selector and analytics.
 *
 * PostHog wins only when its volume covers the window; otherwise Postgres
 * (message `createdAt`) so timespans reflect historical sends, not just recent DLRs.
 */
export async function channelBreakdown(
  tenantId: string,
  days = 30,
): Promise<ChannelBreakdown[]> {
  const span = clamp(days, 1, 365);
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (span - 1));

  const fromPg = await byChannelFromPostgres(tenantId, since);

  if (config.posthog.statsEnabled) {
    try {
      const fromPh = await byChannelFromPostHog(tenantId, since);
      return preferRicherSource(fromPh, fromPg);
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
     enough to cover the dashboard's 12-month timespan selector). */
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
    // Rates divide by tracked-channel deliveries only (email, WhatsApp);
    // weeks that only delivered SMS/voice have no measurable rate.
    const delivered = Number(w.trackedDelivered);
    if (delivered <= 0) continue;
    openRateTrend.push((Number(w.opened) / delivered) * 100);
    clickRateTrend.push(((clicksByWeek.get(w.week) ?? 0) / delivered) * 100);
  }

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
}

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
      delivered: sql<number>`count(*) filter (where ${messages.status} = 'delivered')::int`,
      failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')::int`,
    })
    .from(messages)
    .where(and(...conds))
    .groupBy(sql`date_trunc('day', ${messages.createdAt})`)
    .orderBy(sql`date_trunc('day', ${messages.createdAt})`);

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
      return preferRicherSource(fromPh, fromPg);
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
}

/**
 * Recent workspace happenings for the dashboard feed — campaign sends,
 * sign-ups, and unsubscribes — merged newest-first. Every entry is a real
 * row or provider event; nothing synthesized.
 */
export async function activityFeed(tenantId: string, limit = 16): Promise<FeedItem[]> {
  const [sentCampaigns, newSubs, unsubEvents] = await Promise.all([
    db
      .select({ name: campaigns.name, channel: campaigns.channel, at: campaigns.completedAt })
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
      })),
    ...newSubs.map((s) => ({
      type: 'subscriber_added' as const,
      title: `${s.name ?? s.email} subscribed`,
      detail: null,
      at: s.at,
    })),
    ...unsubEvents
      .filter((u) => u.at)
      .map((u) => ({
        type: 'unsubscribed' as const,
        title: `${u.name ?? u.email ?? 'A subscriber'} unsubscribed`,
        detail: null,
        at: u.at!,
      })),
  ];
  return items.sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, limit);
}
