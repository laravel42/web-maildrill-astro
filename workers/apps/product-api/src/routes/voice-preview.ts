import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticate } from '@maildrill/authz';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import { config } from '@maildrill/config';

const TAG = ['Voice preview'];

/**
 * In-browser voice template preview with the REAL Infobip TTS voice.
 *
 * Infobip has no "synthesize to file" API — its voices only exist inside
 * calls. So the preview is a short WebRTC call the browser answers silently:
 *
 *   1. POST /v1/voice/preview/session — mint a WebRTC token + one-off
 *      identity; the browser connects the infobip-rtc SDK with it.
 *   2. POST /v1/voice/preview/play — the API places a Calls-API call to that
 *      WEBRTC identity, waits for the browser to answer (state ESTABLISHED),
 *      then plays the text via `/say` with the selected voice/speed, and
 *      schedules a hangup after the estimated read time.
 *
 * Requires INFOBIP_CALLS_CONFIGURATION_ID (a Calls Configuration); without
 * it the endpoints return 501 so the UI can say "not configured".
 */

const sessionTtlSeconds = 600;

/** Poll cadence/budget while waiting for the browser to answer the call. */
const ESTABLISH_POLL_MS = 400;
const ESTABLISH_TIMEOUT_MS = 12_000;

const playSchema = z.object({
  /** WebRTC identity returned by /session — the call's destination. */
  identity: z.string().min(3).max(64),
  text: z.string().min(1).max(1400),
  /** Infobip TTS language code for /say (e.g. "en", "pt-br", "zh-cn"). */
  language: z.string().min(2).max(8),
  /** Exact Infobip voice name, e.g. "Joanna" or "Ardi (neural)". */
  voiceName: z.string().min(2).max(40),
  speechRate: z.number().min(0.5).max(2).default(1),
});

type InfobipJson = Record<string, unknown>;

function configured(): boolean {
  return Boolean(
    config.infobip.baseUrl && config.infobip.apiKey && config.infobip.callsConfigurationId,
  );
}

/** Minimal Calls/WebRTC API client — `Authorization: App <key>`, JSON in/out. */
async function infobip(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; json: InfobipJson }> {
  const base = config.infobip.baseUrl;
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `App ${config.infobip.apiKey}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as InfobipJson;
  return { ok: res.ok, status: res.status, json };
}

function infobipErrorText(json: InfobipJson): string {
  const exception = (json.requestError as InfobipJson | undefined)?.serviceException as
    InfobipJson | undefined;
  return typeof exception?.text === 'string' ? exception.text : 'Infobip request failed';
}

/**
 * Rough spoken-length estimate used to schedule the hangup: TTS averages
 * ~12–15 chars/second at rate 1. Padded and clamped so short texts still get
 * fully read and runaway texts can't hold calls open.
 */
function estimatedSeconds(text: string, rate: number): number {
  const base = Math.ceil(text.length / 12 / rate) + 3;
  return Math.min(Math.max(base, 5), 90);
}

async function waitForEstablished(callId: string): Promise<string> {
  const deadline = Date.now() + ESTABLISH_TIMEOUT_MS;
  let state = 'UNKNOWN';
  while (Date.now() < deadline) {
    const { ok, json } = await infobip('GET', `calls/1/calls/${callId}`);
    state = ok && typeof json.state === 'string' ? json.state : state;
    if (state === 'ESTABLISHED') return state;
    if (['FINISHED', 'FAILED', 'CANCELLED', 'NO_ANSWER', 'BUSY'].includes(state)) return state;
    await new Promise((r) => setTimeout(r, ESTABLISH_POLL_MS));
  }
  return state;
}

export async function voicePreviewRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.post(
    '/v1/voice/preview/session',
    { schema: { tags: TAG, summary: 'Mint a WebRTC token for in-browser voice preview' } },
    async (req, reply) => {
      if (!configured()) {
        return reply.code(501).send({ error: 'voice_preview_not_configured' });
      }
      const identity = `vp-${randomUUID().replace(/-/g, '')}`;
      const { ok, status, json } = await infobip('POST', 'webrtc/1/token', {
        identity,
        displayName: 'Maildrill preview',
        timeToLive: sessionTtlSeconds,
      });
      if (!ok) {
        req.log.error({ status, json }, 'voice preview: webrtc token failed');
        return reply.code(502).send({ error: infobipErrorText(json) });
      }
      return { identity, token: json.token as string };
    },
  );

  app.post(
    '/v1/voice/preview/play',
    {
      schema: {
        tags: TAG,
        summary: "Call the browser's WebRTC identity and read the template via TTS",
        body: playSchema,
      },
    },
    async (req, reply) => {
      if (!configured()) {
        return reply.code(501).send({ error: 'voice_preview_not_configured' });
      }
      const { identity, text, language, voiceName, speechRate } = req.body;

      const created = await infobip('POST', 'calls/1/calls', {
        endpoint: { type: 'WEBRTC', identity },
        from: 'Maildrill',
        fromDisplayName: 'Voice preview',
        callsConfigurationId: config.infobip.callsConfigurationId,
        connectTimeout: 15,
        maxDuration: 120,
        customData: { purpose: 'voice-template-preview', tenantId: req.tenantId },
      });
      if (!created.ok) {
        req.log.error(
          { status: created.status, json: created.json },
          'voice preview: create call failed',
        );
        return reply.code(502).send({ error: infobipErrorText(created.json) });
      }
      const callId = created.json.id as string;

      const state = await waitForEstablished(callId);
      if (state !== 'ESTABLISHED') {
        await infobip('POST', `calls/1/calls/${callId}/hangup`).catch(() => undefined);
        return reply
          .code(502)
          .send({ error: `preview call was not answered by the browser (state ${state})` });
      }

      const say = await infobip('POST', `calls/1/calls/${callId}/say`, {
        text,
        language,
        speechRate,
        preferences: { voiceName },
      });
      if (!say.ok) {
        await infobip('POST', `calls/1/calls/${callId}/hangup`).catch(() => undefined);
        req.log.error({ status: say.status, json: say.json }, 'voice preview: say failed');
        return reply.code(502).send({ error: infobipErrorText(say.json) });
      }

      // Fire-and-forget hangup once the text should be done; the browser can
      // hang up earlier (Stop button) — a late hangup on a finished call is a
      // swallowed 4xx. maxDuration remains the hard backstop.
      const timer = setTimeout(
        () => {
          void infobip('POST', `calls/1/calls/${callId}/hangup`).catch(() => undefined);
        },
        estimatedSeconds(text, speechRate) * 1000,
      );
      timer.unref?.();

      return { callId };
    },
  );
}
