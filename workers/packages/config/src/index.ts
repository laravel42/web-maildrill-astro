import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Prefer the monorepo root `.env` (Astro + workers share one file). Fall back to
 * `workers/.env` for older checkouts, then cwd.
 */
const configDir = dirname(fileURLToPath(import.meta.url));
const workersRoot = resolve(configDir, '../../..');
const monorepoRoot = resolve(workersRoot, '..');
const rootEnv = resolve(monorepoRoot, '.env');
const workersEnv = resolve(workersRoot, '.env');
if (existsSync(rootEnv)) {
  loadDotenv({ path: rootEnv });
} else if (existsSync(workersEnv)) {
  loadDotenv({ path: workersEnv });
} else {
  loadDotenv();
}

const int = (def: number) => z.coerce.number().int().default(def);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  API_HOST: z.string().default('0.0.0.0'),
  API_PORT: int(3002),
  PRODUCT_API_PORT: int(3001),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgres://maildrill:maildrill@localhost:5432/maildrill'),
  PG_POOL_MAX: int(10),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_KEYS: z.string().default(''),
  JWT_SECRET: z.string().default('change-me'),
  APP_URL: z.string().default('http://localhost:4321'),

  // --- Billing (Stripe checkout/portal/webhooks; wallet lives in Postgres) ---
  /** `stripe` for real payments, `mock` for dev/tests without network. */
  BILLING_PROVIDER: z.enum(['stripe', 'mock']).default('stripe'),
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
  /**
   * `1` blocks sends when credits run out (reserve → commit → release).
   * Default off so existing installs keep sending while billing is rolled out.
   */
  BILLING_ENFORCEMENT: z.string().default('0'),
  /** Held credits are swept back to the wallet after this long. */
  BILLING_RESERVATION_TTL_MINUTES: int(120),
  MAGIC_LINK_TTL_MINUTES: int(15),
  /**
   * Account security (passkeys / TOTP 2FA). SECURITY_ENCRYPTION_KEY encrypts
   * TOTP secrets at rest (AES-256-GCM) — 32 bytes, base64 or hex. Empty in dev
   * derives a key from JWT_SECRET with a boot warning; production requires it
   * once 2FA is used. WEBAUTHN_RP_ID must be the registrable domain the app is
   * served on; WEBAUTHN_ORIGINS is a comma-separated list of exact origins
   * allowed to complete WebAuthn ceremonies.
   */
  SECURITY_ENCRYPTION_KEY: z.string().default(''),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_RP_NAME: z.string().default('Maildrill'),
  WEBAUTHN_ORIGINS: z.string().default('http://localhost:4321'),
  TRUSTED_DEVICE_TTL_DAYS: int(60),
  SESSION_TTL_DAYS: int(30),
  REAUTH_WINDOW_MINUTES: int(10),
  /**
   * Cloudflare Email Service SMTP relay (smtp.mx.cloudflare.net) — carries ALL
   * transactional mail (login codes, welcome). Campaign email rides the
   * provider drivers (PROVIDER_DRIVER / PROVIDER_EMAIL_DRIVER), never this relay.
   * Shared with the Astro sender via the root `.env`. Unset host/user/pass →
   * transactional sends no-op, for dev without credentials.
   */
  SMTP_HOST: z.string().default(''),
  // Cloudflare Email Service SMTP is SMTPS on 465 only (no STARTTLS / 587).
  SMTP_PORT: int(465),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  /** Explicit TLS override; empty → implicit TLS iff port 465, else STARTTLS. */
  SMTP_SECURE: z.string().default(''),
  MAIL_FROM: z.string().default('Maildrill <hello@maildrill.net>'),
  INFOBIP_BASE_URL: z.string().default(''),
  INFOBIP_API_KEY: z.string().default(''),
  INFOBIP_FROM: z.string().default('no-reply@maildrill.net'),
  /** E.164 numeric sender shared by SMS / WhatsApp / Voice when a channel override is unset. */
  INFOBIP_PHONE_FROM: z.string().default(''),
  /** Per-channel sender overrides; each falls back to INFOBIP_PHONE_FROM. */
  INFOBIP_SMS_FROM: z.string().default(''),
  INFOBIP_WHATSAPP_FROM: z.string().default(''),
  INFOBIP_VOICE_FROM: z.string().default(''),
  /**
   * Calls Configuration ID (Calls API + WebRTC). Powers the in-browser voice
   * template preview: the API places a Calls-API call to the user's WebRTC
   * identity and plays the template via TTS. Empty → preview endpoints 501.
   */
  INFOBIP_CALLS_CONFIGURATION_ID: z.string().default(''),
  /**
   * Optional CPaaS X identity. Required when the API key and/or WhatsApp/SMS
   * senders are bound to an Application/Entity in the Infobip portal — omitting
   * them (or mismatching) yields FORBIDDEN / UNAUTHORIZED. Leave empty for a
   * main account key with unbound senders. Do not use placeholder values
   * ("default" alone is fine as Infobip's auto app; fake entity IDs are not).
   */
  INFOBIP_APPLICATION_ID: z
    .string()
    .default('')
    .transform((v) => v.split('#')[0]?.trim() ?? ''),
  INFOBIP_ENTITY_ID: z
    .string()
    .default('')
    .transform((v) => v.split('#')[0]?.trim() ?? ''),
  /**
   * Optional Infobip `notifyUrl` stamped on outbound sends so DLRs are pushed
   * (typically the PostHog Infobip webhook `?kind=delivery`). Paired with
   * `callbackData`, it lets the poller reconcile the DLR back to the message.
   * Leave empty to rely on portal subscriptions + Messages API report pull.
   */
  INFOBIP_NOTIFY_URL: z.string().default(''),
  /**
   * Optional Infobip open/click/unsub/complaint push target (typically the
   * PostHog Infobip webhook `?kind=tracking`). Empty → derive from
   * INFOBIP_NOTIFY_URL by swapping `kind=tracking`, or disable tracking stamp.
   */
  INFOBIP_TRACKING_URL: z.string().default(''),
  /**
   * Public URL Infobip POSTs billing-usage results to, e.g.
   * `https://api.example.com/v1/billing/webhooks/infobip-usage`. Empty turns
   * the whole provider-usage reconciliation off: without a reachable callback
   * the query API has nowhere to answer, and Infobip delivers each result
   * exactly once with no retry, so firing queries we cannot receive would
   * burn the (current month + previous two) data window for nothing.
   */
  INFOBIP_BILLING_CALLBACK_URL: z.string().default(''),
  /**
   * Transport for the billing-usage result. `auto` prefers a direct URL when
   * one is set and otherwise reuses the PostHog webhook that already receives
   * Infobip DLRs (derived from INFOBIP_NOTIFY_URL with `kind=billing`), which
   * means the reconciliation works without exposing product-api publicly.
   * `direct` refuses to fall back; `posthog` forces the derived webhook.
   */
  INFOBIP_BILLING_CALLBACK_TRANSPORT: z.enum(['auto', 'direct', 'posthog']).default('auto'),
  /**
   * Channels whose sends carry `campaignReferenceId`. Defaults to the two
   * whose field placement the Infobip OpenAPI spec actually documents; adding
   * `whatsapp,voice` is a one-line change once verified against a live
   * account, and until then those channels reconcile at account level rather
   * than risking a rejected send.
   */
  INFOBIP_CAMPAIGN_REF_CHANNELS: z.string().default('email,sms'),
  /**
   * Shared secret appended to the callback URL as `?token=` and required back
   * on every delivery. Infobip signs nothing, so the unguessable URL IS the
   * authentication — the same reasoning as the unsubscribe token.
   */
  INFOBIP_BILLING_CALLBACK_TOKEN: z.string().default(''),
  PROVIDER_DRIVER: z.enum(['mock', 'infobip', 'cloudflare']).default('mock'),
  /**
   * Optional per-channel override: route ONLY the email channel through a
   * different driver (e.g. Cloudflare Email Service, which carries no other
   * channel) while SMS/WhatsApp/Voice stay on PROVIDER_DRIVER. Empty → email
   * follows PROVIDER_DRIVER.
   */
  PROVIDER_EMAIL_DRIVER: z.enum(['', 'mock', 'infobip', 'cloudflare']).default(''),
  /**
   * Cloudflare Email Service — Email Sending REST API, used by the
   * `cloudflare` campaign email driver (distinct from the SMTP relay that
   * carries transactional mail). The From domain must be onboarded to Email
   * Sending on this account; the token needs the Email Sending permission.
   */
  CLOUDFLARE_ACCOUNT_ID: z.string().default(''),
  CLOUDFLARE_EMAIL_API_TOKEN: z.string().default(''),
  /** Default sender when a campaign doesn't carry its own From address. */
  CLOUDFLARE_EMAIL_FROM: z.string().default('no-reply@maildrill.net'),
  /**
   * Cloudflare Queue that Email Sending event subscriptions publish to
   * (delivered/deferred/bounced/failed/rejected/complained). Empty → the
   * cloudflare-email-events poller stays off. The token needs Queues
   * Read+Write; empty CLOUDFLARE_EVENTS_API_TOKEN reuses the email token.
   */
  CLOUDFLARE_EVENTS_QUEUE_ID: z.string().default(''),
  CLOUDFLARE_EVENTS_API_TOKEN: z.string().default(''),
  CLOUDFLARE_EVENTS_POLL_INTERVAL_MS: int(10_000),
  WEBHOOK_INFOBIP_SECRET: z.string().default('change-me'),
  DISPATCH_CONCURRENCY: int(10),
  DISPATCH_MAX_ATTEMPTS: int(5),
  DISPATCH_BACKOFF_MS: int(2000),
  OUTBOX_POLL_INTERVAL_MS: int(1000),
  OUTBOX_BATCH_SIZE: int(100),
  SCHEDULER_INTERVAL_MS: int(5000),
  SCHEDULER_BATCH_SIZE: int(200),
  RATE_LIMIT_MAX: int(100),
  RATE_LIMIT_DURATION_MS: int(1000),
  // Media library storage: S3 for objects, CloudFront for delivery. Empty
  // values mean media is unconfigured and its endpoints refuse rather than
  // pretend to store anything.
  AWS_REGION: z.string().default(''),
  AWS_ACCESS_KEY_ID: z.string().default(''),
  AWS_SECRET_ACCESS_KEY: z.string().default(''),
  MEDIA_S3_BUCKET: z.string().default(''),
  MEDIA_CDN_DOMAIN: z.string().default(''),
  MEDIA_MAX_BYTES: int(15 * 1024 * 1024),
  /** How often to poll Infobip for pending WhatsApp template approvals. */
  TEMPLATE_APPROVAL_POLL_INTERVAL_MS: int(60_000),
  /** How often to sync campaign/message DLRs from PostHog HogQL. */
  CAMPAIGN_DELIVERY_POLL_INTERVAL_MS: int(5_000),
  /**
   * Safety net: terminate messages a provider accepted (submitted/sent) but never
   * issued a final DLR for, once they pass this TTL. Without it a single missing
   * DLR pins its campaign in "sending" forever. Default 72h; set 0 to disable.
   */
  DELIVERY_STALE_EXPIRE_MS: int(72 * 60 * 60_000),
  /**
   * PostHog HogQL (in-app Analytics + campaign delivery poller). Personal API
   * key with Query Read — not the project write token (`phc_`). Leave empty to
   * keep Postgres-only stats / skip PostHog DLR sync.
   */
  POSTHOG_PERSONAL_API_KEY: z.string().default(''),
  POSTHOG_PROJECT_ID: z.string().default('526344'),
  POSTHOG_APP_HOST: z.string().default('https://us.posthog.com'),
  /**
   * Ingestion (write) key — distinct from POSTHOG_PERSONAL_API_KEY, which only
   * reads via HogQL. Already used by the seeder to mirror events; capture
   * reuses it rather than introducing a second name for the same secret.
   * Ingestion goes to `us.i.posthog.com`, not the app host.
   */
  POSTHOG_PROJECT_API_KEY: z.string().default(''),
  POSTHOG_INGEST_HOST: z.string().default('https://us.i.posthog.com'),
  /** Empty = auto-on when personal key set. Set 0/false to force Postgres. */
  POSTHOG_STATS_ENABLED: z.string().default(''),

  // --- Automations (visual workflows) ---
  /**
   * Execution budgets. These are the blast radius of a badly-built workflow, so they are
   * enforced by the engine rather than trusted to the composer: a step budget stops a
   * router loop, a wall-clock budget stops a run that waits on a slow provider forever,
   * and the payload cap stops a webhook from parking megabytes in `trigger_payload`.
   */
  AUTOMATION_MAX_STEPS_PER_RUN: int(100),
  AUTOMATION_MAX_LOOP_ITERATIONS: int(200),
  /** Wall clock for one *segment* of a run (between pauses), not the whole workflow. */
  AUTOMATION_RUN_TIMEOUT_MS: int(120_000),
  AUTOMATION_MAX_PAYLOAD_BYTES: int(128 * 1024),
  /** HTTP-request action: response cap and timeout. */
  AUTOMATION_HTTP_MAX_RESPONSE_BYTES: int(1024 * 1024),
  AUTOMATION_HTTP_TIMEOUT_MS: int(15_000),
  AUTOMATION_HTTP_MAX_REDIRECTS: int(3),
  /**
   * `1` lets the HTTP action reach private/loopback addresses. Off by default — with it
   * off, a workflow cannot be used to probe the internal network (SSRF). Only ever turn it
   * on for a local development stack.
   */
  AUTOMATION_HTTP_ALLOW_PRIVATE: z.string().default('0'),
  /** BullMQ concurrency for the automation-run worker. */
  AUTOMATION_RUN_CONCURRENCY: int(5),
  /** How often the dispatcher drains `automation_events`. */
  AUTOMATION_DISPATCH_INTERVAL_MS: int(1_000),
  AUTOMATION_DISPATCH_BATCH_SIZE: int(50),
  /** How often waiting runs whose `resume_at` passed are re-queued. */
  AUTOMATION_RESUME_INTERVAL_MS: int(15_000),
  /** A run held by a worker for longer than this is presumed dead and re-queued. */
  AUTOMATION_STALL_MS: int(5 * 60_000),
  /** How often segment membership is diffed for `entered`/`exited` triggers. */
  AUTOMATION_SEGMENT_POLL_INTERVAL_MS: int(60_000),
  /** Ceiling on subscribers examined per segment per poll. */
  AUTOMATION_SEGMENT_MAX_SUBSCRIBERS: int(5_000),
  /** Max automation runs one workspace may have in flight. 0 disables the cap. */
  AUTOMATION_MAX_CONCURRENT_RUNS_PER_TENANT: int(50),
});

export interface ApiKey {
  id: string;
  secret: string;
}

function parseApiKeys(raw: string): ApiKey[] {
  return raw
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(':');
      if (idx === -1) {
        throw new Error(`Invalid API_KEYS entry (expected "id:secret"): ${pair}`);
      }
      return { id: pair.slice(0, idx), secret: pair.slice(idx + 1) };
    });
}

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}
const env = parsed.data;

const WEAK_SECRETS = new Set(['', 'change-me', 'change-me-in-production']);
if (env.NODE_ENV === 'production') {
  if (WEAK_SECRETS.has(env.JWT_SECRET.trim())) {
    throw new Error(
      'JWT_SECRET must be set to a strong non-default value when NODE_ENV=production',
    );
  }
  if (WEAK_SECRETS.has(env.WEBHOOK_INFOBIP_SECRET.trim())) {
    throw new Error(
      'WEBHOOK_INFOBIP_SECRET must be set to a strong non-default value when NODE_ENV=production',
    );
  }
  // The billing callback carries spend data and drives wallet adjustments; an
  // unguessable token is the only thing standing in front of it.
  if (
    env.INFOBIP_BILLING_CALLBACK_URL.trim() &&
    WEAK_SECRETS.has(env.INFOBIP_BILLING_CALLBACK_TOKEN.trim())
  ) {
    throw new Error(
      'INFOBIP_BILLING_CALLBACK_TOKEN must be set to a strong non-default value when INFOBIP_BILLING_CALLBACK_URL is configured',
    );
  }
  // Accepting unverifiable payment webhooks is worse than accepting none.
  if (env.STRIPE_SECRET_KEY.trim() && WEAK_SECRETS.has(env.STRIPE_WEBHOOK_SECRET.trim())) {
    throw new Error(
      'STRIPE_WEBHOOK_SECRET must be set when STRIPE_SECRET_KEY is configured in production',
    );
  }
}

export const config = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  log: { level: env.LOG_LEVEL },
  api: { host: env.API_HOST, port: env.API_PORT },
  productApi: { host: env.API_HOST, port: env.PRODUCT_API_PORT },
  db: { url: env.DATABASE_URL, poolMax: env.PG_POOL_MAX },
  redis: { url: env.REDIS_URL },
  app: { url: env.APP_URL },
  billing: {
    provider: env.BILLING_PROVIDER,
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
    enforcement: env.BILLING_ENFORCEMENT === '1' || env.BILLING_ENFORCEMENT === 'true',
    reservationTtlMinutes: env.BILLING_RESERVATION_TTL_MINUTES,
    get configured(): boolean {
      return env.BILLING_PROVIDER === 'mock'
        ? true
        : Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
    },
  },
  automations: {
    maxStepsPerRun: env.AUTOMATION_MAX_STEPS_PER_RUN,
    maxLoopIterations: env.AUTOMATION_MAX_LOOP_ITERATIONS,
    runTimeoutMs: env.AUTOMATION_RUN_TIMEOUT_MS,
    maxPayloadBytes: env.AUTOMATION_MAX_PAYLOAD_BYTES,
    httpMaxResponseBytes: env.AUTOMATION_HTTP_MAX_RESPONSE_BYTES,
    httpTimeoutMs: env.AUTOMATION_HTTP_TIMEOUT_MS,
    httpMaxRedirects: env.AUTOMATION_HTTP_MAX_REDIRECTS,
    httpAllowPrivate:
      env.AUTOMATION_HTTP_ALLOW_PRIVATE === '1' || env.AUTOMATION_HTTP_ALLOW_PRIVATE === 'true',
    runConcurrency: env.AUTOMATION_RUN_CONCURRENCY,
    dispatchIntervalMs: env.AUTOMATION_DISPATCH_INTERVAL_MS,
    dispatchBatchSize: env.AUTOMATION_DISPATCH_BATCH_SIZE,
    resumeIntervalMs: env.AUTOMATION_RESUME_INTERVAL_MS,
    stallMs: env.AUTOMATION_STALL_MS,
    segmentPollIntervalMs: env.AUTOMATION_SEGMENT_POLL_INTERVAL_MS,
    segmentMaxSubscribers: env.AUTOMATION_SEGMENT_MAX_SUBSCRIBERS,
    maxConcurrentRunsPerTenant: env.AUTOMATION_MAX_CONCURRENT_RUNS_PER_TENANT,
  },
  auth: {
    apiKeys: parseApiKeys(env.API_KEYS),
    jwtSecret: env.JWT_SECRET,
    magicLinkTtlMinutes: env.MAGIC_LINK_TTL_MINUTES,
  },
  security: {
    encryptionKey: env.SECURITY_ENCRYPTION_KEY,
    rpId: env.WEBAUTHN_RP_ID,
    rpName: env.WEBAUTHN_RP_NAME,
    webauthnOrigins: env.WEBAUTHN_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    trustedDeviceTtlDays: env.TRUSTED_DEVICE_TTL_DAYS,
    sessionTtlDays: env.SESSION_TTL_DAYS,
    reauthWindowMinutes: env.REAUTH_WINDOW_MINUTES,
  },
  mail: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : env.SMTP_PORT === 465,
    from: env.MAIL_FROM,
  },
  infobip: {
    baseUrl: env.INFOBIP_BASE_URL,
    apiKey: env.INFOBIP_API_KEY,
    from: env.INFOBIP_FROM,
    phoneFrom: env.INFOBIP_PHONE_FROM,
    smsFrom: env.INFOBIP_SMS_FROM || env.INFOBIP_PHONE_FROM,
    whatsappFrom: env.INFOBIP_WHATSAPP_FROM || env.INFOBIP_PHONE_FROM,
    voiceFrom: env.INFOBIP_VOICE_FROM || env.INFOBIP_PHONE_FROM,
    callsConfigurationId: env.INFOBIP_CALLS_CONFIGURATION_ID,
    applicationId: env.INFOBIP_APPLICATION_ID,
    entityId: env.INFOBIP_ENTITY_ID,
    notifyUrl: env.INFOBIP_NOTIFY_URL,
    campaignRefChannels: env.INFOBIP_CAMPAIGN_REF_CHANNELS.split(',')
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean),
    billingCallbackUrl: env.INFOBIP_BILLING_CALLBACK_URL,
    billingCallbackToken: env.INFOBIP_BILLING_CALLBACK_TOKEN,
    billingCallbackTransport: env.INFOBIP_BILLING_CALLBACK_TRANSPORT,
    /**
     * Where Infobip should POST the billing-usage result, and how we get it
     * back.
     *
     *   direct   → our own product-api endpoint; the `?token=` is the auth and
     *              the result is ingested the moment it lands.
     *   posthog  → the same webhook that already receives Infobip DLRs, with
     *              `kind=billing`. Nothing of ours needs to be public, but the
     *              result arrives in PostHog rather than in our process, so a
     *              poller pulls it back out (see `pullBillingUsageResults`).
     *
     * The PostHog form carries no secret because it cannot: that endpoint
     * accepts any POST from anyone. The guard is downstream instead — a result
     * is only ever ingested if its `requestId` matches a request row WE
     * created, which is unforgeable without having seen our submission.
     */
    get billingCallback(): { url: string; transport: 'direct' | 'posthog' } | null {
      const explicit = env.INFOBIP_BILLING_CALLBACK_URL.trim();
      const mode = env.INFOBIP_BILLING_CALLBACK_TRANSPORT;
      if (mode !== 'posthog' && explicit) {
        // A direct endpoint without its token is not usable: the route refuses
        // every delivery, so submitting would burn the one-shot result.
        if (!env.INFOBIP_BILLING_CALLBACK_TOKEN.trim()) return null;
        const sep = explicit.includes('?') ? '&' : '?';
        return {
          url: `${explicit}${sep}token=${encodeURIComponent(env.INFOBIP_BILLING_CALLBACK_TOKEN.trim())}`,
          transport: 'direct',
        };
      }
      if (mode === 'direct') return null;
      const notify = env.INFOBIP_NOTIFY_URL.trim();
      if (!notify) return null;
      // Same swap the tracking URL uses: one webhook, discriminated by `kind`.
      const url = notify.includes('kind=')
        ? notify.replace(/kind=[^&]*/, 'kind=billing')
        : `${notify}${notify.includes('?') ? '&' : '?'}kind=billing`;
      return { url, transport: 'posthog' };
    },
    /**
     * Reconciliation needs a key, a base URL, and a callback route. The PostHog
     * transport additionally needs read access to pull the result back, which
     * is the same personal key the stats queries use.
     */
    get billingUsageEnabled(): boolean {
      if (!env.INFOBIP_API_KEY || !env.INFOBIP_BASE_URL) return false;
      const callback = this.billingCallback;
      if (!callback) return false;
      if (callback.transport === 'posthog' && !env.POSTHOG_PERSONAL_API_KEY) return false;
      return true;
    },
    /**
     * Engagement tracking callback. Prefer explicit INFOBIP_TRACKING_URL; else
     * rewrite notifyUrl's `kind` query to `tracking` so open/click payloads
     * don't collide with DLR/seen mapping in Hog.
     */
    get trackingUrl(): string {
      const explicit = env.INFOBIP_TRACKING_URL.trim();
      if (explicit) return explicit;
      const notify = env.INFOBIP_NOTIFY_URL.trim();
      if (!notify) return '';
      try {
        const u = new URL(notify);
        u.searchParams.set('kind', 'tracking');
        return u.toString();
      } catch {
        return '';
      }
    },
  },
  provider: {
    driver: env.PROVIDER_DRIVER,
    /** Driver for the email channel: PROVIDER_EMAIL_DRIVER when set, else PROVIDER_DRIVER. */
    emailDriver: env.PROVIDER_EMAIL_DRIVER || env.PROVIDER_DRIVER,
  },
  cloudflare: {
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: env.CLOUDFLARE_EMAIL_API_TOKEN,
    from: env.CLOUDFLARE_EMAIL_FROM,
    eventsQueueId: env.CLOUDFLARE_EVENTS_QUEUE_ID,
    eventsApiToken: env.CLOUDFLARE_EVENTS_API_TOKEN || env.CLOUDFLARE_EMAIL_API_TOKEN,
    eventsPollIntervalMs: env.CLOUDFLARE_EVENTS_POLL_INTERVAL_MS,
  },
  media: {
    region: env.AWS_REGION,
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    bucket: env.MEDIA_S3_BUCKET,
    cdnDomain: env.MEDIA_CDN_DOMAIN,
    maxBytes: env.MEDIA_MAX_BYTES,
    /** Media is usable only when a bucket and a delivery domain are both set. */
    get configured(): boolean {
      return Boolean(env.MEDIA_S3_BUCKET && env.MEDIA_CDN_DOMAIN && env.AWS_REGION);
    },
  },
  webhooks: { infobipSecret: env.WEBHOOK_INFOBIP_SECRET },
  posthog: {
    personalApiKey: env.POSTHOG_PERSONAL_API_KEY,
    projectId: env.POSTHOG_PROJECT_ID,
    appHost: env.POSTHOG_APP_HOST.replace(/\/$/, ''),
    projectToken: env.POSTHOG_PROJECT_API_KEY,
    ingestHost: env.POSTHOG_INGEST_HOST.replace(/\/$/, ''),
    /** Capture is a separate capability from stats: writing needs the token. */
    get captureEnabled(): boolean {
      return Boolean(env.POSTHOG_PROJECT_API_KEY);
    },
    /**
     * Query-backed stats: on when a personal key is set, unless explicitly
     * disabled via POSTHOG_STATS_ENABLED=0|false|no.
     */
    get statsEnabled(): boolean {
      const t = env.POSTHOG_STATS_ENABLED.trim().toLowerCase();
      if (t === '0' || t === 'false' || t === 'no') return false;
      if (t === '1' || t === 'true' || t === 'yes') return Boolean(env.POSTHOG_PERSONAL_API_KEY);
      return Boolean(env.POSTHOG_PERSONAL_API_KEY);
    },
  },
  dispatch: {
    concurrency: env.DISPATCH_CONCURRENCY,
    maxAttempts: env.DISPATCH_MAX_ATTEMPTS,
    backoffMs: env.DISPATCH_BACKOFF_MS,
  },
  outbox: {
    pollIntervalMs: env.OUTBOX_POLL_INTERVAL_MS,
    batchSize: env.OUTBOX_BATCH_SIZE,
  },
  scheduler: {
    intervalMs: env.SCHEDULER_INTERVAL_MS,
    batchSize: env.SCHEDULER_BATCH_SIZE,
  },
  templateApproval: {
    pollIntervalMs: env.TEMPLATE_APPROVAL_POLL_INTERVAL_MS,
  },
  campaignDelivery: {
    pollIntervalMs: env.CAMPAIGN_DELIVERY_POLL_INTERVAL_MS,
    staleExpireMs: env.DELIVERY_STALE_EXPIRE_MS,
  },
  rateLimit: { max: env.RATE_LIMIT_MAX, durationMs: env.RATE_LIMIT_DURATION_MS },
} as const;

export type Config = typeof config;
