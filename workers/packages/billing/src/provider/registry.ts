import { config } from '@maildrill/config';
import { MockPaymentProvider } from './mock';
import { StripeProvider } from './stripe';
import type { PaymentProvider } from './types';

/**
 * Provider selection mirrors the messaging registry: one env switch
 * (`BILLING_PROVIDER`), lazily instantiated singletons, and an override hook
 * for tests.
 */

const instances = new Map<string, PaymentProvider>();
let overrideProvider: PaymentProvider | null = null;

export function getPaymentProvider(name = config.billing.provider): PaymentProvider {
  if (overrideProvider) return overrideProvider;
  let provider = instances.get(name);
  if (!provider) {
    provider = name === 'mock' ? new MockPaymentProvider() : new StripeProvider();
    instances.set(name, provider);
  }
  return provider;
}

/** Test hook: force a provider (pass null to restore config-driven choice). */
export function setPaymentProviderForTests(provider: PaymentProvider | null): void {
  overrideProvider = provider;
}
