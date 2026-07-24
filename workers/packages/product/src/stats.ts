import { and, eq, gte, sql } from "drizzle-orm";
import { config } from "@maildrill/config";
import { campaigns, db, lists, messages, subscribers } from "@maildrill/database";
import type { Channel } from "@maildrill/domain";
import { createLogger } from "@maildrill/observability";
import { byChannelFromPostHog, dailyActivityFromPostHog } from "./posthog-stats";
import { clamp } from "./rules";

const log = createLogger({ component: "stats" });

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
  messages: { total: number; delivered: number; failed: number; sentToday: number };
  byChannel: ChannelBreakdown[];
}

const countOf = sql<number>`count(*)::int`;

async function byChannelFromPostgres(tenantId: string): Promise<ChannelBreakdown[]> {
  const channelRows = await db
    .select({
      channel: messages.channel,
      sent: countOf,
      delivered: sql<number>`count(*) filter (where ${messages.status} = 'delivered')::int`,
      failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')::int`,
    })
    .from(messages)
    .where(eq(messages.tenantId, tenantId))
    .groupBy(messages.channel);

  return channelRows.map((r) => ({
    channel: r.channel,
    sent: Number(r.sent),
    delivered: Number(r.delivered),
    failed: Number(r.failed),
  }));
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
        delivered: sql<number>`count(*) filter (where ${messages.status} = 'delivered')::int`,
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

  let byChannel = await byChannelFromPostgres(tenantId);
  if (config.posthog.statsEnabled) {
    try {
      const fromPh = await byChannelFromPostHog(tenantId);
      if (fromPh) byChannel = fromPh;
    } catch (err) {
      log.warn({ err, tenantId }, "posthog byChannel failed; using postgres");
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
      failed: Number(msgRows[0]?.failed ?? 0),
      sentToday: Number(todayRows[0]?.total ?? 0),
    },
    byChannel,
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
 * Prefers PostHog HogQL (`message_delivery_report`) when configured; falls
 * back to Postgres message rows on miss/error.
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

  if (config.posthog.statsEnabled) {
    try {
      const fromPh = await dailyActivityFromPostHog(tenantId, span, since, channel);
      if (fromPh) return fromPh;
    } catch (err) {
      log.warn({ err, tenantId }, "posthog dailyActivity failed; using postgres");
    }
  }

  return dailyActivityFromPostgres(tenantId, span, since, channel);
}
