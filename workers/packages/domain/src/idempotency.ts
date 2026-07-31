import { createHash } from 'node:crypto';

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Deterministic BullMQ job id for a send. Including the generation means a
 * controlled retry (new generation) produces a new job id, while an accidental
 * re-enqueue of the same generation is de-duplicated by BullMQ.
 *
 * Segments are joined with "_", never ":" — BullMQ rejects custom job ids
 * containing a colon ("Custom Id cannot contain :") because it is the Redis
 * key separator, which would make every enqueue fail.
 */
export function dispatchJobId(tenantId: string, messageId: string, generation: number): string {
  return `send_${tenantId}_${messageId}_${generation}`;
}

/** Stable fingerprint for a provider event that lacks a stable event id. */
export function eventFingerprint(
  provider: string,
  parts: ReadonlyArray<string | number | null | undefined>,
): string {
  return sha256Hex([provider, ...parts.map((p) => (p == null ? '' : String(p)))].join('|'));
}

/** Stable fingerprint for a raw inbound webhook body, for dedupe. */
export function webhookFingerprint(provider: string, rawBody: string): string {
  return sha256Hex(`${provider}|${rawBody}`);
}
