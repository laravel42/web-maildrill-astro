import { config } from '@maildrill/config';
import { sharedConnection } from '@maildrill/queues';
import type { MessagingProvider } from './core';
import { MockProvider } from './mock';
import { InfobipProvider } from './infobip';
import { CloudflareProvider } from './cloudflare';
import { SesProvider } from './ses';
import { buildProviderSendEvent, emitProviderSend } from './send-observer';
import { checkDailyCap, throttleSend } from './rate-limiter';

const instances = new Map<string, MessagingProvider>();

/** Each driver's configured send-rate ceiling (messages/sec); 0 = unthrottled. */
function maxSendRateFor(driver: string): number {
  switch (driver) {
    case 'infobip':
      return config.infobip.maxSendRate;
    case 'cloudflare':
      return config.cloudflare.maxSendRate;
    case 'ses':
      return config.ses.maxSendRate;
    default:
      return 0;
  }
}

/** Each driver's configured daily send cap (messages/day, UTC); 0 = uncapped. */
function maxSendPerDayFor(driver: string): number {
  switch (driver) {
    case 'ses':
      return config.ses.maxSendPerDay;
    default:
      return 0;
  }
}

/**
 * Wrap `send` so every driver (mock, Infobip, future) emits one ProviderSendEvent
 * without duplicating instrumentation in each adapter, and waits for its own
 * per-provider rate-limit slot first — see rate-limiter.ts for why this is
 * separate from the dispatch worker's global BullMQ limiter. A configured
 * daily cap is checked before the per-second throttle: no reason to wait for
 * a slot on a driver that's already exhausted its day.
 */
function observeSend(provider: MessagingProvider, driver: string): MessagingProvider {
  const original = provider.send.bind(provider);
  const maxSendRate = maxSendRateFor(driver);
  const maxSendPerDay = maxSendPerDayFor(driver);
  provider.send = async (input) => {
    if (maxSendPerDay > 0) {
      const cap = await checkDailyCap(driver, maxSendPerDay, sharedConnection());
      if (!cap.ok) {
        return {
          accepted: false,
          status: 'rejected',
          error: {
            category: 'rate_limit',
            code: 'daily_cap_exceeded',
            message: `${driver}: daily send cap of ${maxSendPerDay} reached (${cap.count} attempted today)`,
            retryable: true,
          },
        };
      }
    }
    await throttleSend(driver, maxSendRate);
    const started = performance.now();
    const result = await original(input);
    emitProviderSend(
      buildProviderSendEvent(provider.name, input, result, Math.round(performance.now() - started)),
    );
    return result;
  };
  return provider;
}

export function getProvider(driver: string = config.provider.driver): MessagingProvider {
  let provider = instances.get(driver);
  if (!provider) {
    const raw =
      driver === 'infobip'
        ? new InfobipProvider()
        : driver === 'cloudflare'
          ? new CloudflareProvider()
          : driver === 'ses'
            ? new SesProvider()
            : new MockProvider();
    provider = observeSend(raw, driver);
    instances.set(driver, provider);
  }
  return provider;
}
