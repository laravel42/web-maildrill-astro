/**
 * Flow model + editing operations + canvas layout.
 *
 * Deliberately pure and dependency-free so it can be unit-tested without React and reused
 * by the canvas, the inspector and the validator alike. The shapes mirror the backend's
 * Activepieces-derived model exactly (`@maildrill/activepieces-core`) — the wire format is
 * the same object, so nothing translates between client and server.
 */

export type FlowActionType = 'PIECE' | 'ROUTER' | 'LOOP_ON_ITEMS';
export type FlowTriggerType = 'PIECE' | 'EMPTY';

export type BranchOperator =
  | 'TEXT_CONTAINS'
  | 'TEXT_DOES_NOT_CONTAIN'
  | 'TEXT_EXACTLY_MATCHES'
  | 'TEXT_DOES_NOT_EXACTLY_MATCH'
  | 'TEXT_START_WITH'
  | 'TEXT_DOES_NOT_START_WITH'
  | 'TEXT_ENDS_WITH'
  | 'TEXT_DOES_NOT_END_WITH'
  | 'NUMBER_IS_GREATER_THAN'
  | 'NUMBER_IS_LESS_THAN'
  | 'NUMBER_IS_EQUAL_TO'
  | 'BOOLEAN_IS_TRUE'
  | 'BOOLEAN_IS_FALSE'
  | 'DATE_IS_BEFORE'
  | 'DATE_IS_EQUAL'
  | 'DATE_IS_AFTER'
  | 'LIST_CONTAINS'
  | 'LIST_DOES_NOT_CONTAIN'
  | 'LIST_IS_EMPTY'
  | 'LIST_IS_NOT_EMPTY'
  | 'EXISTS'
  | 'DOES_NOT_EXIST';

/** Operators that read only the left-hand value; the editor hides the second input. */
export const SINGLE_VALUE_OPERATORS: readonly BranchOperator[] = [
  'EXISTS',
  'DOES_NOT_EXIST',
  'BOOLEAN_IS_TRUE',
  'BOOLEAN_IS_FALSE',
  'LIST_IS_EMPTY',
  'LIST_IS_NOT_EMPTY',
];

/** Grouped for the operator menu, in the order a marketer thinks about them. */
export const OPERATOR_GROUPS: { label: string; operators: BranchOperator[] }[] = [
  {
    label: 'Text',
    operators: [
      'TEXT_EXACTLY_MATCHES',
      'TEXT_DOES_NOT_EXACTLY_MATCH',
      'TEXT_CONTAINS',
      'TEXT_DOES_NOT_CONTAIN',
      'TEXT_START_WITH',
      'TEXT_DOES_NOT_START_WITH',
      'TEXT_ENDS_WITH',
      'TEXT_DOES_NOT_END_WITH',
    ],
  },
  {
    label: 'Number',
    operators: ['NUMBER_IS_EQUAL_TO', 'NUMBER_IS_GREATER_THAN', 'NUMBER_IS_LESS_THAN'],
  },
  { label: 'Date', operators: ['DATE_IS_BEFORE', 'DATE_IS_EQUAL', 'DATE_IS_AFTER'] },
  {
    label: 'List',
    operators: ['LIST_CONTAINS', 'LIST_DOES_NOT_CONTAIN', 'LIST_IS_EMPTY', 'LIST_IS_NOT_EMPTY'],
  },
  {
    label: 'Presence',
    operators: ['EXISTS', 'DOES_NOT_EXIST', 'BOOLEAN_IS_TRUE', 'BOOLEAN_IS_FALSE'],
  },
];

export const OPERATOR_LABELS: Record<BranchOperator, string> = {
  TEXT_EXACTLY_MATCHES: 'is exactly',
  TEXT_DOES_NOT_EXACTLY_MATCH: 'is not',
  TEXT_CONTAINS: 'contains',
  TEXT_DOES_NOT_CONTAIN: 'does not contain',
  TEXT_START_WITH: 'starts with',
  TEXT_DOES_NOT_START_WITH: 'does not start with',
  TEXT_ENDS_WITH: 'ends with',
  TEXT_DOES_NOT_END_WITH: 'does not end with',
  NUMBER_IS_EQUAL_TO: 'equals',
  NUMBER_IS_GREATER_THAN: 'is greater than',
  NUMBER_IS_LESS_THAN: 'is less than',
  DATE_IS_BEFORE: 'is before',
  DATE_IS_EQUAL: 'is on',
  DATE_IS_AFTER: 'is after',
  LIST_CONTAINS: 'includes',
  LIST_DOES_NOT_CONTAIN: 'does not include',
  LIST_IS_EMPTY: 'is empty',
  LIST_IS_NOT_EMPTY: 'is not empty',
  EXISTS: 'exists',
  DOES_NOT_EXIST: 'does not exist',
  BOOLEAN_IS_TRUE: 'is true',
  BOOLEAN_IS_FALSE: 'is false',
};

export interface BranchCondition {
  firstValue: string;
  secondValue?: string;
  caseSensitive?: boolean;
  operator: BranchOperator;
}

/** `[[a, b], [c]]` means `(a AND b) OR c` — the shape the engine evaluates. */
export type ConditionGroups = BranchCondition[][];

export interface RouterBranch {
  branchName: string;
  branchType: 'CONDITION' | 'FALLBACK';
  conditions: ConditionGroups;
}

export interface PieceStepSettings {
  pieceName: string;
  pieceVersion: string;
  actionName: string;
  input: Record<string, unknown>;
  connectionId?: string | null;
  errorHandling?: { continueOnFailure?: boolean; retryOnFailure?: boolean };
}

export interface RouterSettings {
  executionType: 'EXECUTE_FIRST_MATCH' | 'EXECUTE_ALL_MATCH';
  branches: RouterBranch[];
}

export interface LoopSettings {
  items: string;
}

interface StepBase {
  name: string;
  displayName: string;
  valid: boolean;
  skip?: boolean;
}

export interface PieceStep extends StepBase {
  type: 'PIECE';
  settings: PieceStepSettings;
  nextAction?: FlowStep | null;
}

export interface RouterStep extends StepBase {
  type: 'ROUTER';
  settings: RouterSettings;
  children: (FlowStep | null)[];
  nextAction?: FlowStep | null;
}

export interface LoopStep extends StepBase {
  type: 'LOOP_ON_ITEMS';
  settings: LoopSettings;
  firstLoopAction?: FlowStep | null;
  nextAction?: FlowStep | null;
}

export type FlowStep = PieceStep | RouterStep | LoopStep;

export interface FlowTrigger extends StepBase {
  type: FlowTriggerType;
  settings:
    | {
        pieceName: string;
        pieceVersion: string;
        triggerName: string;
        input: Record<string, unknown>;
      }
    | Record<string, never>;
  nextAction?: FlowStep | null;
}

export interface FlowDefinition {
  trigger: FlowTrigger;
}

export const EMPTY_FLOW: FlowDefinition = {
  trigger: {
    name: 'trigger',
    displayName: 'Choose a trigger',
    valid: false,
    type: 'EMPTY',
    settings: {},
    nextAction: null,
  },
};

// --- traversal ---------------------------------------------------------------------

export function allSteps(root: FlowStep | null | undefined): FlowStep[] {
  const out: FlowStep[] = [];
  const visit = (step: FlowStep | null | undefined): void => {
    if (!step) return;
    out.push(step);
    if (step.type === 'LOOP_ON_ITEMS') visit(step.firstLoopAction);
    if (step.type === 'ROUTER') step.children.forEach(visit);
    visit(step.nextAction);
  };
  visit(root);
  return out;
}

export function findStep(flow: FlowDefinition, name: string): FlowStep | FlowTrigger | undefined {
  if (flow.trigger.name === name) return flow.trigger;
  return allSteps(flow.trigger.nextAction).find((s) => s.name === name);
}

/** Steps that execute strictly before `name`, so the data picker offers only real data. */
export function stepsBefore(flow: FlowDefinition, name: string): FlowStep[] {
  const before: FlowStep[] = [];
  let found = false;
  const walk = (step: FlowStep | null | undefined): void => {
    if (!step || found) return;
    if (step.name === name) {
      found = true;
      return;
    }
    before.push(step);
    if (step.type === 'LOOP_ON_ITEMS') walk(step.firstLoopAction);
    if (step.type === 'ROUTER') step.children.forEach(walk);
    if (found) return;
    walk(step.nextAction);
  };
  walk(flow.trigger.nextAction);
  return before;
}

/** A lowercase identifier the expression resolver can address, unique in this flow. */
export function nextStepName(flow: FlowDefinition, base: string): string {
  const taken = new Set([
    flow.trigger.name,
    ...allSteps(flow.trigger.nextAction).map((s) => s.name),
  ]);
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^([^a-z])/, 's$1') || 'step';
  if (!taken.has(slug)) return slug;
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${slug}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${slug}_${Date.now()}`;
}

// --- editing -----------------------------------------------------------------------

/** Where a new step goes. Every `+` button on the canvas carries one of these. */
export type SlotRef =
  | { kind: 'after'; stepName: string }
  | { kind: 'branch'; routerName: string; branchIndex: number }
  | { kind: 'loop'; loopName: string };

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function insertStep(flow: FlowDefinition, slot: SlotRef, step: FlowStep): FlowDefinition {
  const next = clone(flow);
  const inserted = clone(step);

  if (slot.kind === 'after') {
    const host =
      slot.stepName === next.trigger.name
        ? next.trigger
        : allSteps(next.trigger.nextAction).find((s) => s.name === slot.stepName);
    if (!host) return flow;
    inserted.nextAction = host.nextAction ?? null;
    host.nextAction = inserted;
    return next;
  }

  if (slot.kind === 'branch') {
    const router = allSteps(next.trigger.nextAction).find(
      (s): s is RouterStep => s.name === slot.routerName && s.type === 'ROUTER',
    );
    if (!router) return flow;
    inserted.nextAction = router.children[slot.branchIndex] ?? null;
    router.children[slot.branchIndex] = inserted;
    return next;
  }

  const loop = allSteps(next.trigger.nextAction).find(
    (s): s is LoopStep => s.name === slot.loopName && s.type === 'LOOP_ON_ITEMS',
  );
  if (!loop) return flow;
  inserted.nextAction = loop.firstLoopAction ?? null;
  loop.firstLoopAction = inserted;
  return next;
}

/** Remove a step, splicing its `nextAction` into the hole it leaves. */
export function removeStep(flow: FlowDefinition, name: string): FlowDefinition {
  const next = clone(flow);

  const detach = (step: FlowStep | null | undefined): FlowStep | null | undefined => {
    if (!step) return step;
    if (step.name === name) return step.nextAction ?? null;
    step.nextAction = detach(step.nextAction) ?? null;
    if (step.type === 'LOOP_ON_ITEMS') step.firstLoopAction = detach(step.firstLoopAction) ?? null;
    if (step.type === 'ROUTER') {
      step.children = step.children.map((child) => detach(child) ?? null);
    }
    return step;
  };

  next.trigger.nextAction = detach(next.trigger.nextAction) ?? null;
  return next;
}

/** Copy a step (and, for a router/loop, its children) in beneath the original. */
export function duplicateStep(flow: FlowDefinition, name: string): FlowDefinition {
  const source = allSteps(flow.trigger.nextAction).find((s) => s.name === name);
  if (!source) return flow;

  const copy = clone(source);
  copy.nextAction = null;

  /*
   * Every nested step needs a fresh name. Step names are the identity the expression
   * resolver keys on, so two steps sharing one would make `{{steps.send_email.output}}`
   * ambiguous — and the publish gate would reject the flow.
   *
   * Names are reserved in a local set as they are handed out, because the copies are not
   * in the flow yet and `nextStepName` can only see what is.
   */
  const taken = new Set([
    flow.trigger.name,
    ...allSteps(flow.trigger.nextAction).map((s) => s.name),
  ]);
  const reserve = (base: string): string => {
    const candidate = nextStepName({ trigger: { ...flow.trigger, nextAction: null } }, base);
    let final = candidate;
    for (let i = 2; taken.has(final); i += 1) final = `${candidate}_${i}`;
    taken.add(final);
    return final;
  };

  const rename = (step: FlowStep): void => {
    step.name = reserve(`${source.name}_copy`);
    if (step.type === 'LOOP_ON_ITEMS' && step.firstLoopAction) rename(step.firstLoopAction);
    if (step.type === 'ROUTER') step.children.forEach((child) => child && rename(child));
    if (step.nextAction) rename(step.nextAction);
  };
  rename(copy);

  return insertStep(flow, { kind: 'after', stepName: name }, copy);
}

export function updateStep(
  flow: FlowDefinition,
  name: string,
  patch: (step: FlowStep) => FlowStep,
): FlowDefinition {
  const next = clone(flow);
  const walk = (step: FlowStep | null | undefined): FlowStep | null | undefined => {
    if (!step) return step;
    const current = step.name === name ? patch(step) : step;
    current.nextAction = walk(current.nextAction) ?? null;
    if (current.type === 'LOOP_ON_ITEMS') {
      current.firstLoopAction = walk(current.firstLoopAction) ?? null;
    }
    if (current.type === 'ROUTER') current.children = current.children.map((c) => walk(c) ?? null);
    return current;
  };
  next.trigger.nextAction = walk(next.trigger.nextAction) ?? null;
  return next;
}

export function updateTrigger(
  flow: FlowDefinition,
  patch: (trigger: FlowTrigger) => FlowTrigger,
): FlowDefinition {
  const next = clone(flow);
  const nextAction = next.trigger.nextAction ?? null;
  next.trigger = { ...patch(next.trigger), nextAction };
  return next;
}

/**
 * Swap a step with its neighbour in the same chain.
 *
 * Only within a chain: moving a step across a branch boundary would silently change which
 * conditions guard it, which is not something a "move up" arrow should do.
 */
export function moveStep(
  flow: FlowDefinition,
  name: string,
  direction: 'up' | 'down',
): FlowDefinition {
  const next = clone(flow);

  const inChain = (headOwner: { nextAction?: FlowStep | null }): boolean => {
    const chain: FlowStep[] = [];
    let cursor = headOwner.nextAction ?? null;
    while (cursor) {
      chain.push(cursor);
      cursor = cursor.nextAction ?? null;
    }
    const index = chain.findIndex((s) => s.name === name);
    if (index === -1) return false;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= chain.length) return true; // found, but at the edge
    [chain[index], chain[target]] = [chain[target]!, chain[index]!];
    // Relink the chain in its new order.
    headOwner.nextAction = chain[0] ?? null;
    chain.forEach((step, i) => {
      step.nextAction = chain[i + 1] ?? null;
    });
    return true;
  };

  const owners: { nextAction?: FlowStep | null }[] = [next.trigger];
  for (const step of allSteps(next.trigger.nextAction)) {
    if (step.type === 'ROUTER') {
      step.children.forEach((_, i) => {
        owners.push({
          get nextAction() {
            return step.children[i] ?? null;
          },
          set nextAction(value: FlowStep | null | undefined) {
            step.children[i] = value ?? null;
          },
        });
      });
    }
    if (step.type === 'LOOP_ON_ITEMS') {
      owners.push({
        get nextAction() {
          return step.firstLoopAction ?? null;
        },
        set nextAction(value: FlowStep | null | undefined) {
          step.firstLoopAction = value ?? null;
        },
      });
    }
  }

  for (const owner of owners) if (inChain(owner)) break;
  return next;
}

/** Add a condition path to a router, keeping `children` positionally aligned. */
export function addBranch(flow: FlowDefinition, routerName: string): FlowDefinition {
  return updateStep(flow, routerName, (step) => {
    if (step.type !== 'ROUTER') return step;
    const fallbackIndex = step.settings.branches.findIndex((b) => b.branchType === 'FALLBACK');
    const branch: RouterBranch = {
      branchName: `Path ${step.settings.branches.length}`,
      branchType: 'CONDITION',
      conditions: [[{ firstValue: '', operator: 'TEXT_EXACTLY_MATCHES', secondValue: '' }]],
    };
    // A fallback is "everything else", so it stays last.
    const at = fallbackIndex === -1 ? step.settings.branches.length : fallbackIndex;
    step.settings.branches.splice(at, 0, branch);
    step.children.splice(at, 0, null);
    return step;
  });
}

export function removeBranch(
  flow: FlowDefinition,
  routerName: string,
  branchIndex: number,
): FlowDefinition {
  return updateStep(flow, routerName, (step) => {
    if (step.type !== 'ROUTER' || step.settings.branches.length <= 1) return step;
    step.settings.branches.splice(branchIndex, 1);
    step.children.splice(branchIndex, 1);
    return step;
  });
}

// --- outline ------------------------------------------------------------------------

/**
 * A flat, indented view of the flow for the editor's sidebar.
 *
 * The canvas is the workspace; this is the map. A journey with a dozen steps and two
 * branches does not fit on screen, so the outline is what answers "what is in this
 * automation", "where am I", and "which step is the broken one" without panning.
 */
export interface OutlineRow {
  /** Stable key, and the step the row selects (branch rows select their router). */
  id: string;
  kind: 'trigger' | 'step' | 'branch';
  stepName: string;
  label: string;
  /** Nesting level; branch children sit one level under their path label. */
  depth: number;
  type: FlowActionType | 'TRIGGER';
  pieceName: string | null;
  /** Branch rows only — an unconditional "everything else" path reads differently. */
  isFallback?: boolean;
}

export function outlineRows(flow: FlowDefinition): OutlineRow[] {
  const rows: OutlineRow[] = [];
  const triggerSettings = flow.trigger.settings as { pieceName?: string };

  rows.push({
    id: `trigger:${flow.trigger.name}`,
    kind: 'trigger',
    stepName: flow.trigger.name,
    label: flow.trigger.displayName,
    depth: 0,
    type: 'TRIGGER',
    pieceName: triggerSettings.pieceName ?? null,
  });

  const walk = (step: FlowStep | null | undefined, depth: number): void => {
    let current = step;
    while (current) {
      rows.push({
        id: `step:${current.name}`,
        kind: 'step',
        stepName: current.name,
        label: current.displayName,
        depth,
        type: current.type,
        pieceName: current.type === 'PIECE' ? current.settings.pieceName : null,
      });

      if (current.type === 'ROUTER') {
        const router = current;
        router.settings.branches.forEach((branch, index) => {
          rows.push({
            id: `branch:${router.name}:${index}`,
            kind: 'branch',
            stepName: router.name,
            label: branch.branchName,
            depth: depth + 1,
            type: 'ROUTER',
            pieceName: null,
            isFallback: branch.branchType === 'FALLBACK',
          });
          walk(router.children[index] ?? null, depth + 2);
        });
      }

      if (current.type === 'LOOP_ON_ITEMS') {
        const loop = current;
        rows.push({
          id: `branch:${loop.name}:body`,
          kind: 'branch',
          stepName: loop.name,
          label: 'For each item',
          depth: depth + 1,
          type: 'LOOP_ON_ITEMS',
          pieceName: null,
        });
        walk(loop.firstLoopAction ?? null, depth + 2);
      }

      current = current.nextAction ?? null;
    }
  };

  walk(flow.trigger.nextAction, 0);
  return rows;
}
