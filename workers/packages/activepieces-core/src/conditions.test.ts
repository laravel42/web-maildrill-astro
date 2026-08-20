import { describe, expect, it } from 'vitest';
import { BranchOperator, type ConditionGroups } from './flow-model';
import { CONDITION_EVALUATORS, evaluateConditions } from './conditions';

/**
 * Characterization tests for the ported Activepieces operator semantics.
 *
 * These are the contract a published automation depends on: change an evaluator and
 * running workflows silently take different branches. If a re-sync against upstream
 * (see VENDOR.md) breaks one of these, that is a behaviour change to decide on, not a
 * test to update.
 */
const c = (over: Partial<Parameters<(typeof CONDITION_EVALUATORS)[BranchOperator]>[0]> = {}) => ({
  firstValue: '',
  secondValue: undefined,
  caseSensitive: undefined,
  ...over,
});

describe('condition operators', () => {
  it('compares text case-insensitively unless asked otherwise', () => {
    const contains = CONDITION_EVALUATORS[BranchOperator.TEXT_CONTAINS];
    expect(contains(c({ firstValue: 'Hello World', secondValue: 'hello' }))).toBe(true);
    expect(
      contains(c({ firstValue: 'Hello World', secondValue: 'hello', caseSensitive: true })),
    ).toBe(false);
  });

  it('treats a missing or empty value as non-existent', () => {
    const exists = CONDITION_EVALUATORS[BranchOperator.EXISTS];
    expect(exists(c({ firstValue: 'x' }))).toBe(true);
    expect(exists(c({ firstValue: '' }))).toBe(false);
    expect(exists(c({ firstValue: null }))).toBe(false);
    expect(exists(c({ firstValue: undefined }))).toBe(false);
    // Zero and false are values, not absences — a subscriber whose `credits` is 0 exists.
    expect(exists(c({ firstValue: 0 }))).toBe(true);
    expect(exists(c({ firstValue: false }))).toBe(true);
  });

  it('coerces numeric strings, which is what token substitution produces', () => {
    const gt = CONDITION_EVALUATORS[BranchOperator.NUMBER_IS_GREATER_THAN];
    expect(gt(c({ firstValue: '10', secondValue: '9' }))).toBe(true);
    expect(gt(c({ firstValue: '9', secondValue: '10' }))).toBe(false);
    const eq = CONDITION_EVALUATORS[BranchOperator.NUMBER_IS_EQUAL_TO];
    expect(eq(c({ firstValue: '3', secondValue: 3 }))).toBe(true);
  });

  it('parses lists from JSON as well as arrays', () => {
    const listContains = CONDITION_EVALUATORS[BranchOperator.LIST_CONTAINS];
    expect(listContains(c({ firstValue: ['a', 'b'], secondValue: 'B' }))).toBe(true);
    expect(listContains(c({ firstValue: '["a","b"]', secondValue: 'c' }))).toBe(false);
    const empty = CONDITION_EVALUATORS[BranchOperator.LIST_IS_EMPTY];
    expect(empty(c({ firstValue: [] }))).toBe(true);
    expect(empty(c({ firstValue: 'not json' }))).toBe(false);
  });

  it('compares dates and refuses values that are not dates', () => {
    const after = CONDITION_EVALUATORS[BranchOperator.DATE_IS_AFTER];
    expect(after(c({ firstValue: '2026-02-01', secondValue: '2026-01-01' }))).toBe(true);
    expect(after(c({ firstValue: 'yesterday', secondValue: '2026-01-01' }))).toBe(false);
  });
});

describe('evaluateConditions', () => {
  const eq = (first: string, second: string) => ({
    firstValue: first,
    secondValue: second,
    operator: BranchOperator.TEXT_EXACTLY_MATCHES,
  });

  it('ANDs within a group and ORs across groups', () => {
    const groups: ConditionGroups = [[eq('a', 'a'), eq('b', 'b')], [eq('c', 'nope')]];
    expect(evaluateConditions(groups)).toBe(true);
    expect(evaluateConditions([[eq('a', 'a'), eq('b', 'nope')]])).toBe(false);
    expect(evaluateConditions([[eq('a', 'nope')], [eq('b', 'b')]])).toBe(true);
  });

  it('is false when nothing is configured', () => {
    // A condition branch with no conditions must not swallow every run — that would make
    // an unfinished edit behave like "always".
    expect(evaluateConditions([])).toBe(false);
    expect(evaluateConditions([[]])).toBe(false);
  });
});
