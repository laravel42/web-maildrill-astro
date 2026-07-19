/**
 * Types and the segment-rule vocabulary for the Subscribers (CRM) screen. Seed
 * subscribers and built-in segments were removed — live data comes from
 * maildrill-service (mapped in subscriber-map.ts). Only the CRM row shape and
 * the rule-builder option lists remain here.
 */
import type { Subscriber } from '@/types/app';

export type RichSubscriber = Subscriber & {
  location: string;
  joined: string; // human display, e.g. "Jan 12, 2025"
  opens: string; // "87%" | "—"
  clicks: string; // "34%" | "—"
  av: [string, string]; // avatar gradient stops
};

// No seed rows — the Subscribers screen renders live workspace data.
export const richSubscribers: RichSubscriber[] = [];

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

// No built-in saved segments — user segments are created on the screen.
export const BUILTIN_SEGMENTS: SavedSegment[] = [];
