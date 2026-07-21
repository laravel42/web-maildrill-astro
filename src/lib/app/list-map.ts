import type { ListRow } from '@/components/react/AppLists.types';

/** Shape of a list as returned by maildrill-service /v1/lists. */
export interface ApiList {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  /** Free-form labels stored on the list (jsonb array). */
  tags?: string[] | null;
  /** Free-text note kept with the list. */
  notes?: string | null;
  /** Subscribers on the list, counted server-side by /v1/lists. */
  memberCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Map a live API list into the row shape the Lists screen renders. The service
 * stores only identity + colour; growth/trend/engagement are presentation-only
 * and start neutral until analytics wire them up.
 */
export function toListRow(l: ApiList): ListRow {
  return {
    id: l.id,
    name: l.name,
    subscribers: l.memberCount ?? 0,
    growthPct: 0,
    updatedAt: l.updatedAt ?? l.createdAt ?? new Date().toISOString(),
    color: l.color || '#4f46e5',
    trend: [0],
    recentCampaign: '—',
    tags: l.tags ?? [],
    notes: l.notes ?? '',
    more: '+0',
    openRate: '—',
    clickRate: '—',
  };
}

export function toListRows(rows: ApiList[]): ListRow[] {
  return rows.map(toListRow);
}
