/**
 * Flow model — adapted from Activepieces (MIT).
 *
 * Upstream: packages/core/execution/src/lib/flows/{actions/action.ts,triggers/trigger.ts,flow-version.ts}
 * See ../VENDOR.md for the commit and the full list of adaptations.
 *
 * Differences that matter:
 *  - `CODE` actions are not modelled. Maildrill exposes no arbitrary-code step, and a
 *    schema that can express one invites an executor that runs one.
 *  - Triggers are `PIECE` or `EMPTY`; upstream's webhook/polling distinction lives inside
 *    the piece definition instead.
 *  - Piece versions are plain semver-ish strings; upstream's `VersionType` (with `~`/`^`
 *    range syntax) exists to resolve npm packages, which Maildrill's registry does not do.
 */
import { z } from 'zod';

/** Upstream STEP_NAME_REGEX: a lowercase identifier the resolver can address as `{{name}}`. */
export const STEP_NAME_REGEX = /^[a-z][a-z0-9_]*$/;

export enum FlowActionType {
  PIECE = 'PIECE',
  ROUTER = 'ROUTER',
  LOOP_ON_ITEMS = 'LOOP_ON_ITEMS',
}

export enum FlowTriggerType {
  PIECE = 'PIECE',
  EMPTY = 'EMPTY',
}

export enum RouterExecutionType {
  EXECUTE_ALL_MATCH = 'EXECUTE_ALL_MATCH',
  EXECUTE_FIRST_MATCH = 'EXECUTE_FIRST_MATCH',
}

export enum BranchExecutionType {
  CONDITION = 'CONDITION',
  FALLBACK = 'FALLBACK',
}

export enum BranchOperator {
  TEXT_CONTAINS = 'TEXT_CONTAINS',
  TEXT_DOES_NOT_CONTAIN = 'TEXT_DOES_NOT_CONTAIN',
  TEXT_EXACTLY_MATCHES = 'TEXT_EXACTLY_MATCHES',
  TEXT_DOES_NOT_EXACTLY_MATCH = 'TEXT_DOES_NOT_EXACTLY_MATCH',
  TEXT_STARTS_WITH = 'TEXT_START_WITH',
  TEXT_DOES_NOT_START_WITH = 'TEXT_DOES_NOT_START_WITH',
  TEXT_ENDS_WITH = 'TEXT_ENDS_WITH',
  TEXT_DOES_NOT_END_WITH = 'TEXT_DOES_NOT_END_WITH',
  NUMBER_IS_GREATER_THAN = 'NUMBER_IS_GREATER_THAN',
  NUMBER_IS_LESS_THAN = 'NUMBER_IS_LESS_THAN',
  NUMBER_IS_EQUAL_TO = 'NUMBER_IS_EQUAL_TO',
  BOOLEAN_IS_TRUE = 'BOOLEAN_IS_TRUE',
  BOOLEAN_IS_FALSE = 'BOOLEAN_IS_FALSE',
  DATE_IS_BEFORE = 'DATE_IS_BEFORE',
  DATE_IS_EQUAL = 'DATE_IS_EQUAL',
  DATE_IS_AFTER = 'DATE_IS_AFTER',
  LIST_CONTAINS = 'LIST_CONTAINS',
  LIST_DOES_NOT_CONTAIN = 'LIST_DOES_NOT_CONTAIN',
  LIST_IS_EMPTY = 'LIST_IS_EMPTY',
  LIST_IS_NOT_EMPTY = 'LIST_IS_NOT_EMPTY',
  EXISTS = 'EXISTS',
  DOES_NOT_EXIST = 'DOES_NOT_EXIST',
}

/** Operators that read only `firstValue` — the editor hides the second input for these. */
export const SINGLE_VALUE_OPERATORS: readonly BranchOperator[] = [
  BranchOperator.EXISTS,
  BranchOperator.DOES_NOT_EXIST,
  BranchOperator.BOOLEAN_IS_TRUE,
  BranchOperator.BOOLEAN_IS_FALSE,
  BranchOperator.LIST_IS_EMPTY,
  BranchOperator.LIST_IS_NOT_EMPTY,
];

/** Operators whose comparison is text-shaped, so `caseSensitive` applies. */
export const TEXT_OPERATORS: readonly BranchOperator[] = [
  BranchOperator.TEXT_CONTAINS,
  BranchOperator.TEXT_DOES_NOT_CONTAIN,
  BranchOperator.TEXT_EXACTLY_MATCHES,
  BranchOperator.TEXT_DOES_NOT_EXACTLY_MATCH,
  BranchOperator.TEXT_STARTS_WITH,
  BranchOperator.TEXT_DOES_NOT_START_WITH,
  BranchOperator.TEXT_ENDS_WITH,
  BranchOperator.TEXT_DOES_NOT_END_WITH,
  BranchOperator.LIST_CONTAINS,
  BranchOperator.LIST_DOES_NOT_CONTAIN,
];

export const branchConditionSchema = z.object({
  firstValue: z.string(),
  secondValue: z.string().optional(),
  caseSensitive: z.boolean().optional(),
  operator: z.nativeEnum(BranchOperator),
});
export type BranchCondition = z.infer<typeof branchConditionSchema>;

/**
 * Upstream's shape: an array of AND-groups, OR'd together. `[[a, b], [c]]` means
 * `(a AND b) OR c`.
 */
export const conditionGroupsSchema = z.array(z.array(branchConditionSchema));
export type ConditionGroups = z.infer<typeof conditionGroupsSchema>;

const stepName = z.string().regex(STEP_NAME_REGEX, 'step names are lowercase identifiers');

const commonStepProps = {
  name: stepName,
  displayName: z.string().min(1),
  valid: z.boolean().default(true),
  skip: z.boolean().optional(),
};

export const pieceActionSettingsSchema = z.object({
  pieceName: z.string().min(1),
  pieceVersion: z.string().min(1),
  actionName: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
  /** Workspace connection this step authenticates with, when the piece needs one. */
  connectionId: z.string().uuid().nullish(),
  errorHandling: z
    .object({
      continueOnFailure: z.boolean().optional(),
      retryOnFailure: z.boolean().optional(),
    })
    .optional(),
});
export type PieceActionSettings = z.infer<typeof pieceActionSettingsSchema>;

export const loopSettingsSchema = z.object({
  /** Expression resolving to an array, e.g. `{{steps.find_subscriber.output.tags}}`. */
  items: z.string(),
});
export type LoopSettings = z.infer<typeof loopSettingsSchema>;

export const routerBranchSettingsSchema = z.object({
  branchName: z.string().min(1),
  branchType: z.nativeEnum(BranchExecutionType),
  conditions: conditionGroupsSchema.default([]),
});
export type RouterBranchSettings = z.infer<typeof routerBranchSettingsSchema>;

export const routerSettingsSchema = z.object({
  executionType: z.nativeEnum(RouterExecutionType).default(RouterExecutionType.EXECUTE_FIRST_MATCH),
  branches: z.array(routerBranchSettingsSchema).min(1),
});
export type RouterSettings = z.infer<typeof routerSettingsSchema>;

// --- Recursive action union -------------------------------------------------
// Zod cannot infer a self-referential union, so the TS types are declared first
// and the schemas are annotated with them (the pattern `z.lazy` requires).

export interface PieceAction {
  name: string;
  displayName: string;
  valid: boolean;
  skip?: boolean;
  type: FlowActionType.PIECE;
  settings: PieceActionSettings;
  nextAction?: FlowAction | null;
}

export interface LoopOnItemsAction {
  name: string;
  displayName: string;
  valid: boolean;
  skip?: boolean;
  type: FlowActionType.LOOP_ON_ITEMS;
  settings: LoopSettings;
  firstLoopAction?: FlowAction | null;
  nextAction?: FlowAction | null;
}

export interface RouterAction {
  name: string;
  displayName: string;
  valid: boolean;
  skip?: boolean;
  type: FlowActionType.ROUTER;
  settings: RouterSettings;
  /** One entry per branch, positionally aligned with `settings.branches`. */
  children: (FlowAction | null)[];
  nextAction?: FlowAction | null;
}

export type FlowAction = PieceAction | LoopOnItemsAction | RouterAction;

export const flowActionSchema: z.ZodType<FlowAction> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      ...commonStepProps,
      type: z.literal(FlowActionType.PIECE),
      settings: pieceActionSettingsSchema,
      nextAction: flowActionSchema.nullish(),
    }),
    z.object({
      ...commonStepProps,
      type: z.literal(FlowActionType.LOOP_ON_ITEMS),
      settings: loopSettingsSchema,
      firstLoopAction: flowActionSchema.nullish(),
      nextAction: flowActionSchema.nullish(),
    }),
    z.object({
      ...commonStepProps,
      type: z.literal(FlowActionType.ROUTER),
      settings: routerSettingsSchema,
      children: z.array(flowActionSchema.nullable()),
      nextAction: flowActionSchema.nullish(),
    }),
  ]),
) as z.ZodType<FlowAction>;

export const pieceTriggerSettingsSchema = z.object({
  pieceName: z.string().min(1),
  pieceVersion: z.string().min(1),
  triggerName: z.string().min(1),
  input: z.record(z.string(), z.unknown()).default({}),
});
export type PieceTriggerSettings = z.infer<typeof pieceTriggerSettingsSchema>;

export interface FlowTrigger {
  name: string;
  displayName: string;
  valid: boolean;
  type: FlowTriggerType;
  settings: PieceTriggerSettings | Record<string, never>;
  nextAction?: FlowAction | null;
}

export const flowTriggerSchema: z.ZodType<FlowTrigger> = z.discriminatedUnion('type', [
  z.object({
    ...commonStepProps,
    type: z.literal(FlowTriggerType.PIECE),
    settings: pieceTriggerSettingsSchema,
    nextAction: flowActionSchema.nullish(),
  }),
  z.object({
    ...commonStepProps,
    type: z.literal(FlowTriggerType.EMPTY),
    settings: z.object({}).strict(),
    nextAction: flowActionSchema.nullish(),
  }),
]) as z.ZodType<FlowTrigger>;

/** The persisted definition of one automation version. */
export const flowVersionSchema = z.object({
  trigger: flowTriggerSchema,
});
export type FlowVersionDefinition = z.infer<typeof flowVersionSchema>;

export type FlowStep = FlowAction | FlowTrigger;

/**
 * `FlowActionType.PIECE` and `FlowTriggerType.PIECE` share the string `"PIECE"` upstream,
 * so `type` alone cannot tell a trigger from an action. Position does: the trigger is the
 * root of the version and is never reachable through `nextAction`/`children`. Traversal
 * therefore carries the distinction (see `flow-structure.ts`) rather than sniffing it.
 */
