import { config } from '@maildrill/config';
import { createLogger, emitAppCommand, metrics } from '@maildrill/observability';
import { createWorker, getQueue, QUEUE_NAMES } from '@maildrill/queues';
import {
  activateDueMessages,
  expireStalledDeliveries,
  handleDispatch,
  pollCampaignDelivery,
  pollPendingWhatsAppTemplates,
  processWebhookEvent,
  publishOutbox,
  purgeProcessedWebhooks,
  recoverStalledMessages,
} from '@maildrill/services';
import { startPoller, type StopFn } from './poller';

const MAINTENANCE_INTERVAL_MS = 60_000;
const STALLED_AFTER_MS = 5 * 60_000;
const WEBHOOK_RETENTION_DAYS = 30;

function recordWorkerStart(command: string): void {
  emitAppCommand({
    command,
    exitCode: 0,
    durationMs: 0,
    output: 'started',
  });
}

/** BullMQ worker: outbound provider sends. */
export function startDispatchWorker(): StopFn {
  const log = createLogger({ worker: 'dispatch' });
  recordWorkerStart('worker:dispatch');
  const worker = createWorker(
    QUEUE_NAMES.dispatch,
    async (job) => {
      await handleDispatch(job.data);
    },
    {
      concurrency: config.dispatch.concurrency,
      limiter: { max: config.rateLimit.max, duration: config.rateLimit.durationMs },
    },
  );
  worker.on('failed', (job, err) =>
    log.warn({ jobId: job?.id, err: err.message }, 'dispatch job failed (will retry)'),
  );
  worker.on('ready', () => log.info('dispatch worker ready'));
  return async () => {
    await worker.close();
  };
}

/** BullMQ worker: normalize + apply provider events. */
export function startEventsWorker(): StopFn {
  const log = createLogger({ worker: 'events' });
  recordWorkerStart('worker:events');
  const worker = createWorker(
    QUEUE_NAMES.events,
    async (job) => {
      const data = job.data as { webhookEventId?: string };
      if (data?.webhookEventId) await processWebhookEvent(data.webhookEventId);
    },
    { concurrency: 10 },
  );
  worker.on('failed', (job, err) =>
    log.warn({ jobId: job?.id, err: err.message }, 'event job failed (will retry)'),
  );
  worker.on('ready', () => log.info('events worker ready'));
  return async () => {
    await worker.close();
  };
}

/** Poller: transactional-outbox publisher (Postgres → BullMQ). */
export function startPublisher(): StopFn {
  const log = createLogger({ worker: 'publisher' });
  recordWorkerStart('worker:publisher');
  return startPoller(
    'publisher',
    config.outbox.pollIntervalMs,
    async () => {
      const n = await publishOutbox();
      if (n > 0) {
        metrics.setGauge('outbox_last_batch', n);
        log.debug({ published: n }, 'published outbox batch');
        return `published=${n}`;
      }
      return undefined;
    },
    log,
  );
}

/** Poller: activate scheduled messages that are due. */
export function startScheduler(): StopFn {
  const log = createLogger({ worker: 'scheduler' });
  recordWorkerStart('worker:scheduler');
  return startPoller(
    'scheduler',
    config.scheduler.intervalMs,
    async () => {
      const n = await activateDueMessages();
      if (n > 0) {
        log.info({ activated: n }, 'activated scheduled messages');
        return `activated=${n}`;
      }
      return undefined;
    },
    log,
  );
}

/** Poller: recover stalled sends and purge old webhooks. */
export function startMaintenance(): StopFn {
  const log = createLogger({ worker: 'maintenance' });
  recordWorkerStart('worker:maintenance');
  return startPoller(
    'maintenance',
    MAINTENANCE_INTERVAL_MS,
    async () => {
      const recovered = await recoverStalledMessages(STALLED_AFTER_MS);
      if (recovered > 0) log.warn({ recovered }, 'recovered stalled messages');
      const expired = await expireStalledDeliveries(config.campaignDelivery.staleExpireMs);
      if (expired > 0) {
        log.warn({ expired }, 'expired stalled deliveries (no final DLR within TTL)');
      }
      await purgeProcessedWebhooks(WEBHOOK_RETENTION_DAYS);
      // Surface queue depth as gauges.
      for (const name of Object.values(QUEUE_NAMES)) {
        const counts = await getQueue(name).getJobCounts();
        metrics.setGauge('queue_waiting_jobs', counts.waited ?? counts.wait ?? 0, { queue: name });
        metrics.setGauge('queue_failed_jobs', counts.failed ?? 0, { queue: name });
      }
      return recovered > 0 || expired > 0 ? `recovered=${recovered} expired=${expired}` : undefined;
    },
    log,
  );
}

/** Poller: sync pending WhatsApp template approval status from Infobip. */
export function startTemplateApprovalPoller(): StopFn {
  const log = createLogger({ worker: 'template-approval' });
  recordWorkerStart('worker:template-approval');
  return startPoller(
    'template-approval',
    config.templateApproval.pollIntervalMs,
    async () => {
      const result = await pollPendingWhatsAppTemplates();
      if (result.updated > 0 || result.errors > 0) {
        log.info(result, 'polled pending WhatsApp templates');
        return `checked=${result.checked} updated=${result.updated} errors=${result.errors}`;
      }
      if (result.checked > 0) {
        return `checked=${result.checked} updated=0`;
      }
      return undefined;
    },
    log,
  );
}

/** Poller: sync DLRs from PostHog and complete finished campaigns. */
export function startCampaignDeliveryPoller(): StopFn {
  const log = createLogger({ worker: 'campaign-delivery' });
  recordWorkerStart('worker:campaign-delivery');
  return startPoller(
    'campaign-delivery',
    config.campaignDelivery.pollIntervalMs,
    async () => {
      const result = await pollCampaignDelivery();
      if (result.updated > 0 || result.campaignsCompleted > 0) {
        log.info(result, 'polled campaign delivery');
        return `open=${result.openMessages} updated=${result.updated} completed=${result.campaignsCompleted}`;
      }
      if (result.openMessages > 0) {
        return `open=${result.openMessages} updated=0`;
      }
      return undefined;
    },
    log,
  );
}
