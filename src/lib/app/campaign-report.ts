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
  /** Label for the open/seen stage. */
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

const SMS: ChannelReportConfig = {
  rateCards: ['delivery', 'click', 'unsub'],
  kpis: ['delivered', 'clicked', 'failed', 'unsubscribed'],
  drawerKpis: ['recipients', 'delivered', 'click', 'unsubscribed', 'failed'],
  funnel: ['recipients', 'delivered', 'clicked'],
  panels: ['links', 'details'],
  eventTabs: ['all', 'delivered', 'clicked', 'unsubscribed', 'sent', 'failed', 'queued'],
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
