import { and, desc, eq, sql } from 'drizzle-orm';
import {
  db,
  segments,
  subscribers,
  type SegmentRow,
  type SegmentRule,
  type Subscriber,
} from '@maildrill/database';
import { ValidationError, type Channel } from '@maildrill/domain';
import { buildSegmentWhere, clamp } from './rules';

type MatchType = SegmentRow['matchType'];

export interface CreateSegmentInput {
  tenantId: string;
  name: string;
  description?: string | null;
  matchType?: MatchType;
  rules?: SegmentRule[];
  /** Channels the segment is for. Must hold at least one; defaults to email. */
  channels?: Channel[];
}

/**
 * A segment with no channel cannot be used on any tab, so an empty selection
 * is refused rather than quietly defaulted.
 */
function assertChannels(channels: Channel[] | undefined): Channel[] | undefined {
  if (channels === undefined) return undefined;
  const unique = [...new Set(channels)];
  if (unique.length === 0) {
    throw new ValidationError('channels_required: pick at least one channel for this segment.');
  }
  return unique;
}

export async function createSegment(input: CreateSegmentInput): Promise<SegmentRow> {
  const rows = await db
    .insert(segments)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      matchType: input.matchType ?? 'all',
      rules: input.rules ?? [],
      channels: assertChannels(input.channels) ?? ['email'],
    })
    .returning();
  return rows[0]!;
}

export async function getSegment(tenantId: string, id: string): Promise<SegmentRow | null> {
  const rows = await db
    .select()
    .from(segments)
    .where(and(eq(segments.id, id), eq(segments.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listSegments(tenantId: string): Promise<SegmentRow[]> {
  return db
    .select()
    .from(segments)
    .where(eq(segments.tenantId, tenantId))
    .orderBy(desc(segments.createdAt));
}

export async function updateSegment(
  tenantId: string,
  id: string,
  patch: {
    name?: string;
    description?: string | null;
    matchType?: MatchType;
    rules?: SegmentRule[];
    channels?: Channel[];
  },
): Promise<SegmentRow | null> {
  const channels = assertChannels(patch.channels);
  const rows = await db
    .update(segments)
    .set({ ...patch, ...(channels ? { channels } : {}), updatedAt: new Date() })
    .where(and(eq(segments.id, id), eq(segments.tenantId, tenantId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteSegment(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(segments)
    .where(and(eq(segments.id, id), eq(segments.tenantId, tenantId)))
    .returning({ id: segments.id });
  return rows.length > 0;
}

export interface EvaluateOptions {
  limit?: number;
  offset?: number;
}

/** Return subscribers matching an ad-hoc rule set (used for live preview). */
export async function evaluateSegmentRules(
  tenantId: string,
  rules: SegmentRule[],
  matchType: MatchType,
  opts: EvaluateOptions = {},
): Promise<Subscriber[]> {
  const where = buildSegmentWhere(rules, matchType);
  const scope = where
    ? and(eq(subscribers.tenantId, tenantId), where)
    : eq(subscribers.tenantId, tenantId);
  return db
    .select()
    .from(subscribers)
    .where(scope)
    .limit(clamp(opts.limit ?? 100, 1, 1000))
    .offset(Math.max(opts.offset ?? 0, 0));
}

export async function countSegmentRules(
  tenantId: string,
  rules: SegmentRule[],
  matchType: MatchType,
): Promise<number> {
  const where = buildSegmentWhere(rules, matchType);
  const scope = where
    ? and(eq(subscribers.tenantId, tenantId), where)
    : eq(subscribers.tenantId, tenantId);
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(subscribers)
    .where(scope);
  return rows[0]?.c ?? 0;
}

export async function evaluateSegment(
  tenantId: string,
  segmentId: string,
  opts: EvaluateOptions = {},
): Promise<Subscriber[] | null> {
  const seg = await getSegment(tenantId, segmentId);
  if (!seg) return null;
  return evaluateSegmentRules(tenantId, seg.rules, seg.matchType, opts);
}
