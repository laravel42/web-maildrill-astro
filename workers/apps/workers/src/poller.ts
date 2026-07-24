import type { Logger } from "@maildrill/observability";
import { emitScheduleTick, setScheduleTickSink } from "./schedule-observer";

export type StopFn = () => Promise<void>;
export { setScheduleTickSink };

/**
 * Run an async task on a fixed interval with no overlap (recursive setTimeout),
 * and return a stop function that clears the timer.
 */
export function startPoller(
  name: string,
  intervalMs: number,
  task: () => Promise<void | string | undefined>,
  log: Logger,
): StopFn {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let tickCount = 0;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    const started = performance.now();
    tickCount += 1;
    try {
      const output = await task();
      const durationMs = Math.round(performance.now() - started);
      // Record failures, non-idle ticks, the first tick, and periodic heartbeats
      // so Schedule stays populated without flooding on empty publisher loops.
      if (
        output != null ||
        tickCount === 1 ||
        tickCount % 30 === 0
      ) {
        emitScheduleTick({
          name,
          intervalMs,
          durationMs,
          status: "ok",
          output: typeof output === "string" ? output : "idle",
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      emitScheduleTick({
        name,
        intervalMs,
        durationMs: Math.round(performance.now() - started),
        status: "failed",
        exception: message,
      });
      log.error({ err: message, poller: name }, "poller error");
    }
    if (!stopped) timer = setTimeout(() => void tick(), intervalMs);
  };

  void tick();

  return async () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
