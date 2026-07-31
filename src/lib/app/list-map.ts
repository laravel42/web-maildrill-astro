import type { ListRow } from '@/components/react/AppLists.types';

/** Shape of a list as returned by workers /v1/lists. */
export interface ApiList {
  id: string;
  name: string;
  color?: string | null;
  /** Consent & lifecycle configuration stored on the list. */
  gdprConsent?: boolean | null;
  doubleOptIn?: boolean | null;
  doubleOptOut?: boolean | null;
  doubleOptInTemplateId?: string | null;
  doubleOptOutTemplateId?: string | null;
  welcomeEmailTemplateId?: string | null;
  goodbyeEmailTemplateId?: string | null;
  /** Free-form labels stored on the list (jsonb array). */
  tags?: string[] | null;
  /** Free-text note kept with the list. */
  notes?: string | null;
  /** Subscribers on the list, counted server-side by /v1/lists. */
  memberCount?: number | null;
  /** List members with a phone number — for SMS / WhatsApp / Voice reach. */
  phoneMemberCount?: number | null;
  /** Members added in the trailing 7 days / the 7 days before that. */
  addedLast7?: number | null;
  addedPrev7?: number | null;
  /** Cumulative member count at 7 weekly points, oldest → now. */
  trend?: number[] | null;
  /** Message outcomes across campaigns sent to this list. */
  delivered?: number | null;
  /** Deliveries on channels with engagement tracking (email, WhatsApp). */
  trackedDelivered?: number | null;
  opened?: number | null;
  clicked?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/**
 * Map a live API list into the row shape the Lists screen renders. Growth,
 * trend, and engagement are computed server-side from membership timestamps
 * and campaign message outcomes.
 */
export function toListRow(l: ApiList): ListRow {
  const last7 = l.addedLast7 ?? 0;
  const prev7 = l.addedPrev7 ?? 0;
  // Rates divide by deliveries on channels that track engagement (email,
  // WhatsApp); SMS/voice deliveries can never open, so they don't count.
  const denom = l.trackedDelivered ?? l.delivered ?? 0;
  const rate = (n: number) => (denom > 0 ? `${Math.round((n / denom) * 100)}%` : '—');
  return {
    id: l.id,
    name: l.name,
    subscribers: l.memberCount ?? 0,
    growthPct: prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : last7 > 0 ? 100 : 0,
    updatedAt: l.updatedAt ?? l.createdAt ?? new Date().toISOString(),
    color: l.color || '#4f46e5',
    trend: l.trend && l.trend.length > 1 ? l.trend : [0],
    gdprConsent: Boolean(l.gdprConsent),
    tags: l.tags ?? [],
    notes: l.notes ?? '',
    more: last7 > 0 ? `+${last7}` : '+0',
    openRate: rate(l.opened ?? 0),
    clickRate: rate(l.clicked ?? 0),
  };
}

export function toListRows(rows: ApiList[]): ListRow[] {
  return rows.map(toListRow);
}
