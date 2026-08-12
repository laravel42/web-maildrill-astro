import { describe, expect, it } from 'vitest';
import {
  DELIVERABILITY_LIMITS,
  MIN_SAMPLE,
  deliverabilityBreach,
  type Deliverability,
} from './reputation';

const stats = (over: Partial<Deliverability> = {}): Deliverability => {
  const sample = over.sample ?? 1000;
  const hardBounces = over.hardBounces ?? 0;
  const complaints = over.complaints ?? 0;
  return {
    sample,
    hardBounces,
    complaints,
    // Mirrors the divide-by-zero guard in deliverabilityFor.
    hardBounceRate: over.hardBounceRate ?? (sample === 0 ? 0 : hardBounces / sample),
    complaintRate: over.complaintRate ?? (sample === 0 ? 0 : complaints / sample),
    significant: over.significant ?? sample >= MIN_SAMPLE,
  };
};

describe('deliverabilityBreach', () => {
  it('passes a healthy sender', () => {
    expect(deliverabilityBreach(stats({ hardBounces: 10, complaints: 1 }))).toBeNull();
  });

  it('blocks on hard bounces above the limit', () => {
    const breach = deliverabilityBreach(stats({ hardBounces: 100 })); // 10%
    expect(breach).toMatch(/hard bounce rate is 10\.00%/);
  });

  it('blocks on complaints above the limit', () => {
    // 0.4% — under any bounce limit, but past what Gmail/Yahoo tolerate.
    const breach = deliverabilityBreach(stats({ complaints: 4 }));
    expect(breach).toMatch(/spam complaint rate is 0\.40%/);
  });

  it('does not act on a sample too small to mean anything', () => {
    // 1 bounce in 3 sends is 33%, and says nothing about the sender. A new
    // workspace must be able to send its first test campaign.
    expect(deliverabilityBreach(stats({ sample: 3, hardBounces: 1 }))).toBeNull();
    expect(deliverabilityBreach(stats({ sample: MIN_SAMPLE - 1, hardBounces: 40 }))).toBeNull();
  });

  it('acts as soon as the sample is significant', () => {
    const atThreshold = stats({ sample: MIN_SAMPLE, hardBounces: MIN_SAMPLE });
    expect(deliverabilityBreach(atThreshold)).toMatch(/hard bounce rate/);
  });

  it('treats the limits as exclusive — exactly at the limit still sends', () => {
    const exactly = stats({
      hardBounces: DELIVERABILITY_LIMITS.hardBounceRate * 1000,
      complaints: DELIVERABILITY_LIMITS.complaintRate * 1000,
    });
    expect(exactly.hardBounceRate).toBe(DELIVERABILITY_LIMITS.hardBounceRate);
    expect(deliverabilityBreach(exactly)).toBeNull();
  });

  it('reports bounces first when both are breached — it is the bigger problem', () => {
    expect(deliverabilityBreach(stats({ hardBounces: 200, complaints: 50 }))).toMatch(
      /hard bounce rate/,
    );
  });

  it('never divides by zero on a workspace that has sent nothing', () => {
    const empty = stats({ sample: 0, significant: false });
    expect(empty.hardBounceRate).toBe(0);
    expect(deliverabilityBreach(empty)).toBeNull();
  });
});

describe('DELIVERABILITY_LIMITS', () => {
  it('keeps complaints inside what mailbox providers publish', () => {
    // Gmail and Yahoo bulk-sender rules: stay under 0.3%.
    expect(DELIVERABILITY_LIMITS.complaintRate).toBeLessThanOrEqual(0.003);
  });

  it('stops bounces before an ESP would suspend the account', () => {
    expect(DELIVERABILITY_LIMITS.hardBounceRate).toBeLessThan(0.1);
  });
});
