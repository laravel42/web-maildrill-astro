/** The delivery outcomes plotted on the hero trend chart. */
export type SeriesKey =
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'complained'
  | 'unsubscribed';
/** Series on the engagement chart. Only email and WhatsApp can report these. */
export type EngagementKey = 'opened' | 'clicked';
export type ChartKey = SeriesKey | EngagementKey;
