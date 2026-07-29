import type { SubscriberStatus } from '@/types/app';
import type { RichSubscriber } from './subscribers-data';

/** Shape of a subscriber as returned by workers /v1/subscribers. */
export interface ApiSubscriber {
  id: string;
  email: string;
  phone?: string | null;
  name?: string | null;
  status: string;
  attributes?: Record<string, unknown> | null;
  /** Real list memberships, joined server-side. */
  lists?: { id: string; name: string }[] | null;
  /** Real tag names from the tags relation. */
  tagNames?: string[] | null;
  /** Message outcomes for this recipient, joined server-side. */
  delivered?: number | null;
  /** Deliveries on channels with engagement tracking (email, WhatsApp). */
  trackedDelivered?: number | null;
  opened?: number | null;
  clicked?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const AV: Array<[string, string]> = [
  ['#818cf8', '#4f46e5'],
  ['#fbbf24', '#f59e0b'],
  ['#34d399', '#059669'],
  ['#f472b6', '#db2777'],
  ['#60a5fa', '#2563eb'],
  ['#a78bfa', '#7c3aed'],
  ['#2dd4bf', '#0d9488'],
  ['#fb7185', '#e11d48'],
];

function pickAv(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length] ?? ['#818cf8', '#4f46e5'];
}

// The app UI knows 3 statuses; the API can also return 'complained'.
function mapStatus(s: string): SubscriberStatus {
  return s === 'active' || s === 'unsubscribed' || s === 'bounced' ? s : 'unsubscribed';
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

/** Map a single live API subscriber into the CRM shape the screen renders. */
export function toRichSubscriber(r: ApiSubscriber): RichSubscriber {
  return toRichSubscribers([r])[0];
}

/** Map live API subscribers into the CRM shape the Subscribers screen renders. */
export function toRichSubscribers(rows: ApiSubscriber[]): RichSubscriber[] {
  return rows.map((r) => {
    const attrs = (r.attributes ?? {}) as Record<string, unknown>;
    // Open/click rates divide by deliveries on channels that track engagement
    // (email, WhatsApp) — SMS/voice deliveries can never produce an open, so
    // counting them would dilute the rate below what any channel shows.
    const denom = r.trackedDelivered ?? r.delivered ?? 0;
    return {
      id: r.id,
      email: r.email,
      phone: r.phone ?? '',
      name: r.name || r.email,
      status: mapStatus(r.status),
      lists: (r.lists ?? []).map((l) => l.name),
      listIds: (r.lists ?? []).map((l) => l.id),
      // Prefer the real tag relation; fall back to the legacy attributes.tags
      // blob for subscribers written before tags were relational.
      tags:
        r.tagNames && r.tagNames.length > 0
          ? r.tagNames
          : Array.isArray(attrs.tags)
            ? (attrs.tags as string[])
            : [],
      updatedAt: r.updatedAt ?? r.createdAt ?? new Date().toISOString(),
      createdAt: r.createdAt ?? r.updatedAt ?? new Date().toISOString(),
      location: typeof attrs.location === 'string' ? attrs.location : '—',
      joined: fmtDate(r.createdAt),
      opens: denom > 0 ? `${Math.round(((r.opened ?? 0) / denom) * 100)}%` : '—',
      clicks: denom > 0 ? `${Math.round(((r.clicked ?? 0) / denom) * 100)}%` : '—',
      av: pickAv(r.id),
    };
  });
}
