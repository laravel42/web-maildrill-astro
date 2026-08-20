import { and, or, sql, type SQL } from 'drizzle-orm';
import { subscribers, subscriberStatusEnum, type SegmentRule } from '@maildrill/database';
import { ValidationError } from '@maildrill/domain';

export const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), hi);

/** Map a segment rule field to a SQL expression: core column or JSON attribute. */
function fieldSql(field: string): SQL {
  switch (field) {
    case 'email':
      return sql`${subscribers.email}`;
    case 'name':
      return sql`${subscribers.name}`;
    case 'status':
      return sql`${subscribers.status}`;
    case 'phone':
      return sql`${subscribers.phone}`;
    default:
      return sql`(${subscribers.attributes} ->> ${field})`;
  }
}

/**
 * The same expression as text.
 *
 * Every field but `status` already is text, so this is a no-op for them; for
 * `status` it turns a `subscriber_status` enum into something the substring and
 * numeric paths can touch without the planner refusing the operator outright.
 */
function textFieldSql(field: string): SQL {
  return field === 'status' ? sql`(${subscribers.status})::text` : fieldSql(field);
}

/**
 * Statuses the enum actually holds.
 *
 * A rule comparing `status` to anything else does not return zero rows — it
 * raises 22P02 from the driver, because Postgres has to coerce the literal to
 * the enum before it can compare. `segments.rules` is jsonb validated as
 * `z.unknown()`, so storing one takes a single POST, and until this check
 * existed the segment then answered 500 on the roster, the counts and the
 * preview for as long as the chip stayed selected.
 */
const STATUS_VALUES = new Set<string>(subscriberStatusEnum.enumValues);

/**
 * Text that Postgres can cast to `numeric` without raising.
 *
 * Deliberately narrower than Postgres' own numeric parser (no `NaN`, no
 * `Infinity`, no leading `+`): this is a guard, and a guard that admits an
 * input the cast then treats specially is not one.
 */
const NUMERIC_TEXT_RE = String.raw`^\s*-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?\s*$`;

/**
 * A numeric comparison that cannot throw on the rows it does not match.
 *
 * `attributes ->> 'plan'` is text whatever the segment builder called the
 * field, so `(col)::numeric > 5` raises 22P02 on the first row holding "pro" —
 * a 500 for a segment the user built out of the UI's own field list. CASE, not
 * `col ~ '...' and (col)::numeric > v`: Postgres does not promise to evaluate
 * AND left to right and is free to hoist the cast above the guard, whereas
 * CASE's arm ordering is defined.
 */
function numericCompare(field: string, op: '>' | '<', v: number): SQL {
  const col = textFieldSql(field);
  const cast = sql`(${col})::numeric`;
  const cmp = op === '>' ? sql`${cast} > ${v}` : sql`${cast} < ${v}`;
  return sql`(case when ${col} ~ ${NUMERIC_TEXT_RE} then ${cmp} else false end)`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ops a relation can answer: you are on the list or you are not. */
const MEMBERSHIP_OPS = new Set(['eq', 'neq', 'exists', 'not_exists']);
const CONDITION_OPS = new Set(['eq', 'neq', 'contains', 'gt', 'lt', 'exists', 'not_exists']);
/** Ops that compare `status` to a value, and therefore need an enum member. */
const STATUS_VALUE_OPS = new Set(['eq', 'neq', 'gt', 'lt']);

/**
 * A LIKE pattern that matches the value literally.
 *
 * Without this a rule saying `email contains %` is not a filter, it is "select
 * everything" — and on the 1M-row workspace it is also a full scan, because a
 * leading wildcard the user did not type defeats the trigram index the same way
 * a real one does.
 */
function likeLiteral(v: string): string {
  return `%${v.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Why this rule cannot be compiled to SQL, or null when it can.
 *
 * `segments.rules` is jsonb and the create/update endpoints validate `field` as
 * any string and `value` as unknown, so a stored rule can name an op its field
 * has no SQL for. That was harmless while segments were only evaluated by
 * endpoints that own the whole response; now that a saved segment is a filter
 * on the roster, a caller needs to be told 400 rather than have the page query
 * throw from four frames down and surface as `internal_error`. Asking first
 * keeps the answer a status code.
 */
export function segmentRuleError(rule: SegmentRule): string | null {
  if (rule.field === 'list' || rule.field === 'tag') {
    if (!MEMBERSHIP_OPS.has(rule.op)) {
      return `unsupported op for ${rule.field} rule: ${String(rule.op)}`;
    }
    // A list is matched by id and the id goes into SQL as `::uuid`, so anything
    // else raises 22P02 from the driver — a 500 for what is really bad input.
    if (rule.field === 'list' && (rule.op === 'eq' || rule.op === 'neq')) {
      if (!UUID_RE.test(String(rule.value ?? '')))
        return 'list rule value must be a list id (uuid)';
    }
    return null;
  }
  if (!CONDITION_OPS.has(rule.op)) return `unsupported segment op: ${String(rule.op)}`;
  // `status` is an enum column, so a comparison value has to be a member of it.
  // Anything else is not "matches nothing" — it is 22P02 raised while the page
  // query runs, four frames below anything that could turn it into a status
  // code. Checked here so the caller gets the same readable 400 the list rule
  // above has always given.
  if (rule.field === 'status' && STATUS_VALUE_OPS.has(rule.op)) {
    const v = String(rule.value ?? '');
    if (!STATUS_VALUES.has(v)) {
      return `status rule value must be one of ${[...STATUS_VALUES].join(', ')} (got ${JSON.stringify(rule.value)})`;
    }
  }
  return null;
}

/**
 * Membership predicates. "on list X" and "has tag Y" are relations, not columns,
 * so they compile to EXISTS subqueries rather than comparisons — without these
 * the two things people most want to segment on are unexpressible.
 *
 * `list` matches on list id (stable across renames); `tag` matches on tag name
 * (what someone actually types). eq/neq assert membership; exists/not_exists
 * ask whether the subscriber is on any list / has any tag at all.
 */
function membershipSql(rule: SegmentRule): SQL | null {
  if (rule.field !== 'list' && rule.field !== 'tag') return null;
  const v = String(rule.value ?? '');

  const present =
    rule.field === 'list'
      ? rule.op === 'exists' || rule.op === 'not_exists'
        ? sql`exists (select 1 from list_members lm where lm.subscriber_id = ${subscribers.id})`
        : sql`exists (select 1 from list_members lm where lm.subscriber_id = ${subscribers.id} and lm.list_id = ${v}::uuid)`
      : rule.op === 'exists' || rule.op === 'not_exists'
        ? sql`exists (select 1 from subscriber_tags st where st.subscriber_id = ${subscribers.id})`
        : sql`exists (select 1 from subscriber_tags st join tags t on t.id = st.tag_id where st.subscriber_id = ${subscribers.id} and t.name = ${v})`;

  switch (rule.op) {
    case 'eq':
    case 'exists':
      return present;
    case 'neq':
    case 'not_exists':
      return sql`not ${present}`;
    default:
      throw new ValidationError(`unsupported op for ${rule.field} rule: ${String(rule.op)}`);
  }
}

function conditionSql(rule: SegmentRule): SQL {
  const why = segmentRuleError(rule);
  if (why) throw new ValidationError(why);
  const membership = membershipSql(rule);
  if (membership) return membership;

  const col = fieldSql(rule.field);
  const v = rule.value;
  switch (rule.op) {
    case 'eq':
      return sql`${col} = ${String(v ?? '')}`;
    case 'neq':
      return sql`${col} is distinct from ${String(v ?? '')}`;
    case 'contains':
      // `lower(col) like lower(pattern)`, not `col ilike pattern`, and the
      // difference is the whole cost of the op: migration 0024's trigram GINs
      // are indexes on `lower(email)` and `lower(coalesce(name,''))`, and
      // `email ~~* '%x%'` cannot match an index on `lower(email)`. Emitted as
      // ilike, a zero-match `email contains` segment walked all 1,000,229 rows
      // of the perf tenant — 1,013,052 buffers, 1,058ms, on every page. Written
      // this way it is a bitmap scan: 285 buffers, 3.1ms. `searchCondition` in
      // subscribers.ts already spelled `?q=` this way; the segment path did not.
      return sql`lower(${textFieldSql(rule.field)}) like lower(${likeLiteral(String(v ?? ''))})`;
    case 'gt':
      return typeof v === 'number'
        ? numericCompare(rule.field, '>', v)
        : sql`${col} > ${String(v ?? '')}`;
    case 'lt':
      return typeof v === 'number'
        ? numericCompare(rule.field, '<', v)
        : sql`${col} < ${String(v ?? '')}`;
    case 'exists':
      return sql`${col} is not null`;
    case 'not_exists':
      return sql`${col} is null`;
    default:
      throw new ValidationError(`unsupported segment op: ${String(rule.op)}`);
  }
}

/** Build a WHERE clause from segment rules, combined by match type (all/any). */
export function buildSegmentWhere(rules: SegmentRule[], matchType: 'all' | 'any'): SQL | undefined {
  if (!rules.length) return undefined;
  const conds = rules.map(conditionSql);
  return matchType === 'any' ? or(...conds) : and(...conds);
}
