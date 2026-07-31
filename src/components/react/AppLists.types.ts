import type { ListSummary } from '@/types/app';

/**
 * Per-list presentation metadata that mock-data.ts does not carry (color dot,
 * a 7-point subscriber trend "6 weeks ago → Now", GDPR consent, tags and
 * engagement rates). Kept local to this screen per the build rules — the
 * shared mock-data.ts is not edited.
 */
export type ListMeta = {
  color: string;
  trend: number[];
  /** Whether the list requires / records GDPR consent. */
  gdprConsent: boolean;
  tags: string[];
  /** Free-text note kept with the list. */
  notes: string;
  more: string;
  openRate: string;
  clickRate: string;
};

export type ListRow = ListSummary & ListMeta;

export type SortKey = 'name' | 'subscribers' | 'growthPct' | 'updatedAt';
export type View = 'cards' | 'table';
