import type { IconName } from '@/lib/icons';
import type { SparkPoint } from './shared/Sparkline';

export type Kpi = {
  /** Stable identity — picks the card's icon, accent, and destination. */
  key: 'subscribers' | 'lists' | 'campaigns' | 'sent' | 'open' | 'click';
  label: string;
  value: string;
  delta: string;
  /** Visual tone for the period-over-period delta. */
  tone: 'up' | 'down' | 'flat';
  /** Supporting fact rendered after the delta; null when there is nothing to add. */
  context: string | null;
  /** Trend points for the in-card spark; fewer than 2 points draws nothing. */
  spark: SparkPoint[];
  sparkFormat: 'number' | 'percent';
};

export type ActivityItem = {
  icon: IconName;
  bg: string;
  color: string;
  text: string;
  time: string;
};

/** One entry from /v1/stats/feed — a real workspace happening. */
export type FeedItem = {
  type: 'campaign_sent' | 'subscriber_added' | 'unsubscribed';
  title: string;
  detail: string | null;
  at: string;
  /** Deep-link target for campaign_sent entries (absent in older cache entries). */
  campaignId?: string | null;
};

export type GetStartedStep = {
  label: string;
  bg: string;
  ring: string;
  fill: string;
  text: string;
};
