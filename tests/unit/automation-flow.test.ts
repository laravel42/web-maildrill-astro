import { describe, expect, it } from 'vitest';
import {
  addBranch,
  allSteps,
  duplicateStep,
  EMPTY_FLOW,
  insertStep,
  moveStep,
  nextStepName,
  outlineRows,
  removeBranch,
  removeStep,
  stepsBefore,
  updateStep,
  updateTrigger,
  type FlowDefinition,
  type FlowStep,
} from '@/lib/app/automation-flow';

/** Flow editing is pure, so these exercise the real operations the composer calls. */

const piece = (name: string, next: FlowStep | null = null): FlowStep => ({
  name,
  displayName: name.replace(/_/g, ' '),
  valid: true,
  type: 'PIECE',
  settings: {
    pieceName: '@maildrill/email',
    pieceVersion: '1.0.0',
    actionName: 'send_email',
    input: {},
  },
  nextAction: next,
});

const router = (name: string, children: (FlowStep | null)[]): FlowStep => ({
  name,
  displayName: 'Branch',
  valid: true,
  type: 'ROUTER',
  settings: {
    executionType: 'EXECUTE_FIRST_MATCH',
    branches: [
      { branchName: 'Yes', branchType: 'CONDITION', conditions: [[]] },
      { branchName: 'Otherwise', branchType: 'FALLBACK', conditions: [] },
    ],
  },
  children,
  nextAction: null,
});

const flowWith = (first: FlowStep | null): FlowDefinition => ({
  trigger: {
    name: 'trigger',
    displayName: 'Subscriber created',
    valid: true,
    type: 'PIECE',
    settings: {
      pieceName: '@maildrill/subscribers',
      pieceVersion: '1.0.0',
      triggerName: 'subscriber_created',
      input: {},
    },
    nextAction: first,
  },
});

const names = (flow: FlowDefinition) => allSteps(flow.trigger.nextAction).map((s) => s.name);

describe('nextStepName', () => {
  it('slugifies a display name into an identifier the resolver can address', () => {
    expect(nextStepName(EMPTY_FLOW, 'Send email')).toBe('send_email');
    expect(nextStepName(EMPTY_FLOW, 'Wait 2 days!')).toBe('wait_2_days');
  });

  it('never collides with an existing step', () => {
    const flow = flowWith(piece('send_email'));
    expect(nextStepName(flow, 'Send email')).toBe('send_email_2');
  });

  it('never starts with a digit or ends up empty', () => {
    expect(nextStepName(EMPTY_FLOW, '2 days')).toBe('s2_days');
    expect(nextStepName(EMPTY_FLOW, '!!!')).toBe('step');
  });
});

describe('insertStep', () => {
  it('splices after a step without losing the tail', () => {
    const flow = flowWith(piece('a', piece('c')));
    const next = insertStep(flow, { kind: 'after', stepName: 'a' }, piece('b'));
    expect(names(next)).toEqual(['a', 'b', 'c']);
  });

  it('inserts directly after the trigger', () => {
    const flow = flowWith(piece('a'));
    const next = insertStep(flow, { kind: 'after', stepName: 'trigger' }, piece('first'));
    expect(names(next)).toEqual(['first', 'a']);
  });

  it('inserts at the head of a branch', () => {
    const flow = flowWith(router('branch', [piece('yes'), null]));
    const next = insertStep(
      flow,
      { kind: 'branch', routerName: 'branch', branchIndex: 0 },
      piece('new'),
    );
    const branch = allSteps(next.trigger.nextAction).find((s) => s.name === 'branch');
    expect(branch?.type).toBe('ROUTER');
    expect(names(next)).toEqual(['branch', 'new', 'yes']);
  });

  it('leaves the flow untouched when the slot points at nothing', () => {
    const flow = flowWith(piece('a'));
    expect(insertStep(flow, { kind: 'after', stepName: 'ghost' }, piece('b'))).toBe(flow);
  });

  it('does not mutate the input', () => {
    const flow = flowWith(piece('a'));
    const before = JSON.stringify(flow);
    insertStep(flow, { kind: 'after', stepName: 'a' }, piece('b'));
    expect(JSON.stringify(flow)).toBe(before);
  });
});

describe('removeStep', () => {
  it('closes the gap it leaves', () => {
    const flow = flowWith(piece('a', piece('b', piece('c'))));
    expect(names(removeStep(flow, 'b'))).toEqual(['a', 'c']);
  });

  it('removes from inside a branch', () => {
    const flow = flowWith(router('branch', [piece('yes', piece('then')), null]));
    expect(names(removeStep(flow, 'yes'))).toEqual(['branch', 'then']);
  });

  it('takes a router’s children with it', () => {
    const flow = flowWith(router('branch', [piece('yes'), piece('no')]));
    expect(names(removeStep(flow, 'branch'))).toEqual([]);
  });
});

describe('duplicateStep', () => {
  it('inserts a copy under the original with fresh names', () => {
    const flow = flowWith(piece('send_email', piece('after')));
    const next = duplicateStep(flow, 'send_email');
    expect(names(next)).toEqual(['send_email', 'send_email_copy', 'after']);
  });

  it('gives every nested step its own name', () => {
    const flow = flowWith(router('branch', [piece('yes'), piece('no')]));
    const next = duplicateStep(flow, 'branch');
    const all = names(next);
    // No duplicates: two steps sharing a name would make `{{steps.x}}` ambiguous.
    expect(new Set(all).size).toBe(all.length);
    expect(all).toHaveLength(6);
  });
});

describe('moveStep', () => {
  it('swaps with the neighbour above and below', () => {
    const flow = flowWith(piece('a', piece('b', piece('c'))));
    expect(names(moveStep(flow, 'b', 'up'))).toEqual(['b', 'a', 'c']);
    expect(names(moveStep(flow, 'b', 'down'))).toEqual(['a', 'c', 'b']);
  });

  it('is a no-op at the ends of a chain', () => {
    const flow = flowWith(piece('a', piece('b')));
    expect(names(moveStep(flow, 'a', 'up'))).toEqual(['a', 'b']);
    expect(names(moveStep(flow, 'b', 'down'))).toEqual(['a', 'b']);
  });

  it('reorders inside a branch without escaping it', () => {
    const flow = flowWith(router('branch', [piece('x', piece('y')), null]));
    const next = moveStep(flow, 'y', 'up');
    expect(names(next)).toEqual(['branch', 'y', 'x']);
  });
});

describe('stepsBefore', () => {
  it('returns only what has already run', () => {
    const flow = flowWith(piece('a', piece('b', piece('c'))));
    expect(stepsBefore(flow, 'c').map((s) => s.name)).toEqual(['a', 'b']);
    expect(stepsBefore(flow, 'a')).toEqual([]);
  });
});

describe('branches', () => {
  it('adds a path before the fallback and keeps children aligned', () => {
    const flow = flowWith(router('branch', [piece('yes'), piece('other')]));
    const next = addBranch(flow, 'branch');
    const step = allSteps(next.trigger.nextAction).find((s) => s.name === 'branch');
    if (step?.type !== 'ROUTER') throw new Error('expected a router');
    expect(step.settings.branches.map((b) => b.branchType)).toEqual([
      'CONDITION',
      'CONDITION',
      'FALLBACK',
    ]);
    expect(step.children).toHaveLength(3);
    // The fallback kept its own child rather than inheriting the new path's.
    expect(step.children[2]?.name).toBe('other');
    expect(step.children[1]).toBeNull();
  });

  it('removes a path and its column together', () => {
    const flow = flowWith(router('branch', [piece('yes'), piece('other')]));
    const next = removeBranch(flow, 'branch', 0);
    const step = allSteps(next.trigger.nextAction).find((s) => s.name === 'branch');
    if (step?.type !== 'ROUTER') throw new Error('expected a router');
    expect(step.settings.branches).toHaveLength(1);
    expect(step.children).toHaveLength(1);
    expect(step.children[0]?.name).toBe('other');
  });
});

describe('updateStep / updateTrigger', () => {
  it('patches one step and leaves the rest alone', () => {
    const flow = flowWith(piece('a', piece('b')));
    const next = updateStep(flow, 'a', (step) => ({ ...step, displayName: 'Renamed' }));
    expect(allSteps(next.trigger.nextAction)[0]?.displayName).toBe('Renamed');
    expect(allSteps(next.trigger.nextAction)[1]?.displayName).toBe('b');
  });

  it('keeps the chain when the trigger is replaced', () => {
    const flow = flowWith(piece('a'));
    const next = updateTrigger(flow, (trigger) => ({
      ...trigger,
      displayName: 'Campaign delivered',
      settings: {
        pieceName: '@maildrill/campaigns',
        pieceVersion: '1.0.0',
        triggerName: 'campaign_delivered',
        input: {},
      },
    }));
    expect(next.trigger.displayName).toBe('Campaign delivered');
    expect(names(next)).toEqual(['a']);
  });
});

describe('outlineRows', () => {
  it('lists the trigger then the chain in execution order', () => {
    const rows = outlineRows(flowWith(piece('a', piece('b'))));
    expect(rows.map((r) => [r.kind, r.label, r.depth])).toEqual([
      ['trigger', 'Subscriber created', 0],
      ['step', 'a', 0],
      ['step', 'b', 0],
    ]);
  });

  it('nests each branch path and its steps under the router', () => {
    const rows = outlineRows(flowWith(router('branch', [piece('yes'), piece('other')])));
    expect(rows.map((r) => `${'  '.repeat(r.depth)}${r.kind}:${r.label}`)).toEqual([
      'trigger:Subscriber created',
      'step:Branch',
      '  branch:Yes',
      '    step:yes',
      '  branch:Otherwise',
      '    step:other',
    ]);
    // A fallback path is flagged so it can read differently from a condition.
    expect(rows.find((r) => r.label === 'Otherwise')?.isFallback).toBe(true);
    expect(rows.find((r) => r.label === 'Yes')?.isFallback).toBe(false);
  });

  it('points a branch row at its router, so selecting it opens the branch settings', () => {
    const rows = outlineRows(flowWith(router('branch', [piece('yes'), null])));
    expect(rows.find((r) => r.kind === 'branch')?.stepName).toBe('branch');
  });

  it('gives every row a unique key', () => {
    const rows = outlineRows(flowWith(router('branch', [piece('yes'), piece('no')])));
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it('is just the trigger when nothing has been added', () => {
    expect(outlineRows(flowWith(null)).map((r) => r.kind)).toEqual(['trigger']);
  });
});
