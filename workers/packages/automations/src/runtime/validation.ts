import {
  BranchExecutionType,
  countActions,
  FlowActionType,
  FlowTriggerType,
  flowVersionSchema,
  getAllActions,
  SINGLE_VALUE_OPERATORS,
  STEP_NAME_REGEX,
  type FlowAction,
  type FlowVersionDefinition,
} from '@maildrill/activepieces-core';
import { connectionExists } from './connections';
import { getAction, getPiece, getTrigger } from '../pieces/registry';
import { automationLimits } from '../domain/limits';

/**
 * The publish gate.
 *
 * Every error is anchored to a step so the composer can point at the node that caused it —
 * "flow is invalid" with no location is the difference between a builder people use and
 * one they abandon.
 *
 * Runs against the *stored* definition, not the editor's state, so a flow that was valid
 * when drawn but references a since-deleted template is refused at publish rather than
 * failing at 3am for one recipient.
 */
export interface ValidationIssue {
  stepName: string | null;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

/** Structural checks that need no I/O — used by the composer on every save. */
export function validateStructure(definition: FlowVersionDefinition): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const trigger = definition.trigger;

  if (trigger.type === FlowTriggerType.EMPTY) {
    errors.push({ stepName: trigger.name, message: 'Choose a trigger to start this automation.' });
  } else {
    const settings = trigger.settings as { pieceName?: string; triggerName?: string };
    const piece = settings.pieceName ? getPiece(settings.pieceName) : undefined;
    const definitionTrigger =
      settings.pieceName && settings.triggerName
        ? getTrigger(settings.pieceName, settings.triggerName)
        : undefined;
    if (!piece || !definitionTrigger) {
      errors.push({
        stepName: trigger.name,
        message: 'This trigger is no longer available.',
      });
    } else {
      errors.push(...missingProps(trigger.name, definitionTrigger.props, trigger.settings));
    }
  }

  const actions = getAllActions(trigger.nextAction);
  if (actions.length === 0) {
    errors.push({ stepName: null, message: 'Add at least one step after the trigger.' });
  }

  const limits = automationLimits();
  if (countActions(definition) > limits.maxStepsPerRun) {
    errors.push({
      stepName: null,
      message: `This automation has more steps than a single run may execute (${limits.maxStepsPerRun}).`,
    });
  }

  const seen = new Set<string>([trigger.name]);
  for (const action of actions) {
    if (!STEP_NAME_REGEX.test(action.name)) {
      errors.push({ stepName: action.name, message: 'Step name is not a valid identifier.' });
    }
    if (seen.has(action.name)) {
      errors.push({
        stepName: action.name,
        message: `Two steps are called "${action.name}"; step names must be unique.`,
      });
    }
    seen.add(action.name);
    errors.push(...validateAction(action));
  }

  // A Wait inside a Loop cannot be resumed correctly — the executor fast-forwards by step
  // name, and a step inside a loop has one name and many executions. Refusing it at
  // publish is honest; silently resuming the wrong iteration would not be.
  for (const loop of actions.filter((a) => a.type === FlowActionType.LOOP_ON_ITEMS)) {
    const inner = getAllActions(
      loop.type === FlowActionType.LOOP_ON_ITEMS ? loop.firstLoopAction : null,
    );
    for (const step of inner) {
      if (step.type === FlowActionType.PIECE && isWaitAction(step)) {
        errors.push({
          stepName: step.name,
          message: 'A Wait step cannot be used inside a Loop. Move it after the loop.',
        });
      }
    }
  }

  return errors;
}

function isWaitAction(action: FlowAction): boolean {
  return (
    action.type === FlowActionType.PIECE &&
    action.settings.pieceName === '@maildrill/logic' &&
    (action.settings.actionName === 'delay' || action.settings.actionName === 'wait_until')
  );
}

function validateAction(action: FlowAction): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  switch (action.type) {
    case FlowActionType.PIECE: {
      const definitionAction = getAction(action.settings.pieceName, action.settings.actionName);
      if (!definitionAction) {
        errors.push({
          stepName: action.name,
          message: `"${action.displayName}" uses a step type that is no longer available.`,
        });
        break;
      }
      errors.push(...missingProps(action.name, definitionAction.props, action.settings.input));
      break;
    }
    case FlowActionType.ROUTER: {
      if (action.settings.branches.length === 0) {
        errors.push({ stepName: action.name, message: 'A branch needs at least one path.' });
      }
      if (action.children.length !== action.settings.branches.length) {
        errors.push({
          stepName: action.name,
          message: 'This branch is corrupted: paths and conditions do not line up.',
        });
      }
      action.settings.branches.forEach((branch, index) => {
        if (branch.branchType === BranchExecutionType.FALLBACK) return;
        const groups = branch.conditions;
        if (groups.length === 0 || groups.every((g) => g.length === 0)) {
          errors.push({
            stepName: action.name,
            message: `Path ${index + 1} ("${branch.branchName}") has no conditions.`,
          });
          return;
        }
        for (const group of groups) {
          for (const condition of group) {
            if (!condition.firstValue) {
              errors.push({
                stepName: action.name,
                message: `A condition in "${branch.branchName}" is missing its left-hand value.`,
              });
            }
            const needsSecond = !SINGLE_VALUE_OPERATORS.includes(condition.operator);
            if (needsSecond && (condition.secondValue ?? '') === '') {
              errors.push({
                stepName: action.name,
                message: `A condition in "${branch.branchName}" is missing its comparison value.`,
              });
            }
          }
        }
      });
      break;
    }
    case FlowActionType.LOOP_ON_ITEMS: {
      if (!action.settings.items.trim()) {
        errors.push({ stepName: action.name, message: 'Choose what this loop iterates over.' });
      }
      break;
    }
  }
  return errors;
}

function missingProps(
  stepName: string,
  props: Record<string, { required: boolean; displayName: string }>,
  settings: unknown,
): ValidationIssue[] {
  const input =
    settings && typeof settings === 'object'
      ? ((settings as { input?: unknown }).input ?? settings)
      : {};
  const values = (input ?? {}) as Record<string, unknown>;
  const errors: ValidationIssue[] = [];
  for (const [key, prop] of Object.entries(props)) {
    if (!prop.required) continue;
    const value = values[key];
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim().length === 0) ||
      (Array.isArray(value) && value.length === 0);
    if (empty) {
      errors.push({ stepName, message: `"${prop.displayName}" is required.` });
    }
  }
  return errors;
}

/**
 * Full gate: structure plus the checks that need the database (do the connections this
 * flow references still exist, and belong to *this* workspace).
 */
export async function validateForPublish(
  tenantId: string,
  raw: unknown,
): Promise<ValidationResult> {
  const parsed = flowVersionSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      valid: false,
      errors: parsed.error.issues.map((issue) => ({
        stepName: null,
        message: `${issue.path.join('.') || 'flow'}: ${issue.message}`,
      })),
    };
  }

  const errors = validateStructure(parsed.data);

  for (const action of getAllActions(parsed.data.trigger.nextAction)) {
    if (action.type !== FlowActionType.PIECE) continue;
    const connectionId = action.settings.connectionId;
    if (!connectionId) continue;
    if (!(await connectionExists(tenantId, connectionId))) {
      errors.push({
        stepName: action.name,
        message: 'The connection this step uses no longer exists in this workspace.',
      });
    }
  }

  return { valid: errors.length === 0, errors };
}
