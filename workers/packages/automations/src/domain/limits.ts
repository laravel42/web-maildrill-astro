import { config } from '@maildrill/config';

/**
 * Execution budgets, read once so the engine can be tested with explicit values instead of
 * environment state. Every one of these exists because a workflow is user-authored input:
 * without them a router that points back at itself, a webhook that posts 40 MB, or a
 * provider that never answers becomes a worker that never returns.
 */
export interface AutomationLimits {
  maxStepsPerRun: number;
  maxLoopIterations: number;
  runTimeoutMs: number;
  maxPayloadBytes: number;
  httpMaxResponseBytes: number;
  httpTimeoutMs: number;
  httpMaxRedirects: number;
  httpAllowPrivate: boolean;
  maxConcurrentRunsPerTenant: number;
}

export function automationLimits(): AutomationLimits {
  return {
    maxStepsPerRun: config.automations.maxStepsPerRun,
    maxLoopIterations: config.automations.maxLoopIterations,
    runTimeoutMs: config.automations.runTimeoutMs,
    maxPayloadBytes: config.automations.maxPayloadBytes,
    httpMaxResponseBytes: config.automations.httpMaxResponseBytes,
    httpTimeoutMs: config.automations.httpTimeoutMs,
    httpMaxRedirects: config.automations.httpMaxRedirects,
    httpAllowPrivate: config.automations.httpAllowPrivate,
    maxConcurrentRunsPerTenant: config.automations.maxConcurrentRunsPerTenant,
  };
}

/**
 * Refuse an oversized trigger payload before it is persisted. Returning a boolean rather
 * than throwing: the webhook route answers 413, the dispatcher drops the event.
 */
export function payloadWithinLimit(payload: unknown, limits: AutomationLimits): boolean {
  try {
    return Buffer.byteLength(JSON.stringify(payload) ?? '', 'utf8') <= limits.maxPayloadBytes;
  } catch {
    // Circular or otherwise unserializable: it cannot be stored, so it cannot pass.
    return false;
  }
}
