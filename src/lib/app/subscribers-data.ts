/**
 * Types and the segment-rule vocabulary for the Subscribers (CRM) screen. Seed
 * subscribers and built-in segments were removed — live data comes from
 * workers (mapped in subscriber-map.ts). Only the CRM row shape and
 * the rule-builder option lists remain here.
 */
import type { ChannelType, Subscriber } from '@/types/app';
import type { CustomField, FieldType } from '@/lib/app/custom-fields';

export type RichSubscriber = Subscriber & {
  /** Ids of the lists this subscriber is on, parallel to `lists` names. */
  listIds: string[];
  location: string;
  /** ISO timestamp of signup (for sorting / relative ago). */
  createdAt: string;
  /**
   * When this person was last reached or last reacted — the API's
   * `max(coalesce(read_at, delivered_at, sent_at, submitted_at, created_at))`
   * over their messages. `null` when they have never been messaged.
   *
   * Distinct from `updatedAt`, which is when the ROW was last written. The
   * roster's "Last activity" column rendered `updatedAt` and so counted a tag
   * edit as activity.
   */
  lastActiveAt: string | null;
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
// Core columns use the UI labels below; custom fields use their attribute key
// as the field id so they hit `subscribers.attributes` on the service.

export const CORE_SEG_FIELDS = ['Status', 'Tag', 'List', 'Email', 'Name'] as const;
export type CoreSegField = (typeof CORE_SEG_FIELDS)[number];
/** Core UI field name, or a workspace custom-field attribute key. */
export type SegField = CoreSegField | (string & {});
/** Operators as the API names them. */
export type SegOp = 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'exists' | 'not_exists';
export type SegRule = { field: SegField; op: SegOp; val: string };

export type SavedSegment = {
  id: string;
  name: string;
  matchType: 'all' | 'any';
  rows: SegRule[];
  /** Channels this segment is declared for; defaults to email. */
  channels: ChannelType[];
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
  channels?: string[] | null;
}

/** Which service field each core UI field maps to. */
const FIELD_TO_API: Record<CoreSegField, string> = {
  Status: 'status',
  Tag: 'tag',
  List: 'list',
  Email: 'email',
  Name: 'name',
};
const API_TO_FIELD: Record<string, CoreSegField> = {
  status: 'Status',
  tag: 'Tag',
  list: 'List',
  email: 'Email',
  name: 'Name',
};

export function isCoreSegField(field: string): field is CoreSegField {
  return (CORE_SEG_FIELDS as readonly string[]).includes(field);
}

export function fieldToApi(field: SegField): string {
  return isCoreSegField(field) ? FIELD_TO_API[field] : field;
}

export function apiToField(api: string): SegField {
  return API_TO_FIELD[api] ?? api;
}

/** Operators offered per core field, labelled for humans. */
export const SEG_OPS: Record<CoreSegField, { op: SegOp; label: string }[]> = {
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

const CUSTOM_OPS: Record<FieldType, { op: SegOp; label: string }[]> = {
  text: [
    { op: 'contains', label: 'contains' },
    { op: 'eq', label: 'is' },
    { op: 'neq', label: 'is not' },
    { op: 'exists', label: 'is set' },
    { op: 'not_exists', label: 'is not set' },
  ],
  number: [
    { op: 'eq', label: 'is' },
    { op: 'neq', label: 'is not' },
    { op: 'gt', label: 'greater than' },
    { op: 'lt', label: 'less than' },
    { op: 'exists', label: 'is set' },
    { op: 'not_exists', label: 'is not set' },
  ],
  date: [
    { op: 'eq', label: 'is' },
    { op: 'neq', label: 'is not' },
    { op: 'gt', label: 'after' },
    { op: 'lt', label: 'before' },
    { op: 'exists', label: 'is set' },
    { op: 'not_exists', label: 'is not set' },
  ],
  boolean: [
    { op: 'eq', label: 'is' },
    { op: 'exists', label: 'is set' },
    { op: 'not_exists', label: 'is not set' },
  ],
};

/** Operators for a rule field — core columns or a typed custom attribute. */
export function opsForSegField(
  field: SegField,
  customFields: CustomField[] = [],
): { op: SegOp; label: string }[] {
  if (isCoreSegField(field)) return SEG_OPS[field];
  const type = customFields.find((f) => f.key === field)?.type ?? 'text';
  return CUSTOM_OPS[type];
}

/** @deprecated Prefer CORE_SEG_FIELDS — kept for call sites that only need cores. */
export const SEG_FIELD_LIST: CoreSegField[] = [...CORE_SEG_FIELDS];

export const STATUS_VALUES = ['active', 'unsubscribed', 'bounced', 'complained', 'invalid'];

/** Ops that take no value, so the value control is hidden for them. */
export function opNeedsValue(op: SegOp): boolean {
  return op !== 'exists' && op !== 'not_exists';
}

function coerceSegValue(
  field: SegField,
  op: SegOp,
  val: string,
  customFields: CustomField[],
): unknown {
  if (!opNeedsValue(op)) return undefined;
  const type = isCoreSegField(field)
    ? null
    : (customFields.find((f) => f.key === field)?.type ?? null);
  if (type === 'number' || op === 'gt' || op === 'lt') {
    const n = Number(val);
    if (Number.isFinite(n) && val.trim() !== '') return n;
  }
  if (type === 'boolean') return val === 'true' || val === '1';
  return val;
}

export function toApiRules(
  rows: SegRule[],
  customFields: CustomField[] = [],
): ApiSegmentRule[] {
  return rows
    .filter((r) => !opNeedsValue(r.op) || r.val !== '')
    .map((r) => ({
      field: fieldToApi(r.field),
      op: r.op,
      ...(opNeedsValue(r.op)
        ? { value: coerceSegValue(r.field, r.op, r.val, customFields) }
        : {}),
    }));
}

export function fromApiRules(rules: ApiSegmentRule[] | undefined): SegRule[] {
  return (rules ?? []).map((r) => ({
    field: apiToField(r.field),
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
    channels:
      s.channels && s.channels.length > 0
        ? (s.channels as ChannelType[])
        : (['email'] as ChannelType[]),
    custom: true,
  };
}
