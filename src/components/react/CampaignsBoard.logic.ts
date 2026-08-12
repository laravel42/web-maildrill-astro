import type { IconName } from '@/lib/icons';
import type { CampaignStatus, ChannelType } from '@/types/app';

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
};

export const STATUS_ICON: Record<CampaignStatus, IconName> = {
  draft: 'edit',
  scheduled: 'clock',
  sending: 'send',
  sent: 'check-circle',
  paused: 'pause',
};

/**
 * The table tabs split by channel, not status.
 *
 * Campaigns on different channels are barely comparable — their KPIs differ,
 * their failure modes differ, and a sender almost always works within one
 * channel at a time. Status is the secondary cut and lives in the toolbar
 * filter instead, where several can be combined.
 */
export const CHANNEL_TABS: (ChannelType | 'all')[] = ['all', 'email', 'sms', 'whatsapp', 'voice'];

/** Statuses offered by the toolbar filter, in lifecycle order. */
export const STATUS_FILTERS: CampaignStatus[] = [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'paused',
];

/** Rows shown per page in the campaigns table. */
export const PAGE_SIZE = 15;

export function pct(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}
