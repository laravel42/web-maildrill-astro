import { config } from '@maildrill/config';
import { createLogger, metrics } from '@maildrill/observability';
import { dueWaitingRuns, reclaimStalledRuns } from './repository';
import { enqueueRun } from './runs';

const log = createLogger({ component: 'automation-maintenance' });

/**
 * Durability sweep.
 *
 * Two failure modes this recovers from, both of which happen in normal operation:
 *
 *  1. **A lost wake-up.** Long delays are not held as BullMQ delayed jobs (a three-month
 *     job in Redis dies with the instance), so the database is the alarm clock: any
 *     `waiting` run whose `resume_at` has passed is re-queued here.
 *  2. **A dead worker.** A run claimed by a process that was killed mid-step stays
 *     `running` forever. After `AUTOMATION_STALL_MS` it is returned to `queued` and picked
 *     up again — safe because every side-effecting step carries a `(run, step)` idempotency
 *     key, so the replay cannot double-send.
 */
export interface MaintenanceResult {
  resumed: number;
  reclaimed: number;
}

export async function runAutomationMaintenance(): Promise<MaintenanceResult> {
  const due = await dueWaitingRuns(config.automations.dispatchBatchSize);
  for (const run of due) {
    await enqueueRun(run.tenantId, run.id, 'resume', 0, null);
  }

  const reclaimed = await reclaimStalledRuns(config.automations.stallMs);
  for (const run of reclaimed) {
    await enqueueRun(run.tenantId, run.id, 'start', 0, null);
  }

  if (due.length > 0 || reclaimed.length > 0) {
    metrics.inc('automation_runs_resumed_total', {}, due.length);
    metrics.inc('automation_runs_reclaimed_total', {}, reclaimed.length);
    log.info({ resumed: due.length, reclaimed: reclaimed.length }, 'automation maintenance');
  }
  return { resumed: due.length, reclaimed: reclaimed.length };
}
