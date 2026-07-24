import { config } from "@maildrill/config";
import type { MessagingProvider } from "./core";
import { MockProvider } from "./mock";
import { InfobipProvider } from "./infobip";
import { buildProviderSendEvent, emitProviderSend } from "./send-observer";

const instances = new Map<string, MessagingProvider>();

/**
 * Wrap `send` so every driver (mock, Infobip, future) emits one ProviderSendEvent
 * without duplicating instrumentation in each adapter.
 */
function observeSend(provider: MessagingProvider): MessagingProvider {
  const original = provider.send.bind(provider);
  provider.send = async (input) => {
    const started = performance.now();
    const result = await original(input);
    emitProviderSend(
      buildProviderSendEvent(
        provider.name,
        input,
        result,
        Math.round(performance.now() - started),
      ),
    );
    return result;
  };
  return provider;
}

export function getProvider(driver: string = config.provider.driver): MessagingProvider {
  let provider = instances.get(driver);
  if (!provider) {
    const raw = driver === "infobip" ? new InfobipProvider() : new MockProvider();
    provider = observeSend(raw);
    instances.set(driver, provider);
  }
  return provider;
}
