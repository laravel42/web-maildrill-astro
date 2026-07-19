import type { ListRow } from '@/components/react/AppLists.types';

/** Shape of a list as returned by maildrill-service /v1/lists. */
export interface ApiList {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
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
    subscribers: 0,
    growthPct: 0,
    updatedAt: l.updatedAt ?? l.createdAt ?? new Date().toISOString(),
    color: l.color || '#4f46e5',
    trend: [0],
    recentCampaign: '—',
    tags: [],
    more: '+0',
    openRate: '—',
    clickRate: '—',
  };
}

export function toListRows(rows: ApiList[]): ListRow[] {
  return rows.map(toListRow);
}
