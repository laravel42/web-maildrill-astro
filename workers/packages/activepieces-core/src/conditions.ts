/**
 * Branch condition evaluation — adapted from Activepieces (MIT).
 *
 * Upstream: packages/server/engine/src/lib/handler/router-executor.ts
 * (the `CONDITION_EVALUATORS` table and its helpers).
 *
 * Operator semantics are ported faithfully — they are user-visible, and a published
 * automation's behaviour depends on them. `dayjs` is replaced with `Date` parsing and
 * upstream's `tryCatchSync` is inlined; nothing else changed.
 */
import { BranchOperator, type BranchCondition, type ConditionGroups } from './flow-model';

interface ConditionValues {
  firstValue: unknown;
  secondValue?: unknown;
  caseSensitive?: boolean;
}

function text(value: unknown, { caseSensitive }: ConditionValues): string {
  const asString = typeof value === 'string' ? value : (JSON.stringify(value) ?? '');
  return caseSensitive ? asString : asString.toLowerCase();
}

function parseStringToNumber(value: unknown): number | string {
  const num = Number(value);
  return Number.isNaN(num) ? String(value) : num;
}

function parseJson(input: string): unknown | undefined {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return undefined;
  }
}

function parseListAsArray(input: unknown): unknown[] | undefined {
  if (typeof input === 'string') {
    const data = parseJson(input);
    return Array.isArray(data) ? data : undefined;
  }
  return Array.isArray(input) ? input : undefined;
}

function coerceListAsArray(input: unknown): unknown[] {
  if (typeof input === 'string') {
    const data = parseJson(input);
    if (data === undefined) return [input];
    return Array.isArray(data) ? data : [data];
  }
  return Array.isArray(input) ? input : [input];
}

function isDateLike(value: unknown): value is string | number | Date {
  return typeof value === 'string' || typeof value === 'number' || value instanceof Date;
}

function compareDates(
  { firstValue, secondValue }: ConditionValues,
  compare: (first: number, second: number) => boolean,
): boolean {
  if (!isDateLike(firstValue) || !isDateLike(secondValue)) return false;
  const first = new Date(firstValue).getTime();
  const second = new Date(secondValue).getTime();
  return !Number.isNaN(first) && !Number.isNaN(second) && compare(first, second);
}

const isNil = (v: unknown): v is null | undefined => v === null || v === undefined;

export const CONDITION_EVALUATORS: Record<BranchOperator, (c: ConditionValues) => boolean> = {
  [BranchOperator.TEXT_CONTAINS]: (c) => text(c.firstValue, c).includes(text(c.secondValue, c)),
  [BranchOperator.TEXT_DOES_NOT_CONTAIN]: (c) =>
    !text(c.firstValue, c).includes(text(c.secondValue, c)),
  [BranchOperator.TEXT_EXACTLY_MATCHES]: (c) => text(c.firstValue, c) === text(c.secondValue, c),
  [BranchOperator.TEXT_DOES_NOT_EXACTLY_MATCH]: (c) =>
    text(c.firstValue, c) !== text(c.secondValue, c),
  [BranchOperator.TEXT_STARTS_WITH]: (c) =>
    text(c.firstValue, c).startsWith(text(c.secondValue, c)),
  [BranchOperator.TEXT_DOES_NOT_START_WITH]: (c) =>
    !text(c.firstValue, c).startsWith(text(c.secondValue, c)),
  [BranchOperator.TEXT_ENDS_WITH]: (c) => text(c.firstValue, c).endsWith(text(c.secondValue, c)),
  [BranchOperator.TEXT_DOES_NOT_END_WITH]: (c) =>
    !text(c.firstValue, c).endsWith(text(c.secondValue, c)),
  [BranchOperator.LIST_CONTAINS]: (c) =>
    coerceListAsArray(c.firstValue).some((item) => text(item, c) === text(c.secondValue, c)),
  [BranchOperator.LIST_DOES_NOT_CONTAIN]: (c) =>
    !coerceListAsArray(c.firstValue).some((item) => text(item, c) === text(c.secondValue, c)),
  [BranchOperator.NUMBER_IS_GREATER_THAN]: (c) =>
    parseStringToNumber(c.firstValue) > parseStringToNumber(c.secondValue),
  [BranchOperator.NUMBER_IS_LESS_THAN]: (c) =>
    parseStringToNumber(c.firstValue) < parseStringToNumber(c.secondValue),
  // Loose equality is upstream behaviour: it lets "3" match 3 after one side has been
  // coerced to a string by token substitution.
  // eslint-disable-next-line eqeqeq
  [BranchOperator.NUMBER_IS_EQUAL_TO]: (c) =>
    parseStringToNumber(c.firstValue) == parseStringToNumber(c.secondValue),
  [BranchOperator.BOOLEAN_IS_TRUE]: (c) => !!c.firstValue,
  [BranchOperator.BOOLEAN_IS_FALSE]: (c) => !c.firstValue,
  [BranchOperator.DATE_IS_AFTER]: (c) => compareDates(c, (a, b) => a > b),
  [BranchOperator.DATE_IS_EQUAL]: (c) => compareDates(c, (a, b) => a === b),
  [BranchOperator.DATE_IS_BEFORE]: (c) => compareDates(c, (a, b) => a < b),
  [BranchOperator.LIST_IS_EMPTY]: (c) => parseListAsArray(c.firstValue)?.length === 0,
  [BranchOperator.LIST_IS_NOT_EMPTY]: (c) => (parseListAsArray(c.firstValue)?.length ?? 0) !== 0,
  [BranchOperator.EXISTS]: (c) => !isNil(c.firstValue) && c.firstValue !== '',
  [BranchOperator.DOES_NOT_EXIST]: (c) => isNil(c.firstValue) || c.firstValue === '',
};

function toConditionValues(condition: BranchCondition): ConditionValues {
  return {
    firstValue: condition.firstValue,
    secondValue: condition.secondValue,
    caseSensitive: condition.caseSensitive,
  };
}

/**
 * `[[a, b], [c]]` → `(a AND b) OR c`. An empty group list is false: a condition branch
 * with nothing configured must not swallow every run.
 */
export function evaluateConditions(conditionGroups: ConditionGroups): boolean {
  return conditionGroups.some(
    (group) =>
      group.length > 0 &&
      group.every((condition) => {
        const evaluate = CONDITION_EVALUATORS[condition.operator];
        if (!evaluate) return false;
        return evaluate(toConditionValues(condition));
      }),
  );
}
