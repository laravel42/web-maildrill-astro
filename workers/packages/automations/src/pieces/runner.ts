import { ValidationError } from '@maildrill/domain';
import type { AutomationExecutionContext, PieceRunner, PieceRunOutcome } from '../engine/ports';
import { readConnectionSecret } from '../runtime/connections';
import type { MaildrillPieceContext } from './context';
import { getAction } from './registry';

/**
 * Binds the engine's `PieceRunner` port to the Maildrill registry.
 *
 * This is the only place the two halves meet: the engine knows nothing about Maildrill,
 * and the pieces know nothing about flow execution. Pause/stop travel back through the
 * context object because a piece's `run` returns a value, not a verdict — the same shape
 * upstream uses (`ctx.run.pause()`).
 */
export class MaildrillPieceRunner implements PieceRunner {
  async run(params: {
    pieceName: string;
    pieceVersion: string;
    actionName: string;
    propsValue: Record<string, unknown>;
    step: { name: string; displayName: string };
    connectionId?: string | null;
    context: AutomationExecutionContext;
  }): Promise<PieceRunOutcome> {
    const action = getAction(params.pieceName, params.actionName);
    if (!action) {
      throw new ValidationError(
        `step "${params.step.displayName}" uses an unknown action (${params.pieceName}.${params.actionName})`,
      );
    }

    /*
     * Pause/stop travel back through a holder object rather than two `let` bindings:
     * TypeScript narrows a `let` from its initializer and does not un-narrow it for
     * assignments made inside a closure, so reading `pausedAt` after `run()` would be
     * typed `null`. Property reads ARE invalidated by an intervening call, which is
     * exactly the shape this needs.
     */
    const control: { pausedAt: Date | null; stopped: { output?: unknown } | null } = {
      pausedAt: null,
      stopped: null,
    };

    const ctx: MaildrillPieceContext = {
      tenantId: params.context.tenantId,
      automationId: params.context.automationId,
      automationVersionId: params.context.automationVersionId,
      runId: params.context.runId,
      stepName: params.step.name,
      source: params.context.source,
      dryRun: params.context.dryRun,
      limits: params.context.limits,
      pause: (resumeAt: Date) => {
        control.pausedAt = resumeAt;
      },
      stop: (output?: unknown) => {
        control.stopped = { output };
      },
      // Scoped by tenant: a connection id copied from another workspace's flow resolves to
      // nothing rather than to somebody else's credential.
      connection: () =>
        params.connectionId
          ? readConnectionSecret(params.context.tenantId, params.connectionId)
          : Promise.resolve(null),
    };

    const output = await action.run({ propsValue: params.propsValue, ctx });

    if (control.pausedAt) return { kind: 'pause', resumeAt: control.pausedAt };
    if (control.stopped) return { kind: 'stop', output: control.stopped.output ?? output };
    return { kind: 'output', output };
  }
}
