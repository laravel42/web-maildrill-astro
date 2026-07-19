import type { ListSummary } from '@/types/app';

/**
 * Per-list presentation metadata that mock-data.ts does not carry (color dot,
 * a 7-point subscriber trend "6 weeks ago → Now", the most recent campaign,
 * tags and engagement rates). Kept local to this screen per the build rules —
 * the shared mock-data.ts is not edited.
 */
export type ListMeta = {
  color: string;
  trend: number[];
  recentCampaign: string;
  tags: string[];
  more: string;
  openRate: string;
  clickRate: string;
};

export type ListRow = ListSummary & ListMeta;

export type SortKey = 'name' | 'subscribers' | 'growthPct' | 'updatedAt';
export type View = 'cards' | 'table';
