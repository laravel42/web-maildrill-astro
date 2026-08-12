import type { ChannelType } from '@/types/app';

/** Which Infobip-backed KPIs a channel can surface on the campaign report. */
export type ReportKpiKey =
  | 'delivered'
  | 'opened'
  | 'seen'
  | 'clicked'
  | 'bounced'
  | 'failed'
  | 'unsubscribed'
  | 'complaints';

export type ReportFunnelKey = 'recipients' | 'delivered' | 'opened' | 'seen' | 'clicked';

export type ReportPanelKey = 'devices' | 'links' | 'details';

export type ReportEventTab =
  | 'all'
  | 'delivered'
  | 'opened'
  | 'seen'
  | 'clicked'
  | 'unsubscribed'
  | 'sent'
  | 'bounced'
  | 'queued'
  | 'failed';

/** Compact KPI tiles in the campaign detail drawer. */
export type DrawerKpiKey =
  'recipients' | 'delivered' | 'open' | 'seen' | 'click' | 'cto' | 'unsubscribed' | 'failed';

export type ChannelReportConfig = {
  /** Rate cards under the header (delivery / open / click / unsub). */
  rateCards: Array<'delivery' | 'open' | 'seen' | 'click' | 'unsub'>;
  /** Bottom KPI strip. */
  kpis: ReportKpiKey[];
  /** Compact tiles in the campaign drawer preview. */
  drawerKpis: DrawerKpiKey[];
  /** Engagement funnel stages after recipients. */
  funnel: ReportFunnelKey[];
  /** Side panels in the middle row (devices / links). */
  panels: ReportPanelKey[];
  /** Recipient-event tabs. */
  eventTabs: ReportEventTab[];
  /**
   * Label for the open/seen stage — "Opened" on email, "Seen" on WhatsApp.
   * Unused on SMS and voice, which have no such stage.
   */
  openLabel: string;
};

const EMAIL: ChannelReportConfig = {
  rateCards: ['delivery', 'open', 'click', 'unsub'],
  kpis: ['delivered', 'opened', 'clicked', 'bounced', 'unsubscribed', 'complaints'],
  drawerKpis: ['recipients', 'delivered', 'open', 'click', 'cto', 'unsubscribed'],
  funnel: ['recipients', 'delivered', 'opened', 'clicked'],
  panels: ['devices', 'links', 'details'],
  eventTabs: ['all', 'delivered', 'opened', 'clicked', 'unsubscribed', 'sent', 'bounced', 'queued'],
  openLabel: 'Opened',
};

const WHATSAPP: ChannelReportConfig = {
  rateCards: ['delivery', 'seen', 'click', 'unsub'],
  kpis: ['delivered', 'seen', 'clicked', 'failed', 'unsubscribed'],
  drawerKpis: ['recipients', 'delivered', 'seen', 'click', 'cto', 'unsubscribed'],
  funnel: ['recipients', 'delivered', 'seen', 'clicked'],
  panels: ['links', 'details'],
  eventTabs: ['all', 'delivered', 'seen', 'clicked', 'unsubscribed', 'sent', 'failed', 'queued'],
  openLabel: 'Seen',
};

/**
 * SMS reports delivery and STOP replies, and nothing else.
 *
 * Infobip can attach click tracking to an SMS when the body carries a link it
 * shortens, but nothing in the product uses that today and no click has ever
 * been recorded — so a "Click rate" tile sat at 0.0% on every SMS campaign,
 * implying nobody clicked rather than that nothing was measured. The
 * Analytics screen already treats SMS as delivery-only; this brings the
 * campaign views into line. Restore the click keys if link shortening is
 * turned on.
 */
const SMS: ChannelReportConfig = {
  rateCards: ['delivery', 'unsub'],
  kpis: ['delivered', 'failed', 'unsubscribed'],
  drawerKpis: ['recipients', 'delivered', 'unsubscribed', 'failed'],
  funnel: ['recipients', 'delivered'],
  panels: ['details'],
  eventTabs: ['all', 'delivered', 'unsubscribed', 'sent', 'failed', 'queued'],
  openLabel: 'Opened',
};

const VOICE: ChannelReportConfig = {
  rateCards: ['delivery'],
  kpis: ['delivered', 'failed'],
  drawerKpis: ['recipients', 'delivered', 'failed'],
  funnel: ['recipients', 'delivered'],
  panels: ['details'],
  eventTabs: ['all', 'delivered', 'sent', 'failed', 'queued'],
  openLabel: 'Opened',
};

const BY_CHANNEL: Record<ChannelType, ChannelReportConfig> = {
  email: EMAIL,
  whatsapp: WHATSAPP,
  sms: SMS,
  voice: VOICE,
};

export function channelReportConfig(channel: ChannelType): ChannelReportConfig {
  return BY_CHANNEL[channel] ?? EMAIL;
}
