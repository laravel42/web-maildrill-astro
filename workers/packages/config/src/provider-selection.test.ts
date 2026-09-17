import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `@maildrill/config` parses `process.env` and throws at module-evaluation
 * time, so exercising different env combinations means resetting the module
 * registry and re-importing fresh for each case.
 */

const RELEVANT_KEYS = [
  'PROVIDER_DRIVER',
  'PROVIDER_EMAIL_DRIVER',
  'AWS_SES_REGION',
  'AWS_SES_FROM_EMAIL',
  'AWS_SES_CONFIGURATION_SET',
] as const;
// SES_MAX_SEND_RATE / SES_MAX_SEND_PER_DAY are deliberately NOT in this list:
// they're numeric (z.coerce.number()), so forcing them to '' would coerce to
// 0 rather than fall through to the schema default (14 / 50_000) the way an
// empty string does for the string fields above. Neither is set in this
// checkout's real `.env`, so leaving them untouched here reliably exercises
// the schema default.

let snapshot: Record<string, string | undefined>;

beforeEach(() => {
  snapshot = Object.fromEntries(RELEVANT_KEYS.map((k) => [k, process.env[k]]));
  // Force-empty rather than delete: dotenv only fills in *missing* keys, so a
  // deleted key would leak this checkout's real `.env` values (which may
  // already have SES fully configured) back in, making these tests
  // machine-dependent. An explicit '' reliably means "unset" to the schema —
  // except PROVIDER_DRIVER, whose enum has no '' member, so it gets a valid
  // default instead; every test that cares overrides it explicitly anyway.
  for (const k of RELEVANT_KEYS) process.env[k] = '';
  process.env.PROVIDER_DRIVER = 'mock';
  vi.resetModules();
});

afterEach(() => {
  for (const k of RELEVANT_KEYS) {
    if (snapshot[k] === undefined) delete process.env[k];
    else process.env[k] = snapshot[k];
  }
  vi.resetModules();
});

describe('email provider selection (PROVIDER_DRIVER / PROVIDER_EMAIL_DRIVER)', () => {
  it('resolves "mock" with no SES config required', async () => {
    // Set explicitly rather than left unset: a real `.env` in this checkout
    // (dotenv only fills in missing keys) would otherwise leak its own
    // PROVIDER_DRIVER into this "default" case and make the test
    // machine-dependent.
    process.env.PROVIDER_DRIVER = 'mock';
    const { config } = await import('./index');
    expect(config.provider.driver).toBe('mock');
    expect(config.provider.emailDriver).toBe('mock');
  });

  it('resolves "infobip" for the whole account with no SES config required', async () => {
    process.env.PROVIDER_DRIVER = 'infobip';
    const { config } = await import('./index');
    expect(config.provider.driver).toBe('infobip');
    expect(config.provider.emailDriver).toBe('infobip');
  });

  it('resolves "ses" account-wide when configured, and exposes it via config.ses', async () => {
    process.env.PROVIDER_DRIVER = 'ses';
    process.env.AWS_SES_REGION = 'us-east-1';
    process.env.AWS_SES_FROM_EMAIL = 'campaigns@maildrill.net';
    process.env.AWS_SES_CONFIGURATION_SET = 'maildrill-campaigns';
    const { config } = await import('./index');
    expect(config.provider.driver).toBe('ses');
    expect(config.provider.emailDriver).toBe('ses');
    expect(config.ses).toEqual({
      region: 'us-east-1',
      from: 'campaigns@maildrill.net',
      configurationSet: 'maildrill-campaigns',
      maxSendRate: 14,
      maxSendPerDay: 50_000,
    });
  });

  it('routes only the email channel to "ses" while PROVIDER_DRIVER stays on the account default', async () => {
    process.env.PROVIDER_DRIVER = 'infobip';
    process.env.PROVIDER_EMAIL_DRIVER = 'ses';
    process.env.AWS_SES_REGION = 'us-east-1';
    process.env.AWS_SES_FROM_EMAIL = 'campaigns@maildrill.net';
    const { config } = await import('./index');
    expect(config.provider.driver).toBe('infobip');
    expect(config.provider.emailDriver).toBe('ses');
  });

  it('fails fast with an actionable error when PROVIDER_DRIVER=ses is missing AWS_SES_REGION', async () => {
    process.env.PROVIDER_DRIVER = 'ses';
    process.env.AWS_SES_FROM_EMAIL = 'campaigns@maildrill.net';
    await expect(import('./index')).rejects.toThrow(/AWS_SES_REGION/);
  });

  it('fails fast with an actionable error when PROVIDER_EMAIL_DRIVER=ses is missing AWS_SES_FROM_EMAIL', async () => {
    process.env.PROVIDER_EMAIL_DRIVER = 'ses';
    process.env.AWS_SES_REGION = 'us-east-1';
    await expect(import('./index')).rejects.toThrow(/AWS_SES_FROM_EMAIL/);
  });

  it('does not require any SES config when SES is not selected for any channel', async () => {
    process.env.PROVIDER_DRIVER = 'cloudflare';
    const { config } = await import('./index');
    expect(config.provider.driver).toBe('cloudflare');
    expect(config.ses.region).toBe('');
  });

  it('rejects an unsupported driver value at the env layer, before any provider code runs', async () => {
    process.env.PROVIDER_DRIVER = 'sendgrid';
    await expect(import('./index')).rejects.toThrow(/Invalid environment configuration/);
  });
});
