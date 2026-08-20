import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Which automation run (if any) is currently executing on this async context.
 *
 * Automations have effects — adding a tag, joining a list — and those effects emit the same
 * domain events that start automations. Without an origin marker, "tag added → send email
 * → add tag" is a loop that runs until the step budget stops it, once per subscriber,
 * forever. The dispatcher uses this to refuse to re-trigger an automation from its own
 * effects.
 *
 * `AsyncLocalStorage` rather than a parameter because the emit happens deep inside product
 * services that must not know automations exist.
 */
export interface AutomationOrigin {
  automationId: string;
  runId: string;
}

const storage = new AsyncLocalStorage<AutomationOrigin>();

export function withAutomationOrigin<T>(
  origin: AutomationOrigin,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run(origin, fn);
}

export function currentAutomationOrigin(): AutomationOrigin | undefined {
  return storage.getStore();
}
