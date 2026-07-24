/**
 * Optional observers for pino log lines and lightweight application events /
 * batch summaries. No-op until sinks are installed (Node Telescope).
 */

export interface AppLogEvent {
  level: string;
  message: string;
  context?: Record<string, unknown>;
}

export interface AppEventEvent {
  name: string;
  payload?: Record<string, unknown>;
  listeners?: string[];
}

export interface AppBatchEvent {
  name: string;
  totalJobs: number;
  pendingJobs: number;
  failedJobs: number;
  completedJobs: number;
  data?: Record<string, unknown>;
}

export interface AppCommandEvent {
  command: string;
  exitCode: number;
  durationMs: number;
  arguments?: string[];
  output?: string;
}

let logSink: ((event: AppLogEvent) => void) | null = null;
let eventSink: ((event: AppEventEvent) => void) | null = null;
let batchSink: ((event: AppBatchEvent) => void) | null = null;
let commandSink: ((event: AppCommandEvent) => void) | null = null;

export function setAppLogSink(fn: ((event: AppLogEvent) => void) | null): void {
  logSink = fn;
}

export function setAppEventSink(fn: ((event: AppEventEvent) => void) | null): void {
  eventSink = fn;
}

export function setAppBatchSink(fn: ((event: AppBatchEvent) => void) | null): void {
  batchSink = fn;
}

export function setAppCommandSink(fn: ((event: AppCommandEvent) => void) | null): void {
  commandSink = fn;
}

export function emitAppLog(event: AppLogEvent): void {
  if (!logSink) return;
  try {
    logSink(event);
  } catch {
    /* ignore */
  }
}

export function emitAppEvent(event: AppEventEvent): void {
  if (!eventSink) return;
  try {
    eventSink(event);
  } catch {
    /* ignore */
  }
}

export function emitAppBatch(event: AppBatchEvent): void {
  if (!batchSink) return;
  try {
    batchSink(event);
  } catch {
    /* ignore */
  }
}

export function emitAppCommand(event: AppCommandEvent): void {
  if (!commandSink) return;
  try {
    commandSink(event);
  } catch {
    /* ignore */
  }
}
