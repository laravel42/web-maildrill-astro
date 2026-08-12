import { describe, expect, it } from 'vitest';
import { LIST_DEAD_SHARE_LIMIT, LIST_MIN_MEMBERS } from './list-health';

/**
 * The thresholds are a product decision with real consequences — suspending a
 * list stops a customer sending — so they get pinned explicitly. The DB-backed
 * behaviour lives in the e2e suite.
 */
describe('list health thresholds', () => {
  it('sits well above the per-send bounce limit', () => {
    // The 8% hard-bounce limit measures a send going wrong. This measures a
    // list that was bad before anyone pressed send, so it must be far looser —
    // otherwise a list with a normal share of decayed addresses gets locked.
    expect(LIST_DEAD_SHARE_LIMIT).toBeGreaterThan(0.08);
    expect(LIST_DEAD_SHARE_LIMIT).toBe(0.3);
  });

  it('needs enough members for the share to mean anything', () => {
    // 2 dead out of 5 is 40% and says nothing about the list.
    expect(LIST_MIN_MEMBERS).toBeGreaterThanOrEqual(25);
  });

  it('leaves a normally-decayed list alone', () => {
    // A year-old list with 10% decay is ordinary, not a liability.
    expect(0.1).toBeLessThanOrEqual(LIST_DEAD_SHARE_LIMIT);
  });
});
