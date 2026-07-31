import type { IconName } from '@/lib/icons';

export type Kpi = {
  label: string;
  value: string;
  delta: string;
  /** Visual tone for the period-over-period delta. */
  tone: 'up' | 'down' | 'flat';
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
