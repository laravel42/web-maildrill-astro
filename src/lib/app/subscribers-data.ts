/**
 * Types and the segment-rule vocabulary for the Subscribers (CRM) screen. Seed
 * subscribers and built-in segments were removed — live data comes from
 * workers (mapped in subscriber-map.ts). Only the CRM row shape and
 * the rule-builder option lists remain here.
 */
import type { Subscriber } from '@/types/app';

export type RichSubscriber = Subscriber & {
  /** Ids of the lists this subscriber is on, parallel to `lists` names. */
  listIds: string[];
  location: string;
  /** ISO timestamp of signup (for sorting / relative ago). */
  createdAt: string;
  joined: string; // human display, e.g. "Jan 12, 2025"
  opens: string; // "87%" | "—"
  clicks: string; // "34%" | "—"
  av: [string, string]; // avatar gradient stops
};

// No seed rows — the Subscribers screen renders live workspace data.
export const richSubscribers: RichSubscriber[] = [];

// ---- Segment rule vocabulary ----------------------------------------------
//
// This mirrors the service's rule model exactly (field + op + value), so a rule
// built here round-trips through /v1/segments without translation guesswork.
// "Last activity" and "Open rate" are absent: nothing records engagement yet,
// so those rules could never match anything.

export type SegField = 'Status' | 'Tag' | 'List' | 'Email' | 'Name';
/** Operators as the API names them. */
export type SegOp = 'eq' | 'neq' | 'contains' | 'exists' | 'not_exists';
export type SegRule = { field: SegField; op: SegOp; val: string };

export type SavedSegment = {
  id: string;
  name: string;
  matchType: 'all' | 'any';
  rows: SegRule[];
  custom?: boolean;
};

/** A rule exactly as the service stores it. */
export type ApiSegmentRule = { field: string; op: SegOp; value?: unknown };

export interface ApiSegment {
  id: string;
  name: string;
  description?: string | null;
  matchType?: 'all' | 'any';
  rules?: ApiSegmentRule[];
}

/** Which service field each UI field maps to. */
const FIELD_TO_API: Record<SegField, string> = {
  Status: 'status',
  Tag: 'tag',
  List: 'list',
  Email: 'email',
  Name: 'name',
};
const API_TO_FIELD: Record<string, SegField> = {
  status: 'Status',
  tag: 'Tag',
  list: 'List',
  email: 'Email',
  name: 'Name',
};

/** Operators offered per field, labelled for humans. */
export const SEG_OPS: Record<SegField, { op: SegOp; label: string }[]> = {
  Status: [
    { op: 'eq', label: 'is' },
    { op: 'neq', label: 'is not' },
  ],
  Tag: [
    { op: 'eq', label: 'is' },
    { op: 'neq', label: 'is not' },
    { op: 'exists', label: 'has any tag' },
    { op: 'not_exists', label: 'has no tags' },
  ],
  List: [
    { op: 'eq', label: 'is' },
    { op: 'neq', label: 'is not' },
    { op: 'exists', label: 'on any list' },
    { op: 'not_exists', label: 'on no list' },
  ],
  Email: [
    { op: 'contains', label: 'contains' },
    { op: 'eq', label: 'is' },
  ],
  Name: [
    { op: 'contains', label: 'contains' },
    { op: 'eq', label: 'is' },
  ],
};

export const SEG_FIELD_LIST: SegField[] = ['Status', 'Tag', 'List', 'Email', 'Name'];

export const STATUS_VALUES = ['active', 'unsubscribed', 'bounced', 'complained', 'invalid'];

/** Ops that take no value, so the value control is hidden for them. */
export function opNeedsValue(op: SegOp): boolean {
  return op !== 'exists' && op !== 'not_exists';
}

export function toApiRules(rows: SegRule[]): ApiSegmentRule[] {
  return rows
    .filter((r) => !opNeedsValue(r.op) || r.val !== '')
    .map((r) => ({
      field: FIELD_TO_API[r.field],
      op: r.op,
      ...(opNeedsValue(r.op) ? { value: r.val } : {}),
    }));
}

export function fromApiRules(rules: ApiSegmentRule[] | undefined): SegRule[] {
  return (rules ?? []).map((r) => ({
    field: API_TO_FIELD[r.field] ?? 'Email',
    op: r.op,
    val: r.value == null ? '' : String(r.value),
  }));
}

export function toSavedSegment(s: ApiSegment): SavedSegment {
  return {
    id: s.id,
    name: s.name,
    matchType: s.matchType ?? 'all',
    rows: fromApiRules(s.rules),
    custom: true,
  };
}
