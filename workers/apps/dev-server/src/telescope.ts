import type { FastifyInstance } from 'fastify';
import { EntryType, IncomingEntry, getContext } from '@node-telescope/core';
import type {
  BatchWatcher,
  CacheWatcher,
  CommandWatcher,
  DumpWatcher,
  EventWatcher,
  ExceptionWatcher,
  GateWatcher,
  HttpClientWatcher,
  JobWatcher,
  MailWatcher,
  ModelWatcher,
  NotificationWatcher,
  QueryWatcher,
  RedisWatcher,
  ScheduleWatcher,
  ViewWatcher,
} from '@node-telescope/core';
import { setQuerySink } from '@maildrill/database';
import { setProviderHttpSink, setProviderSendSink } from '@maildrill/providers';
import { setQueueJobSink, setRedisCommandSink } from '@maildrill/queues';
import { setAuthCacheSink, setAuthGateSink } from '@maildrill/authz';
import {
  setAppBatchSink,
  setAppCommandSink,
  setAppEventSink,
  setAppLogSink,
} from '@maildrill/observability';
import { setScheduleTickSink } from '../../workers/src/poller';

function parseBody(raw: string | undefined): unknown {
  if (raw == null || raw === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function mailableName(correlationId: string): string {
  if (correlationId === 'auth-login-code') return 'LoginCode';
  if (correlationId === 'signup-welcome') return 'Welcome';
  return 'CampaignEmail';
}

/** Parse simple Drizzle SQL into a Model action for the Models tab. */
function modelFromSql(
  sql: string,
): { model: string; action: 'created' | 'updated' | 'deleted' } | null {
  const created = /^\s*insert\s+into\s+"?([a-z0-9_]+)"?/i.exec(sql);
  if (created) return { model: created[1]!, action: 'created' };
  const updated = /^\s*update\s+"?([a-z0-9_]+)"?/i.exec(sql);
  if (updated) return { model: updated[1]!, action: 'updated' };
  const deleted = /^\s*delete\s+from\s+"?([a-z0-9_]+)"?/i.exec(sql);
  if (deleted) return { model: deleted[1]!, action: 'deleted' };
  return null;
}

/**
 * The Fastify adapter only auto-records HTTP requests (plus process-level
 * uncaught exceptions and console.* output). These helpers feed the remaining
 * watchers from app events so every dashboard section can populate. Every
 * failure is swallowed — instrumentation must never affect request handling.
 */

/**
 * Record a handled error. Fastify route errors are caught by the error handler
 * and never reach the ExceptionWatcher's process-level uncaught handler, so they
 * would otherwise be invisible.
 */
export function recordTelescopeException(app: FastifyInstance, err: unknown): void {
  try {
    const telescope = app.telescope;
    if (!telescope?.isRecording()) return;
    const error = err instanceof Error ? err : new Error(String(err));
    telescope.watchers
      .get<ExceptionWatcher>(EntryType.Exception)
      ?.recordException(telescope, error);
  } catch {
    /* ignore */
  }
}

/**
 * Route Drizzle queries into the Query watcher (and DML into Models). Only
 * queries made *during an HTTP request* are recorded so background
 * worker/poller queries don't flood the dashboard.
 */
export function instrumentDbQueries(app: FastifyInstance): void {
  const telescope = app.telescope;
  const qw = telescope?.watchers.get<QueryWatcher>(EntryType.Query);
  const mw = telescope?.watchers.get<ModelWatcher>(EntryType.Model);
  if (!telescope || !qw) return;

  setQuerySink((sql, params) => {
    try {
      if (!getContext() || !telescope.isRecording()) return;
      qw.recordQuery(telescope, {
        connection: 'postgres',
        sql,
        bindings: params,
        // Drizzle's logger fires pre-execution, so duration isn't available here.
        duration: 0,
        slow: false,
      });
      const model = modelFromSql(sql);
      if (model && mw) {
        mw.recordModel(telescope, model);
      }
    } catch {
      /* ignore */
    }
  });
}

/**
 * Record outbound provider HTTP calls (Infobip) into the HttpClient watcher.
 * Captures both API-route calls and background worker sends.
 */
export function instrumentProviderHttp(app: FastifyInstance): void {
  const telescope = app.telescope;
  const hw = telescope?.watchers.get<HttpClientWatcher>(EntryType.HttpClient);
  if (!telescope || !hw) return;

  setProviderHttpSink((e) => {
    try {
      if (!telescope.isRecording()) return;
      const responseBody = e.error ? { networkError: e.error } : parseBody(e.responseBody);
      hw.recordHttpClient(telescope, {
        method: e.method,
        url: e.url,
        headers: e.requestHeaders,
        payload: parseBody(e.requestBody),
        status: e.status,
        statusCode: e.status,
        responseHeaders: e.responseHeaders,
        response: responseBody,
        responseBody,
        duration: e.durationMs,
      });
    } catch {
      /* ignore */
    }
  });
}

/** BullMQ enqueue + worker lifecycle → Jobs. */
export function instrumentQueueJobs(app: FastifyInstance): void {
  const telescope = app.telescope;
  const jw = telescope?.watchers.get<JobWatcher>(EntryType.Job);
  if (!telescope || !jw) return;

  setQueueJobSink((e) => {
    try {
      if (!telescope.isRecording()) return;
      jw.recordJob(telescope, {
        name: e.name,
        job: e.name,
        queue: e.queue,
        status: e.status,
        connection: 'redis',
        duration: e.durationMs,
        tries: e.attemptsMade,
        error: e.error,
        exception: e.error,
        data: e.data,
        payload: e.data,
      });
    } catch {
      /* ignore */
    }
  });
}

/** ioredis commands on shared/worker clients → Redis (noise filtered upstream). */
export function instrumentRedis(app: FastifyInstance): void {
  const telescope = app.telescope;
  const rw = telescope?.watchers.get<RedisWatcher>(EntryType.Redis);
  if (!telescope || !rw) return;

  setRedisCommandSink((e) => {
    try {
      if (!telescope.isRecording()) return;
      rw.recordRedis(telescope, {
        command: e.command,
        connection: e.connection,
        duration: e.durationMs,
        parameters: e.args,
        args: e.args,
      });
    } catch {
      /* ignore */
    }
  });
}

/** Provider send() → Mail (email) or Notifications (sms/whatsapp/voice). */
export function instrumentProviderSend(app: FastifyInstance): void {
  const telescope = app.telescope;
  const mail = telescope?.watchers.get<MailWatcher>(EntryType.Mail);
  const note = telescope?.watchers.get<NotificationWatcher>(EntryType.Notification);
  if (!telescope || (!mail && !note)) return;

  setProviderSendSink((e) => {
    try {
      if (!telescope.isRecording()) return;
      const viaQueue = !getContext();
      if (e.channel === 'email' && mail) {
        mail.recordMail(telescope, {
          mailable: mailableName(e.correlationId),
          class: mailableName(e.correlationId),
          to: e.to,
          from: e.from ?? '',
          subject: e.subject ?? '',
          html: e.hasHtml ?? false,
          queued: viaQueue,
          data: {
            messageId: e.messageId,
            tenantId: e.tenantId,
            provider: e.provider,
            accepted: e.accepted,
            providerMessageId: e.providerMessageId,
            error: e.error,
            durationMs: e.durationMs,
          },
        });
        return;
      }
      note?.recordNotification(telescope, {
        channel: e.channel,
        notification: `send-${e.channel}`,
        class: `send-${e.channel}`,
        notifiable: e.to,
        response: {
          accepted: e.accepted,
          providerMessageId: e.providerMessageId,
          error: e.error,
        },
        data: {
          messageId: e.messageId,
          tenantId: e.tenantId,
          provider: e.provider,
          correlationId: e.correlationId,
          durationMs: e.durationMs,
          viaQueue,
        },
      });
    } catch {
      /* ignore */
    }
  });
}

/** Interval pollers → Schedule. */
export function instrumentSchedule(app: FastifyInstance): void {
  const telescope = app.telescope;
  const sw = telescope?.watchers.get<ScheduleWatcher>(EntryType.Schedule);
  if (!telescope || !sw) return;

  setScheduleTickSink((e) => {
    try {
      if (!telescope.isRecording()) return;
      sw.recordSchedule(telescope, {
        name: e.name,
        command: e.name,
        expression: `every ${e.intervalMs}ms`,
        status: e.status,
        duration: e.durationMs,
        output: e.output,
        exception: e.exception,
      });
    } catch {
      /* ignore */
    }
  });
}

/** API-key / JWT authenticate → Gates. */
export function instrumentAuthGate(app: FastifyInstance): void {
  const telescope = app.telescope;
  const gw = telescope?.watchers.get<GateWatcher>(EntryType.Gate);
  if (!telescope || !gw) return;

  setAuthGateSink((e) => {
    try {
      if (!telescope.isRecording()) return;
      gw.recordGate(telescope, {
        ability: e.ability,
        permission: e.ability,
        result: e.result,
        user: e.userId ?? e.tenantId,
        arguments: [{ method: e.method, path: e.path }],
      });
    } catch {
      /* ignore */
    }
  });
}

/** In-process API-key→tenant map → Cache. */
export function instrumentAuthCache(app: FastifyInstance): void {
  const telescope = app.telescope;
  const cw = telescope?.watchers.get<CacheWatcher>(EntryType.Cache);
  if (!telescope || !cw) return;

  setAuthCacheSink((e) => {
    try {
      if (!getContext() || !telescope.isRecording()) return;
      cw.recordCache(telescope, {
        type: e.type,
        command: e.type,
        key: e.key,
        value: e.value,
      });
    } catch {
      /* ignore */
    }
  });
}

/** Pino → Logs (console.* already covered by LogWatcher). */
export function instrumentAppLogs(app: FastifyInstance): void {
  const telescope = app.telescope;
  if (!telescope) return;

  setAppLogSink((e) => {
    try {
      if (!telescope.isRecording()) return;
      // LogWatcher has no public recordLog — go through the entry pipeline.
      telescope.recordEntry(
        new IncomingEntry(EntryType.Log, {
          level: e.level,
          message: e.message,
          context: e.context ?? {},
        }),
      );
    } catch {
      /* ignore */
    }
  });
}

/** Domain/outbox/webhook emissions → Events. */
export function instrumentAppEvents(app: FastifyInstance): void {
  const telescope = app.telescope;
  const ew = telescope?.watchers.get<EventWatcher>(EntryType.Event);
  if (!telescope || !ew) return;

  setAppEventSink((e) => {
    try {
      if (!telescope.isRecording()) return;
      ew.recordEvent(telescope, {
        name: e.name,
        event: e.name,
        listeners: e.listeners ?? [],
        payload: e.payload,
        data: e.payload,
      });
    } catch {
      /* ignore */
    }
  });
}

/** Outbox publish batches → Batches. */
export function instrumentAppBatches(app: FastifyInstance): void {
  const telescope = app.telescope;
  const bw = telescope?.watchers.get<BatchWatcher>(EntryType.Batch);
  if (!telescope || !bw) return;

  setAppBatchSink((e) => {
    try {
      if (!telescope.isRecording()) return;
      bw.recordBatch(telescope, {
        name: e.name,
        totalJobs: e.totalJobs,
        pendingJobs: e.pendingJobs,
        failedJobs: e.failedJobs,
        completedJobs: e.completedJobs,
        processedJobs: e.completedJobs + e.failedJobs,
        progress:
          e.totalJobs > 0
            ? Math.round(((e.completedJobs + e.failedJobs) / e.totalJobs) * 100)
            : 100,
        data: e.data,
      });
    } catch {
      /* ignore */
    }
  });
}

/** Worker role starts → Commands. */
export function instrumentAppCommands(app: FastifyInstance): void {
  const telescope = app.telescope;
  const cw = telescope?.watchers.get<CommandWatcher>(EntryType.Command);
  if (!telescope || !cw) return;

  setAppCommandSink((e) => {
    try {
      if (!telescope.isRecording()) return;
      cw.recordCommand(telescope, {
        command: e.command,
        name: e.command,
        exitCode: e.exitCode,
        exit_code: e.exitCode,
        duration: e.durationMs,
        arguments: e.arguments,
        args: e.arguments,
        output: e.output,
      });
    } catch {
      /* ignore */
    }
  });
}

/**
 * HTML/document responses (Scalar docs, OpenAPI) → Views. This API has no
 * server-rendered templates; treating docs pages as views keeps the tab honest.
 */
export function instrumentViews(app: FastifyInstance): void {
  const telescope = app.telescope;
  const vw = telescope?.watchers.get<ViewWatcher>(EntryType.View);
  if (!telescope || !vw) return;

  app.addHook('onResponse', (req, reply, done) => {
    try {
      if (!telescope.isRecording()) {
        done();
        return;
      }
      const path = req.url.split('?')[0] ?? req.url;
      if (path === '/docs' || path === '/openapi.json') {
        vw.recordView(telescope, {
          name: path,
          view: path,
          path,
          duration: reply.elapsedTime,
          data: { statusCode: reply.statusCode, method: req.method },
        });
      }
    } catch {
      /* ignore */
    }
    done();
  });
}

/** Install `globalThis.dump(...)` → Dumps (Laravel-style debug helper). */
export function instrumentDump(app: FastifyInstance): void {
  const telescope = app.telescope;
  const dw = telescope?.watchers.get<DumpWatcher>(EntryType.Dump);
  if (!telescope || !dw) return;

  const dump = (...values: unknown[]): void => {
    try {
      if (!telescope.isRecording()) return;
      for (const value of values) {
        dw.recordDump(telescope, { dump: value, content: value });
      }
    } catch {
      /* ignore */
    }
  };

  (globalThis as typeof globalThis & { dump?: typeof dump }).dump = dump;

  // Seed one entry so the Dumps tab isn't empty on a fresh boot; use dump() in
  // app code anytime for more.
  dump({
    tip: 'Call globalThis.dump(value) from anywhere in the process to capture here',
    telescope: true,
  });
}

/** Wire every watcher sink. Call once after listen (when `app.telescope` exists). */
export function instrumentAllTelescope(app: FastifyInstance): void {
  instrumentDbQueries(app);
  instrumentProviderHttp(app);
  instrumentQueueJobs(app);
  instrumentRedis(app);
  instrumentProviderSend(app);
  instrumentSchedule(app);
  instrumentAuthGate(app);
  instrumentAuthCache(app);
  instrumentAppLogs(app);
  instrumentAppEvents(app);
  instrumentAppBatches(app);
  instrumentAppCommands(app);
  instrumentViews(app);
  instrumentDump(app);
}
