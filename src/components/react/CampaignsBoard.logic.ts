import type { CampaignStatus } from '@/types/app';

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
};

export const TABS: (CampaignStatus | 'all')[] = [
  'all',
  'draft',
  'scheduled',
  'sending',
  'sent',
  'paused',
];

/** Rows shown per page in the campaigns table. */
export const PAGE_SIZE = 10;

export function pct(v: number | null): string {
  return v == null ? '—' : `${(v * 100).toFixed(1)}%`;
}
