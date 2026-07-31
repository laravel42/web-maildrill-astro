/**
 * Optional observer for interval poller ticks (scheduler / publisher /
 * maintenance). No-op until a sink is installed.
 */

export interface ScheduleTickEvent {
  name: string;
  intervalMs: number;
  durationMs: number;
  status: 'ok' | 'failed';
  output?: string;
  exception?: string;
}

let sink: ((event: ScheduleTickEvent) => void) | null = null;

export function setScheduleTickSink(fn: ((event: ScheduleTickEvent) => void) | null): void {
  sink = fn;
}

export function emitScheduleTick(event: ScheduleTickEvent): void {
  if (!sink) return;
  try {
    sink(event);
  } catch {
    /* ignore */
  }
}
