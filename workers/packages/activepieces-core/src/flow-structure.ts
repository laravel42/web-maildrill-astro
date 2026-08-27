/**
 * Flow traversal — reimplemented for the reduced model, after Activepieces (MIT).
 *
 * Upstream: packages/core/execution/src/lib/flows/util/flow-structure-util.ts
 *
 * The trigger is passed explicitly rather than sniffed: `FlowActionType.PIECE` and
 * `FlowTriggerType.PIECE` share the string `"PIECE"` upstream, so `type` alone cannot tell
 * a trigger from an action.
 */
import type { FlowAction, FlowTrigger, FlowVersionDefinition } from './flow-model';
import { FlowActionType } from './flow-model';

/** Every action in the version, depth-first, in a stable order. */
export function getAllActions(root: FlowAction | null | undefined): FlowAction[] {
  const out: FlowAction[] = [];
  const visit = (action: FlowAction | null | undefined): void => {
    if (!action) return;
    out.push(action);
    if (action.type === FlowActionType.LOOP_ON_ITEMS) visit(action.firstLoopAction);
    if (action.type === FlowActionType.ROUTER) for (const child of action.children) visit(child);
    visit(action.nextAction);
  };
  visit(root);
  return out;
}

export function getAllStepNames(definition: FlowVersionDefinition): string[] {
  return [
    definition.trigger.name,
    ...getAllActions(definition.trigger.nextAction).map((a) => a.name),
  ];
}

export function findAction(
  root: FlowAction | null | undefined,
  name: string,
): FlowAction | undefined {
  return getAllActions(root).find((a) => a.name === name);
}

export function getTrigger(definition: FlowVersionDefinition): FlowTrigger {
  return definition.trigger;
}

/** Count of actions, for the "max steps" publish check and the run budget. */
export function countActions(definition: FlowVersionDefinition): number {
  return getAllActions(definition.trigger.nextAction).length;
}
