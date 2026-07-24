import { pino, type Logger } from "pino";
import { config } from "@maildrill/config";
import { emitAppLog } from "./observers";

export type { Logger };
export { metrics } from "./metrics";
export type { LabelValues } from "./metrics";
export {
  setAppLogSink,
  setAppEventSink,
  setAppBatchSink,
  setAppCommandSink,
  emitAppEvent,
  emitAppBatch,
  emitAppCommand,
  type AppLogEvent,
  type AppEventEvent,
  type AppBatchEvent,
  type AppCommandEvent,
} from "./observers";
export {
  runHogQL,
  hogqlLiteral,
  hogqlLiteralList,
  columnIndex,
  cellNumber,
  cellString,
  type HogQLResult,
} from "./posthog-query";

const LEVEL_LABEL: Record<number, string> = {
  10: "debug",
  20: "debug",
  30: "info",
  40: "warn",
  50: "error",
  60: "error",
};

export const logger: Logger = pino({
  level: config.log.level,
  hooks: {
    logMethod(args, method, level) {
      try {
        const label = LEVEL_LABEL[level] ?? "info";
        let message = "";
        let context: Record<string, unknown> | undefined;
        if (typeof args[0] === "string") {
          message = args[0];
          if (args.length > 1 && args[1] != null && typeof args[1] === "object") {
            context = args[1] as Record<string, unknown>;
          }
        } else if (args[0] != null && typeof args[0] === "object") {
          context = { ...(args[0] as Record<string, unknown>) };
          if (typeof args[1] === "string") {
            message = args[1];
          } else {
            message = typeof context.msg === "string" ? context.msg : "";
            delete context.msg;
          }
        } else {
          message = String(args[0] ?? "");
        }
        emitAppLog({ level: label, message, context });
      } catch {
        /* never break logging */
      }
      return method.apply(this, args);
    },
  },
  ...(config.isProd || config.isTest
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" },
        },
      }),
});

export function createLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
