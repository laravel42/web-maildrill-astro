import { Queue, Worker, type Job, type Processor, type WorkerOptions } from "bullmq";
import type IORedis from "ioredis";
import { QUEUE_NAMES, type QueueName } from "@maildrill/domain";
import { createRedis, sharedConnection, closeSharedConnection } from "./connection";
import {
  emitQueueJob,
  setQueueJobSink,
  summarizeJobData,
  type QueueJobEvent,
  type QueueJobStatus,
} from "./job-observer";
import { setRedisCommandSink, type RedisCommandEvent } from "./redis-observer";

export { QUEUE_NAMES, createRedis, sharedConnection };
export { setQueueJobSink, type QueueJobEvent, type QueueJobStatus };
export { setRedisCommandSink, type RedisCommandEvent };
export type { QueueName };

const DEFAULT_JOB_OPTIONS = {
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
} as const;

const queues = new Map<QueueName, Queue>();
const workerConnections = new Set<IORedis>();

export function getQueue(name: QueueName): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: sharedConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
    queues.set(name, q);
  }
  return q;
}

export interface EnqueueOptions {
  jobId?: string;
  delay?: number;
  attempts?: number;
  backoffMs?: number;
}

/** Add a job with an optional deterministic id and exponential backoff. */
export async function enqueue(
  queue: QueueName,
  jobName: string,
  data: unknown,
  opts: EnqueueOptions = {},
): Promise<void> {
  const job = await getQueue(queue).add(jobName, data, {
    jobId: opts.jobId,
    delay: opts.delay,
    attempts: opts.attempts ?? 1,
    backoff: opts.backoffMs
      ? { type: "exponential", delay: opts.backoffMs }
      : undefined,
    ...DEFAULT_JOB_OPTIONS,
  });
  emitQueueJob({
    status: "queued",
    queue,
    name: jobName,
    jobId: job.id,
    data: summarizeJobData(data),
  });
}

/** Create a Worker with its own dedicated connection (tracked for shutdown). */
export function createWorker<T = unknown, R = unknown>(
  name: QueueName,
  processor: Processor<T, R>,
  opts?: Omit<WorkerOptions, "connection">,
): Worker<T, R> {
  const connection = createRedis("worker");
  workerConnections.add(connection);
  const worker = new Worker<T, R>(name, processor, { connection, ...opts });
  attachJobLifecycle(worker, name);
  return worker;
}

const activeStarted = new WeakMap<object, number>();

function attachJobLifecycle<T, R>(worker: Worker<T, R>, queue: string): void {
  worker.on("active", (job: Job<T, R>) => {
    activeStarted.set(job, Date.now());
    emitQueueJob({
      status: "processing",
      queue,
      name: job.name,
      jobId: job.id,
      data: summarizeJobData(job.data),
      attemptsMade: job.attemptsMade,
    });
  });
  worker.on("completed", (job: Job<T, R>) => {
    const started = activeStarted.get(job);
    activeStarted.delete(job);
    emitQueueJob({
      status: "completed",
      queue,
      name: job.name,
      jobId: job.id,
      data: summarizeJobData(job.data),
      durationMs: started != null ? Date.now() - started : undefined,
      attemptsMade: job.attemptsMade,
    });
  });
  worker.on("failed", (job: Job<T, R> | undefined, err: Error) => {
    if (!job) return;
    const started = activeStarted.get(job);
    activeStarted.delete(job);
    emitQueueJob({
      status: "failed",
      queue,
      name: job.name,
      jobId: job.id,
      data: summarizeJobData(job.data),
      durationMs: started != null ? Date.now() - started : undefined,
      attemptsMade: job.attemptsMade,
      error: err.message,
    });
  });
}

/** Close producer queues and any worker-owned connections. Call after workers close. */
export async function shutdownQueues(): Promise<void> {
  for (const q of queues.values()) await q.close();
  queues.clear();
  for (const c of workerConnections) await c.quit();
  workerConnections.clear();
  await closeSharedConnection();
}
