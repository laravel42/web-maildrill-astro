import { automationEvents, db } from '@maildrill/database';
import {
  setMaildrillEventSink,
  type MaildrillEvent,
  maildrillEventSinkInstalled,
} from '@maildrill/domain';
import { createLogger, metrics } from '@maildrill/observability';
import { currentAutomationOrigin } from './origin';

const log = createLogger({ component: 'automation-event-sink' });

/**
 * The durable half of the event bridge.
 *
 * `emitMaildrillEvent` is a no-op until this is installed, so a process that does not run
 * automations pays nothing. Installed in the API (so a subscriber created through the UI
 * triggers workflows) and in the worker (so campaign delivery does too).
 *
 * The row is the unit of durability: once it is committed the dispatcher will find it,
 * whatever happens to this process next. `dedupe_key` is unique, so a redelivered event is
 * a no-op insert rather than a second run.
 */
export function installAutomationEventSink(): void {
  if (maildrillEventSinkInstalled()) return;
  setMaildrillEventSink(async (event: MaildrillEvent) => {
    try {
      const origin = currentAutomationOrigin();
      await db
        .insert(automationEvents)
        .values({
          tenantId: event.tenantId,
          type: event.type,
          dedupeKey: event.dedupeKey,
          payload: {
            ...event.data,
            // Recursion guard: the dispatcher refuses to start THIS automation from an
            // event its own run produced.
            ...(origin
              ? { _originAutomationId: origin.automationId, _originRunId: origin.runId }
              : {}),
          },
          occurredAt: event.occurredAt ?? new Date(),
        })
        .onConflictDoNothing({ target: automationEvents.dedupeKey });
      metrics.inc('automation_events_total', { type: event.type });
    } catch (err) {
      // Never rethrow: a subscriber import must not fail because the automation pipeline
      // is unhappy. The lost event is a missed run, which is recoverable; a failed import
      // is not.
      metrics.inc('automation_events_dropped_total', { type: event.type });
      log.error(
        {
          type: event.type,
          tenantId: event.tenantId,
          err: err instanceof Error ? err.message : String(err),
        },
        'failed to record automation event',
      );
    }
  });
}

/** Test hook. */
export function uninstallAutomationEventSink(): void {
  setMaildrillEventSink(null);
}
