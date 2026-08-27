import {
  defineAction,
  definePiece,
  evaluateConditions,
  Property,
  type ConditionGroups,
} from '@maildrill/activepieces-core';
import { ValidationError } from '@maildrill/domain';
import type { MaildrillPieceContext } from './context';

/**
 * Logic pieces: waiting, filtering and stopping.
 *
 * Branching is NOT here — it is the `ROUTER` action type from the Activepieces flow model,
 * handled by the executor itself, because a branch owns child steps and a piece cannot.
 */

const DURATION_UNITS = [
  { label: 'Seconds', value: 'seconds' },
  { label: 'Minutes', value: 'minutes' },
  { label: 'Hours', value: 'hours' },
  { label: 'Days', value: 'days' },
];

const UNIT_MS: Record<string, number> = {
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

/** A year. Beyond this a "delay" is a scheduling mistake, not an intention. */
const MAX_DELAY_MS = 365 * 86_400_000;

export function delayUntil(now: Date, amount: number, unit: string): Date {
  const per = UNIT_MS[unit];
  if (!per) throw new ValidationError(`unknown duration unit "${unit}"`);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new ValidationError('wait duration must be a positive number');
  }
  const ms = Math.min(amount * per, MAX_DELAY_MS);
  return new Date(now.getTime() + ms);
}

export function parseConditionGroups(value: unknown): ConditionGroups {
  if (Array.isArray(value)) return value as ConditionGroups;
  if (typeof value === 'string' && value.trim().length > 0) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed as ConditionGroups;
    } catch {
      throw new ValidationError('conditions must be a JSON array of condition groups');
    }
  }
  return [];
}

export const logicPiece = definePiece<MaildrillPieceContext>({
  name: '@maildrill/logic',
  displayName: 'Logic',
  description: 'Wait, filter and stop.',
  version: '1.0.0',
  accent: '--text3',
  triggers: [],
  actions: [
    defineAction<MaildrillPieceContext>({
      name: 'delay',
      displayName: 'Wait',
      description: 'Pause the automation for a period, then continue.',
      category: 'Logic',
      accent: '--text3',
      props: {
        amount: Property.Number({ displayName: 'Wait for', required: true, defaultValue: 1 }),
        unit: Property.StaticDropdown({
          displayName: 'Unit',
          required: true,
          defaultValue: 'days',
          options: DURATION_UNITS,
        }),
      },
      sampleOutput: { resumedAt: '2026-01-03T00:00:00.000Z' },
      async run({ propsValue, ctx }) {
        const resumeAt = delayUntil(
          new Date(),
          Number(propsValue.amount),
          String(propsValue.unit ?? 'days'),
        );
        // Nothing is held: the engine turns this into a persisted pause verdict and the
        // worker slot is released immediately. A month-long wait costs no resources.
        ctx.pause(resumeAt);
        return { resumeAt: resumeAt.toISOString() };
      },
    }),
    defineAction<MaildrillPieceContext>({
      name: 'wait_until',
      displayName: 'Wait until',
      description: 'Pause until a specific date and time.',
      category: 'Logic',
      accent: '--text3',
      props: {
        timestamp: Property.DateTime({
          displayName: 'Resume at',
          description: 'An ISO-8601 instant, or an expression that resolves to one.',
          required: true,
        }),
      },
      sampleOutput: { resumeAt: '2026-01-03T09:00:00.000Z' },
      async run({ propsValue, ctx }) {
        const raw = String(propsValue.timestamp ?? '');
        const at = new Date(raw);
        if (Number.isNaN(at.getTime())) {
          throw new ValidationError(`"${raw}" is not a date Maildrill can wait until`);
        }
        // A time already past resumes on the next tick rather than failing — a workflow
        // published after its own target date should still finish.
        const resumeAt = at.getTime() <= Date.now() ? new Date(Date.now() + 1_000) : at;
        ctx.pause(resumeAt);
        return { resumeAt: resumeAt.toISOString() };
      },
    }),
    defineAction<MaildrillPieceContext>({
      name: 'filter',
      displayName: 'Only continue if',
      description: 'Stop the automation unless the conditions hold.',
      category: 'Logic',
      accent: '--text3',
      props: {
        conditions: Property.Conditions({
          displayName: 'Conditions',
          required: true,
        }),
      },
      sampleOutput: { passed: true },
      async run({ propsValue, ctx }) {
        const groups = parseConditionGroups(propsValue.conditions);
        const passed = evaluateConditions(groups);
        if (!passed) ctx.stop({ passed: false });
        return { passed };
      },
    }),
    defineAction<MaildrillPieceContext>({
      name: 'stop',
      displayName: 'Stop',
      description: 'End the automation here, successfully.',
      category: 'Logic',
      accent: '--text3',
      props: {
        reason: Property.ShortText({ displayName: 'Reason', description: 'Shown in the run log.' }),
      },
      sampleOutput: { stopped: true },
      async run({ propsValue, ctx }) {
        const reason = typeof propsValue.reason === 'string' ? propsValue.reason : null;
        ctx.stop({ stopped: true, reason });
        return { stopped: true, reason };
      },
    }),
  ],
});
