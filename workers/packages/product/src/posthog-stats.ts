import type { Channel } from '@maildrill/domain';
import {
  cellNumber,
  cellString,
  columnIndex,
  hogqlLiteral,
  runHogQL,
} from '@maildrill/observability';
import type { ChannelBreakdown, DailyPoint } from './stats';

/** Infobip status groups that count as delivery failures on charts. */
export const FAILED_STATUS_GROUPS = ['UNDELIVERABLE', 'EXPIRED', 'REJECTED'] as const;

export interface ActivityRow {
  day: string;
  sent: number;
  delivered: number;
  failed: number;
}

/**
 * Zero-fill HogQL activity rows into a continuous daily series matching
 * `dailyActivity`'s Postgres shape.
 */
export function zeroFillDailyActivity(
  rows: ActivityRow[],
  since: Date,
  days: number,
): DailyPoint[] {
  const byDay = new Map(rows.map((r) => [r.day.slice(0, 10), r]));
  const out: DailyPoint[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const hit = byDay.get(key);
    out.push({
      date: key,
      sent: hit?.sent ?? 0,
      delivered: hit?.delivered ?? 0,
      failed: hit?.failed ?? 0,
      // HogQL delivery reports carry no engagement; `dailyActivity` merges the
      // reconciled Postgres figures in over these.
      opened: 0,
      clicked: 0,
    });
  }
  return out;
}

export function mapHogQLActivityRows(columns: string[], results: unknown[][]): ActivityRow[] {
  const iDay = columnIndex(columns, 'day');
  const iSent = columnIndex(columns, 'sent');
  const iDelivered = columnIndex(columns, 'delivered');
  const iFailed = columnIndex(columns, 'failed');
  if (iDay < 0 || iSent < 0 || iDelivered < 0 || iFailed < 0) return [];

  return results
    .map((row) => ({
      day: cellString(row, iDay).slice(0, 10),
      sent: cellNumber(row, iSent),
      delivered: cellNumber(row, iDelivered),
      failed: cellNumber(row, iFailed),
    }))
    .filter((r) => r.day.length === 10);
}

export function mapHogQLChannelRows(columns: string[], results: unknown[][]): ChannelBreakdown[] {
  const iChannel = columnIndex(columns, 'channel');
  const iSent = columnIndex(columns, 'sent');
  const iDelivered = columnIndex(columns, 'delivered');
  const iFailed = columnIndex(columns, 'failed');
  if (iChannel < 0 || iSent < 0 || iDelivered < 0 || iFailed < 0) return [];

  return results
    .map((row) => ({
      channel: cellString(row, iChannel),
      sent: cellNumber(row, iSent),
      delivered: cellNumber(row, iDelivered),
      failed: cellNumber(row, iFailed),
      // Delivery reports carry no engagement; channelBreakdown() grafts the
      // real opened/clicked counts from Postgres before returning.
      opened: 0,
      clicked: 0,
    }))
    .filter((r) => Boolean(r.channel));
}

function deliveryMetricsSelect(): string {
  const failedList = FAILED_STATUS_GROUPS.map((s) => `'${s}'`).join(', ');
  return `
  count(DISTINCT toString(properties.message_id)) AS sent,
  count(DISTINCT if(
    toString(properties.status_group) = 'DELIVERED',
    toString(properties.message_id),
    NULL
  )) AS delivered,
  count(DISTINCT if(
    toString(properties.status_group) IN (${failedList}),
    toString(properties.message_id),
    NULL
  )) AS failed`;
}

/**
 * Daily delivery activity from PostHog `message_delivery_report` (and
 * `message_voice_report` — voice DLRs land under their own event name).
 * Returns null when PostHog is unset/errors (caller falls back to Postgres).
 */
export async function dailyActivityFromPostHog(
  tenantId: string,
  days: number,
  since: Date,
  channel?: Channel,
): Promise<DailyPoint[] | null> {
  const tenantLit = hogqlLiteral(tenantId);
  if (!tenantLit) return null;

  const sinceIso = since.toISOString().slice(0, 19);
  const channelLit = channel ? hogqlLiteral(channel) : null;
  if (channel && !channelLit) return null;

  const channelFilter = channelLit ? `AND toString(properties.channel) = ${channelLit}` : '';

  const query = `
SELECT
  formatDateTime(toStartOfDay(timestamp), '%Y-%m-%d') AS day,
  ${deliveryMetricsSelect()}
FROM events
WHERE event IN ('message_delivery_report', 'message_voice_report')
  AND toString(properties.tenant_id) = ${tenantLit}
  AND timestamp >= toDateTime('${sinceIso}')
  ${channelFilter}
GROUP BY day
ORDER BY day
`.trim();

  const result = await runHogQL(query, 'maildrill-daily-activity');
  if (!result) return null;

  const rows = mapHogQLActivityRows(result.columns, result.results);
  return zeroFillDailyActivity(rows, since, days);
}

/**
 * Per-channel delivery breakdown from PostHog. Null → Postgres fallback.
 * When `since` is set, only events on/after that day are counted.
 */
export async function byChannelFromPostHog(
  tenantId: string,
  since?: Date,
): Promise<ChannelBreakdown[] | null> {
  const tenantLit = hogqlLiteral(tenantId);
  if (!tenantLit) return null;

  const sinceIso = since?.toISOString().slice(0, 19);
  const sinceFilter = sinceIso ? `AND timestamp >= toDateTime('${sinceIso}')` : '';

  const query = `
SELECT
  toString(properties.channel) AS channel,
  ${deliveryMetricsSelect()}
FROM events
WHERE event IN ('message_delivery_report', 'message_voice_report')
  AND toString(properties.tenant_id) = ${tenantLit}
  AND notEmpty(toString(properties.channel))
  ${sinceFilter}
GROUP BY channel
ORDER BY channel
`.trim();

  const result = await runHogQL(query, 'maildrill-by-channel');
  if (!result) return null;

  return mapHogQLChannelRows(result.columns, result.results);
}
