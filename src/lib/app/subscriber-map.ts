import type { SubscriberStatus } from '@/types/app';
import type { RichSubscriber } from './subscribers-data';

/** Shape of a subscriber as returned by maildrill-service /v1/subscribers. */
export interface ApiSubscriber {
  id: string;
  email: string;
  phone?: string | null;
  name?: string | null;
  status: string;
  attributes?: Record<string, unknown> | null;
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
    return {
      id: r.id,
      email: r.email,
      name: r.name || r.email,
      status: mapStatus(r.status),
      lists: [],
      tags: Array.isArray(attrs.tags) ? (attrs.tags as string[]) : [],
      updatedAt: r.updatedAt ?? r.createdAt ?? new Date().toISOString(),
      location: typeof attrs.location === 'string' ? attrs.location : '—',
      joined: fmtDate(r.createdAt),
      opens: '—',
      clicks: '—',
      av: pickAv(r.id),
    };
  });
}
