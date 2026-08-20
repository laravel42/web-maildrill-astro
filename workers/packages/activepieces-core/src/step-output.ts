/**
 * Execution journal — adapted from Activepieces (MIT).
 *
 * Upstream: packages/core/execution/src/lib/flow-run/execution/step-output.ts
 *
 * Ported near-verbatim; the log-slice / file-manifest members are dropped because
 * Maildrill journals steps to Postgres (`automation_step_runs`) rather than to
 * S3-backed log files.
 */
import { FlowActionType, FlowTriggerType } from './flow-model';

export enum StepOutputStatus {
  FAILED = 'FAILED',
  PAUSED = 'PAUSED',
  RUNNING = 'RUNNING',
  STOPPED = 'STOPPED',
  SUCCEEDED = 'SUCCEEDED',
}

export type StepKind = FlowActionType | FlowTriggerType;

interface BaseStepOutputParams<T extends StepKind, OUTPUT> {
  type: T;
  status: StepOutputStatus;
  input: unknown;
  output?: OUTPUT;
  duration?: number;
  errorMessage?: string;
}

export class GenericStepOutput<T extends StepKind, OUTPUT> {
  readonly type: T;
  readonly status: StepOutputStatus;
  readonly input: unknown;
  readonly output?: OUTPUT;
  readonly duration?: number;
  readonly errorMessage?: string;

  constructor(step: BaseStepOutputParams<T, OUTPUT>) {
    this.type = step.type;
    this.status = step.status;
    this.input = step.input;
    this.output = step.output;
    this.duration = step.duration;
    this.errorMessage = step.errorMessage;
  }

  setOutput(output: OUTPUT): GenericStepOutput<T, OUTPUT> {
    return new GenericStepOutput<T, OUTPUT>({ ...this, output });
  }

  setStatus(status: StepOutputStatus): GenericStepOutput<T, OUTPUT> {
    return new GenericStepOutput<T, OUTPUT>({ ...this, status });
  }

  setErrorMessage(errorMessage: string): GenericStepOutput<T, OUTPUT> {
    return new GenericStepOutput<T, OUTPUT>({ ...this, errorMessage });
  }

  setDuration(duration: number): GenericStepOutput<T, OUTPUT> {
    return new GenericStepOutput<T, OUTPUT>({ ...this, duration });
  }

  static create<T extends StepKind, OUTPUT>(params: {
    input: unknown;
    type: T;
    status: StepOutputStatus;
    output?: OUTPUT;
  }): GenericStepOutput<T, OUTPUT> {
    return new GenericStepOutput<T, OUTPUT>(params);
  }
}

export interface BranchResult {
  branchName: string;
  branchIndex: number;
  evaluation: boolean;
}

export interface RouterStepResult {
  branches: BranchResult[];
}

export class RouterStepOutput extends GenericStepOutput<FlowActionType.ROUTER, RouterStepResult> {
  static init({ input }: { input: unknown }): RouterStepOutput {
    return new RouterStepOutput({
      type: FlowActionType.ROUTER,
      input,
      status: StepOutputStatus.SUCCEEDED,
    });
  }
}

export interface LoopStepResult {
  item: unknown;
  index: number;
  iterations: Record<string, StepOutput>[];
}

export class LoopStepOutput extends GenericStepOutput<
  FlowActionType.LOOP_ON_ITEMS,
  LoopStepResult
> {
  constructor(step: BaseStepOutputParams<FlowActionType.LOOP_ON_ITEMS, LoopStepResult>) {
    super({
      ...step,
      output: step.output ?? { item: undefined, index: 0, iterations: [] },
    });
  }

  static init({ input }: { input: unknown }): LoopStepOutput {
    return new LoopStepOutput({
      type: FlowActionType.LOOP_ON_ITEMS,
      input,
      status: StepOutputStatus.SUCCEEDED,
    });
  }

  setItemAndIndex({ item, index }: { item: unknown; index: number }): LoopStepOutput {
    return new LoopStepOutput({
      ...this,
      output: { item, index, iterations: this.output?.iterations ?? [] },
    });
  }

  addIteration(): LoopStepOutput {
    return new LoopStepOutput({
      ...this,
      output: {
        item: this.output?.item,
        index: this.output?.index ?? 0,
        iterations: [...(this.output?.iterations ?? []), {}],
      },
    });
  }

  setIterations(iterations: Record<string, StepOutput>[]): LoopStepOutput {
    return new LoopStepOutput({
      ...this,
      output: {
        item: this.output?.item,
        index: this.output?.index ?? 0,
        iterations,
      },
    });
  }
}

export type StepOutput =
  | GenericStepOutput<FlowActionType.LOOP_ON_ITEMS, LoopStepResult>
  | GenericStepOutput<FlowActionType.ROUTER, RouterStepResult>
  | GenericStepOutput<
      FlowActionType.PIECE | FlowTriggerType.PIECE | FlowTriggerType.EMPTY,
      unknown
    >;

/**
 * Plain-JSON form of a journal, for persistence. `GenericStepOutput` is a class, so a
 * round-trip through Postgres yields objects — the resolver reads them structurally and
 * never relies on the prototype.
 */
export interface SerializedStepOutput {
  type: string;
  status: StepOutputStatus;
  input: unknown;
  output?: unknown;
  duration?: number;
  errorMessage?: string;
}

export type ExecutionJournal = Record<string, SerializedStepOutput>;

export function serializeStepOutput(step: {
  type: string;
  status: StepOutputStatus;
  input: unknown;
  output?: unknown;
  duration?: number;
  errorMessage?: string;
}): SerializedStepOutput {
  return {
    type: step.type,
    status: step.status,
    input: step.input,
    output: step.output,
    duration: step.duration,
    errorMessage: step.errorMessage,
  };
}
