import { logger } from '@maildrill/observability';
import { closeDb } from '@maildrill/database';
import { shutdownQueues } from '@maildrill/queues';
import {
  startCampaignDeliveryPoller,
  startDispatchWorker,
  startEventsWorker,
  startMaintenance,
  startPublisher,
  startScheduler,
  startTemplateApprovalPoller,
} from './roles';
import type { StopFn } from './poller';

type Role =
  | 'dispatch'
  | 'events'
  | 'publisher'
  | 'scheduler'
  | 'maintenance'
  | 'template-approval'
  | 'campaign-delivery'
  | 'all';

const stops: StopFn[] = [];

function start(role: Role): void {
  switch (role) {
    case 'dispatch':
      stops.push(startDispatchWorker());
      break;
    case 'events':
      stops.push(startEventsWorker());
      break;
    case 'publisher':
      stops.push(startPublisher());
      break;
    case 'scheduler':
      stops.push(startScheduler());
      break;
    case 'maintenance':
      stops.push(startMaintenance());
      break;
    case 'template-approval':
      stops.push(startTemplateApprovalPoller());
      break;
    case 'campaign-delivery':
      stops.push(startCampaignDeliveryPoller());
      break;
    case 'all':
      start('dispatch');
      start('events');
      start('publisher');
      start('scheduler');
      start('maintenance');
      start('template-approval');
      start('campaign-delivery');
      break;
    default:
      throw new Error(`unknown worker role: ${String(role)}`);
  }
}

const role = (process.argv[2] ?? process.env.WORKER_ROLE ?? 'all') as Role;
start(role);
logger.info({ role }, 'workers started');

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'workers shutting down');
  try {
    await Promise.all(stops.map((stop) => stop()));
    await shutdownQueues();
    await closeDb();
  } catch (err) {
    logger.error({ err }, 'error during shutdown');
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
