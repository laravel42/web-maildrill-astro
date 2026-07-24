import { and, or, sql, type SQL } from "drizzle-orm";
import { subscribers, type SegmentRule } from "@maildrill/database";
import { ValidationError } from "@maildrill/domain";

export const clamp = (n: number, lo: number, hi: number): number =>
  Math.min(Math.max(n, lo), hi);

/** Map a segment rule field to a SQL expression: core column or JSON attribute. */
function fieldSql(field: string): SQL {
  switch (field) {
    case "email":
      return sql`${subscribers.email}`;
    case "name":
      return sql`${subscribers.name}`;
    case "status":
      return sql`${subscribers.status}`;
    case "phone":
      return sql`${subscribers.phone}`;
    default:
      return sql`(${subscribers.attributes} ->> ${field})`;
  }
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
  if (rule.field !== "list" && rule.field !== "tag") return null;
  const v = String(rule.value ?? "");

  const present =
    rule.field === "list"
      ? rule.op === "exists" || rule.op === "not_exists"
        ? sql`exists (select 1 from list_members lm where lm.subscriber_id = ${subscribers.id})`
        : sql`exists (select 1 from list_members lm where lm.subscriber_id = ${subscribers.id} and lm.list_id = ${v}::uuid)`
      : rule.op === "exists" || rule.op === "not_exists"
        ? sql`exists (select 1 from subscriber_tags st where st.subscriber_id = ${subscribers.id})`
        : sql`exists (select 1 from subscriber_tags st join tags t on t.id = st.tag_id where st.subscriber_id = ${subscribers.id} and t.name = ${v})`;

  switch (rule.op) {
    case "eq":
    case "exists":
      return present;
    case "neq":
    case "not_exists":
      return sql`not ${present}`;
    default:
      throw new ValidationError(
        `unsupported op for ${rule.field} rule: ${String(rule.op)}`,
      );
  }
}

function conditionSql(rule: SegmentRule): SQL {
  const membership = membershipSql(rule);
  if (membership) return membership;

  const col = fieldSql(rule.field);
  const v = rule.value;
  switch (rule.op) {
    case "eq":
      return sql`${col} = ${String(v ?? "")}`;
    case "neq":
      return sql`${col} is distinct from ${String(v ?? "")}`;
    case "contains":
      return sql`${col} ilike ${`%${String(v ?? "")}%`}`;
    case "gt":
      return typeof v === "number"
        ? sql`(${col})::numeric > ${v}`
        : sql`${col} > ${String(v ?? "")}`;
    case "lt":
      return typeof v === "number"
        ? sql`(${col})::numeric < ${v}`
        : sql`${col} < ${String(v ?? "")}`;
    case "exists":
      return sql`${col} is not null`;
    case "not_exists":
      return sql`${col} is null`;
    default:
      throw new ValidationError(`unsupported segment op: ${String(rule.op)}`);
  }
}

/** Build a WHERE clause from segment rules, combined by match type (all/any). */
export function buildSegmentWhere(
  rules: SegmentRule[],
  matchType: "all" | "any",
): SQL | undefined {
  if (!rules.length) return undefined;
  const conds = rules.map(conditionSql);
  return matchType === "any" ? or(...conds) : and(...conds);
}
