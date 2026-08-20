import type { ChannelType } from '@/types/app';
import { channelReportConfig } from './campaign-report';

/**
 * Per-channel KPI tiles for the Lists and Subscribers detail views.
 *
 * Both screens used to report one email-shaped set of numbers — opens, clicks,
 * bounces — for records that live on all four channels. The rates divided by
 * deliveries on the tracked channels only, so an SMS-heavy list or subscriber
 * was described by metrics that never measured most of its sends.
 *
 * What a channel can report is read from `channelReportConfig`, the same source
 * the campaign board, drawer, report and template views use, so no screen can
 * drift from another about what a channel measures.
 */
export type ChannelTotals = {
  /**
   * Everything addressed on this channel, failures included — the single
   * denominator for delivery and failure. Named for what it is because the two
   * sources count differently: a campaign's `recipients` already contains its
   * failures, while a subscriber's `sent` excludes them, and mixing the two
   * inflated the total.
   */
  attempted: number;
  delivered: number;
  /** Opens on email, reads on WhatsApp; ignored on delivery-only channels. */
  opened: number;
  clicked: number;
  failed: number;
  /** Failures whose error was permanent — a hard bounce on email. */
  failedPermanent: number;
  /** Spam complaints. Only email reports them; the rest stay 0. */
  complaints: number;
};

export type ChannelKpi = {
  key: string;
  label: string;
  value: string;
  /** Sub-line naming the denominator, so a rate is never ambiguous. */
  sub: string;
  /** True when the value is a problem worth acting on. */
  alert?: boolean;
};

export const EMPTY_TOTALS: ChannelTotals = Object.freeze({
  attempted: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  failed: 0,
  failedPermanent: 0,
  complaints: 0,
});

/**
 * Every rate on these tiles names its denominator in the `sub` line beneath it,
 * and returns "—" rather than 0% on an empty denominator — a zero rate means
 * "measured, nobody engaged", which is a claim we cannot make about a channel
 * or a record with no sends. Both counts come from server-side SQL over the
 * record's full history; nothing on these tiles is a page.
 */
const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');
const num = (n: number) => n.toLocaleString('en-US');

/**
 * KPI tiles for one channel. Every channel reports volume, delivery and
 * failures; only the channels that track engagement add open/click, so the
 * delivery-only ones show three real numbers instead of two blank rates.
 */
export function channelKpis(channel: ChannelType, t: ChannelTotals): ChannelKpi[] {
  const cfg = channelReportConfig(channel);
  const hasOpen = cfg.rateCards.some((r) => r === 'open' || r === 'seen');
  const hasClick = cfg.rateCards.includes('click');
  const n = t.attempted;

  const kpis: ChannelKpi[] = [
    {
      key: 'attempted',
      label: channel === 'voice' ? 'Calls placed' : 'Sent',
      value: num(n),
      sub: n > 0 ? 'Including failures' : 'No sends yet',
    },
    {
      key: 'delivered',
      label: channel === 'voice' ? 'Answered' : 'Delivered',
      value: pct(t.delivered, n),
      sub: n > 0 ? `${num(t.delivered)} of ${num(n)}` : 'Of sent',
    },
  ];

  if (hasOpen) {
    kpis.push({
      key: 'opened',
      label: cfg.openLabel === 'Seen' ? 'Seen' : 'Opened',
      value: pct(t.opened, t.delivered),
      sub: t.delivered > 0 ? `${num(t.opened)} of ${num(t.delivered)} delivered` : 'Of delivered',
    });
  }
  if (hasClick) {
    kpis.push({
      key: 'clicked',
      label: 'Clicked',
      value: pct(t.clicked, t.delivered),
      sub: t.delivered > 0 ? `${num(t.clicked)} of ${num(t.delivered)} delivered` : 'Of delivered',
    });
  }

  kpis.push({
    key: 'failed',
    label: 'Failed',
    value: num(t.failed),
    sub: n > 0 ? `${pct(t.failed, n)} of sends` : 'Of sends',
    alert: t.failed > 0,
  });

  return kpis;
}
