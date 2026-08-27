import { describe, expect, it } from 'vitest';
import { layoutFlow, NODE_W } from '@/lib/app/automation-layout';
import type { FlowDefinition, FlowStep } from '@/lib/app/automation-flow';

const piece = (name: string, next: FlowStep | null = null): FlowStep => ({
  name,
  displayName: name,
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

const flowWith = (first: FlowStep | null): FlowDefinition => ({
  trigger: {
    name: 'trigger',
    displayName: 'Trigger',
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

describe('layoutFlow', () => {
  it('stacks a linear flow top-down, one node per step', () => {
    const layout = layoutFlow(flowWith(piece('a', piece('b'))));
    expect(layout.nodes.map((n) => n.id)).toEqual(['trigger', 'a', 'b']);
    const ys = layout.nodes.map((n) => n.y);
    expect(ys[1]).toBeGreaterThan(ys[0]!);
    expect(ys[2]).toBeGreaterThan(ys[1]!);
    // One column: every node shares an x.
    expect(new Set(layout.nodes.map((n) => n.x)).size).toBe(1);
  });

  it('offers a + after the trigger and after every step', () => {
    const layout = layoutFlow(flowWith(piece('a')));
    // trigger→a, and the trailing slot at the end of the chain.
    expect(layout.slots).toHaveLength(2);
    expect(layout.slots.map((s) => s.slot)).toEqual([
      { kind: 'after', stepName: 'trigger' },
      { kind: 'after', stepName: 'a' },
    ]);
  });

  it('offers a + inside an empty branch', () => {
    const router: FlowStep = {
      name: 'branch',
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
      children: [null, null],
      nextAction: null,
    };
    const layout = layoutFlow(flowWith(router));
    const branchSlots = layout.slots.filter((s) => s.slot.kind === 'branch');
    expect(branchSlots).toHaveLength(2);
    expect(layout.labels.map((l) => l.label)).toEqual(['Yes', 'Otherwise']);
    expect(layout.labels[1]?.isFallback).toBe(true);
  });

  it('spreads branch columns so they never overlap', () => {
    const router: FlowStep = {
      name: 'branch',
      displayName: 'Branch',
      valid: true,
      type: 'ROUTER',
      settings: {
        executionType: 'EXECUTE_FIRST_MATCH',
        branches: [
          { branchName: 'Yes', branchType: 'CONDITION', conditions: [[]] },
          { branchName: 'No', branchType: 'CONDITION', conditions: [[]] },
        ],
      },
      children: [piece('yes'), piece('no')],
      nextAction: piece('after'),
    };
    const layout = layoutFlow(flowWith(router));
    const yes = layout.nodes.find((n) => n.id === 'yes')!;
    const no = layout.nodes.find((n) => n.id === 'no')!;
    expect(Math.abs(yes.x - no.x)).toBeGreaterThanOrEqual(NODE_W);
    // The step after the branch rejoins the centre line.
    const trigger = layout.nodes.find((n) => n.id === 'trigger')!;
    const after = layout.nodes.find((n) => n.id === 'after')!;
    expect(after.x).toBeCloseTo(trigger.x, 0);
    expect(after.y).toBeGreaterThan(Math.max(yes.y, no.y));
  });

  it('keeps everything inside the reported canvas box', () => {
    const router: FlowStep = {
      name: 'branch',
      displayName: 'Branch',
      valid: true,
      type: 'ROUTER',
      settings: {
        executionType: 'EXECUTE_FIRST_MATCH',
        branches: [
          { branchName: 'A', branchType: 'CONDITION', conditions: [[]] },
          { branchName: 'B', branchType: 'CONDITION', conditions: [[]] },
          { branchName: 'C', branchType: 'CONDITION', conditions: [[]] },
        ],
      },
      children: [piece('a'), piece('b'), piece('c')],
      nextAction: null,
    };
    const layout = layoutFlow(flowWith(router));
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x + NODE_W).toBeLessThanOrEqual(layout.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(layout.height);
    }
  });

  it('lays out an empty flow as just the trigger', () => {
    const layout = layoutFlow(flowWith(null));
    expect(layout.nodes).toHaveLength(1);
    expect(layout.slots).toHaveLength(1);
    expect(layout.height).toBeGreaterThan(0);
  });
});
