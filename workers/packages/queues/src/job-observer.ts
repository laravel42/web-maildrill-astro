/**
 * Optional observer for BullMQ job lifecycle events. No-op until a sink is
 * installed (e.g. Node Telescope), so production consumers are unaffected.
 */

export type QueueJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface QueueJobEvent {
  status: QueueJobStatus;
  queue: string;
  name: string;
  jobId?: string;
  data?: Record<string, unknown>;
  durationMs?: number;
  attemptsMade?: number;
  error?: string;
}

let sink: ((event: QueueJobEvent) => void) | null = null;

export function setQueueJobSink(fn: ((event: QueueJobEvent) => void) | null): void {
  sink = fn;
}

export function emitQueueJob(event: QueueJobEvent): void {
  if (!sink) return;
  try {
    sink(event);
  } catch {
    /* observation must never break enqueue/processing */
  }
}

/** Keep job payloads small and free of message body content. */
export function summarizeJobData(data: unknown): Record<string, unknown> | undefined {
  if (data == null || typeof data !== 'object') return undefined;
  const src = data as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of [
    'version',
    'tenantId',
    'messageId',
    'channel',
    'provider',
    'generation',
    'correlationId',
    'webhookEventId',
  ]) {
    if (key in src) out[key] = src[key];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
