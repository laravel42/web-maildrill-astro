/**
 * Local fixtures for the Subscribers (CRM) screen. This file is imported ONLY by
 * AppSubscribers.tsx and extends the shared mock-data subscribers into a richer
 * CRM shape (location / signup date / open+click rates / avatar gradient) plus a
 * set of saved segments. The shared mock-data.ts is never modified.
 */
import { subscribers as baseSubs } from './mock-data';
import type { Subscriber } from '@/types/app';

export type RichSubscriber = Subscriber & {
  location: string;
  joined: string; // human display, e.g. "Jan 12, 2025"
  opens: string; // "87%" | "—"
  clicks: string; // "34%" | "—"
  av: [string, string]; // avatar gradient stops
};

// Avatar gradient palette (cycled), mirrors the App.dc.html prototype.
const G: [string, string][] = [
  ['#818cf8', '#4f46e5'],
  ['#fbbf24', '#f59e0b'],
  ['#34d399', '#059669'],
  ['#f472b6', '#db2777'],
  ['#60a5fa', '#2563eb'],
  ['#a78bfa', '#7c3aed'],
  ['#2dd4bf', '#0d9488'],
  ['#fb7185', '#e11d48'],
];

// Per-id enrichment for the four subscribers that already live in mock-data.ts.
const ENRICH: Record<
  string,
  { location: string; joined: string; opens: string; clicks: string; av: number; tags?: string[] }
> = {
  sub_1: { location: 'Austin, US', joined: 'Jan 12, 2025', opens: '87%', clicks: '34%', av: 0, tags: ['VIP', 'engaged'] },
  sub_2: { location: 'Denver, US', joined: 'Feb 03, 2025', opens: '62%', clicks: '18%', av: 4, tags: ['Customer', 'sms-ok'] },
  sub_3: { location: 'Madrid, ES', joined: 'Nov 08, 2024', opens: '12%', clicks: '2%', av: 3, tags: ['Churn risk'] },
  sub_4: { location: '—', joined: 'Aug 14, 2024', opens: '—', clicks: '—', av: 7, tags: ['suppress'] },
};

// The 4 shared subscribers, enriched into the CRM shape.
const fromBase: RichSubscriber[] = baseSubs.map((s) => {
  const e = ENRICH[s.id];
  return {
    ...s,
    tags: e?.tags ?? s.tags,
    location: e?.location ?? '—',
    joined: e?.joined ?? '—',
    opens: e?.opens ?? '—',
    clicks: e?.clicks ?? '—',
    av: G[e?.av ?? 0],
  };
});

// 8 extra hand-authored subscribers for a fuller table.
const extra: RichSubscriber[] = [
  {
    id: 'sub_5', email: 'andrea@example.com', name: 'Andrea Rossi', status: 'active',
    lists: ['Newsletter', 'VIP buyers'], tags: ['VIP', 'Customer'],
    updatedAt: '2026-07-17T16:00:00Z', location: 'Milan, IT', joined: 'Jan 12, 2025',
    opens: '91%', clicks: '41%', av: G[0],
  },
  {
    id: 'sub_6', email: 'mei.t@studio.jp', name: 'Mei Tanaka', status: 'active',
    lists: ['Newsletter', 'Recent buyers'], tags: ['VIP'],
    updatedAt: '2026-07-17T13:00:00Z', location: 'Osaka, JP', joined: 'Dec 20, 2024',
    opens: '84%', clicks: '29%', av: G[6],
  },
  {
    id: 'sub_7', email: 'sofia.alvarez@mail.es', name: 'Sofia Alvarez', status: 'active',
    lists: ['Newsletter'], tags: ['Customer', 'Trial'],
    updatedAt: '2026-07-16T18:00:00Z', location: 'Madrid, ES', joined: 'Mar 02, 2025',
    opens: '74%', clicks: '22%', av: G[5],
  },
  {
    id: 'sub_8', email: 'priya.nair@corp.in', name: 'Priya Nair', status: 'active',
    lists: ['Newsletter', 'VIP buyers'], tags: ['VIP', 'Customer'],
    updatedAt: '2026-07-15T20:00:00Z', location: 'Bangalore, IN', joined: 'Sep 22, 2024',
    opens: '83%', clicks: '31%', av: G[2],
  },
  {
    id: 'sub_9', email: 'james.carter@acme.co', name: 'James Carter', status: 'active',
    lists: ['Newsletter'], tags: ['Lead'],
    updatedAt: '2026-07-12T18:00:00Z', location: 'Austin, US', joined: 'Feb 03, 2025',
    opens: '55%', clicks: '14%', av: G[4],
  },
  {
    id: 'sub_10', email: 'liam@brightmail.io', name: "Liam O'Brien", status: 'active',
    lists: ['Recent buyers'], tags: ['Trial'],
    updatedAt: '2026-07-11T10:00:00Z', location: 'Dublin, IE', joined: 'Mar 15, 2025',
    opens: '48%', clicks: '9%', av: G[1],
  },
  {
    id: 'sub_11', email: 'noah.b@webco.de', name: 'Noah Becker', status: 'unsubscribed',
    lists: ['Newsletter'], tags: ['Churn risk'],
    updatedAt: '2026-07-14T09:00:00Z', location: 'Berlin, DE', joined: 'Oct 01, 2024',
    opens: '15%', clicks: '3%', av: G[3],
  },
  {
    id: 'sub_12', email: 'tom.walsh@fail.co', name: 'Tom Walsh', status: 'bounced',
    lists: ['Newsletter'], tags: ['Bounced'],
    updatedAt: '2026-07-08T11:00:00Z', location: 'Leeds, UK', joined: 'Aug 14, 2024',
    opens: '—', clicks: '—', av: G[7],
  },
];

export const richSubscribers: RichSubscriber[] = [...fromBase, ...extra];

// ---- Segment rule vocabulary ----------------------------------------------
export type SegField = 'Status' | 'Tag' | 'List' | 'Last activity' | 'Open rate';
export type SegRule = { field: SegField; op: string; val: string };
export type SavedSegment = {
  id: string;
  name: string;
  matchType: 'all' | 'any';
  rows: SegRule[];
  custom?: boolean;
};

export const SEG_FIELDS: Record<SegField, { ops: [string, string]; vals: string[] }> = {
  Status: { ops: ['is', 'is not'], vals: ['Active', 'Unsubscribed', 'Bounced'] },
  Tag: { ops: ['is', 'is not'], vals: ['VIP', 'Customer', 'Lead', 'Trial', 'Churn risk'] },
  List: { ops: ['is', 'is not'], vals: ['Newsletter', 'VIP buyers', 'Recent buyers'] },
  'Last activity': { ops: ['within', 'not within'], vals: ['24 hours', '48 hours', '7 days'] },
  'Open rate': { ops: ['above', 'below'], vals: ['25%', '50%', '75%'] },
};

export const SEG_FIELD_LIST: SegField[] = ['Status', 'Tag', 'List', 'Last activity', 'Open rate'];

// Built-in saved segments, expressed in the same rule grammar as user segments.
export const BUILTIN_SEGMENTS: SavedSegment[] = [
  { id: 'vip', name: 'VIP customers', matchType: 'all', rows: [{ field: 'Tag', op: 'is', val: 'VIP' }] },
  {
    id: 'active',
    name: 'Recently active',
    matchType: 'all',
    rows: [
      { field: 'Last activity', op: 'within', val: '48 hours' },
      { field: 'Status', op: 'is', val: 'Active' },
    ],
  },
  { id: 'trial', name: 'Trial users', matchType: 'all', rows: [{ field: 'Tag', op: 'is', val: 'Trial' }] },
  {
    id: 'risk',
    name: 'At risk',
    matchType: 'any',
    rows: [
      { field: 'Tag', op: 'is', val: 'Churn risk' },
      { field: 'Status', op: 'is', val: 'Bounced' },
      { field: 'Status', op: 'is', val: 'Unsubscribed' },
    ],
  },
];
