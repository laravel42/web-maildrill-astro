import { describe, expect, it } from 'vitest';
import {
  BranchExecutionType,
  BranchOperator,
  FlowActionType,
  FlowTriggerType,
  RouterExecutionType,
  type FlowAction,
  type FlowVersionDefinition,
} from '@maildrill/activepieces-core';
import { validateStructure } from './validation';

/** Publish gate. Structure-only checks; the connection check needs the database. */
function flow(
  first: FlowAction | null,
  triggerOver: Partial<FlowVersionDefinition['trigger']> = {},
) {
  return {
    trigger: {
      name: 'trigger',
      displayName: 'Subscriber created',
      valid: true,
      type: FlowTriggerType.PIECE,
      settings: {
        pieceName: '@maildrill/subscribers',
        pieceVersion: '1.0.0',
        triggerName: 'subscriber_created',
        input: {},
      },
      nextAction: first,
      ...triggerOver,
    },
  } as FlowVersionDefinition;
}

const sendEmail = (name = 'send', over: Record<string, unknown> = {}): FlowAction => ({
  name,
  displayName: 'Send email',
  valid: true,
  type: FlowActionType.PIECE,
  settings: {
    pieceName: '@maildrill/email',
    pieceVersion: '1.0.0',
    actionName: 'send_email',
    input: { subscriberId: '{{trigger.subscriber.id}}', subject: 'Hi', ...over },
  },
  nextAction: null,
});

const wait = (name = 'hold', next: FlowAction | null = null): FlowAction => ({
  name,
  displayName: 'Wait',
  valid: true,
  type: FlowActionType.PIECE,
  settings: {
    pieceName: '@maildrill/logic',
    pieceVersion: '1.0.0',
    actionName: 'delay',
    input: { amount: 2, unit: 'days' },
  },
  nextAction: next,
});

const messages = (def: FlowVersionDefinition) => validateStructure(def).map((e) => e.message);

describe('validateStructure', () => {
  it('accepts a trigger followed by a configured step', () => {
    expect(validateStructure(flow(sendEmail()))).toEqual([]);
  });

  it('requires a trigger', () => {
    const def = flow(sendEmail(), {
      type: FlowTriggerType.EMPTY,
      settings: {} as never,
      displayName: 'Trigger',
    });
    expect(messages(def)[0]).toMatch(/Choose a trigger/);
  });

  it('requires at least one step after the trigger', () => {
    expect(messages(flow(null))).toContain('Add at least one step after the trigger.');
  });

  it('names the required field a step is missing, and the step it belongs to', () => {
    const step = sendEmail('send', { subject: '' });
    const errors = validateStructure(flow(step));
    expect(errors).toEqual([{ stepName: 'send', message: '"Subject" is required.' }]);
  });

  it('rejects a step type that no longer exists', () => {
    const step = sendEmail();
    if (step.type === FlowActionType.PIECE) step.settings.actionName = 'send_by_owl';
    expect(messages(flow(step))[0]).toMatch(/no longer available/);
  });

  it('rejects duplicate step names', () => {
    const second = sendEmail('send');
    const first = sendEmail('send');
    first.nextAction = second;
    expect(messages(flow(first)).some((m) => m.includes('must be unique'))).toBe(true);
  });

  it('rejects a branch whose condition is half-written', () => {
    const router: FlowAction = {
      name: 'branch',
      displayName: 'Opened?',
      valid: true,
      type: FlowActionType.ROUTER,
      settings: {
        executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
        branches: [
          {
            branchName: 'Yes',
            branchType: BranchExecutionType.CONDITION,
            conditions: [
              [
                {
                  firstValue: '{{trigger.subscriber.email}}',
                  secondValue: '',
                  operator: BranchOperator.TEXT_EXACTLY_MATCHES,
                },
              ],
            ],
          },
        ],
      },
      children: [sendEmail()],
      nextAction: null,
    };
    expect(messages(flow(router)).some((m) => m.includes('comparison value'))).toBe(true);
  });

  it('does not demand a comparison value for a single-value operator', () => {
    const router: FlowAction = {
      name: 'branch',
      displayName: 'Has phone?',
      valid: true,
      type: FlowActionType.ROUTER,
      settings: {
        executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
        branches: [
          {
            branchName: 'Yes',
            branchType: BranchExecutionType.CONDITION,
            conditions: [
              [{ firstValue: '{{trigger.subscriber.phone}}', operator: BranchOperator.EXISTS }],
            ],
          },
        ],
      },
      children: [sendEmail()],
      nextAction: null,
    };
    expect(validateStructure(flow(router))).toEqual([]);
  });

  it('refuses a Wait inside a Loop, which cannot be resumed correctly', () => {
    const loop: FlowAction = {
      name: 'each',
      displayName: 'For each',
      valid: true,
      type: FlowActionType.LOOP_ON_ITEMS,
      settings: { items: '{{trigger.subscriber.attributes.orders}}' },
      firstLoopAction: wait('hold', sendEmail()),
      nextAction: null,
    };
    expect(messages(flow(loop))).toContain(
      'A Wait step cannot be used inside a Loop. Move it after the loop.',
    );
  });

  it('accepts a Wait after a Loop', () => {
    const loop: FlowAction = {
      name: 'each',
      displayName: 'For each',
      valid: true,
      type: FlowActionType.LOOP_ON_ITEMS,
      settings: { items: '{{trigger.subscriber.attributes.orders}}' },
      firstLoopAction: sendEmail(),
      nextAction: wait('hold', sendEmail('followup')),
    };
    expect(validateStructure(flow(loop))).toEqual([]);
  });
});
