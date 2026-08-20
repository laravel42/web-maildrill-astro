import { describe, expect, it } from 'vitest';
import {
  EST_RATE_BASIS,
  PANELS,
  USAGE_VOLUME_BASIS,
  buildChannelUsageRows,
  estCost,
  fmtUsd,
  totalEstCost,
  totalSent,
  wholePercentShares,
} from '@/components/react/AppSettings.logic';

/**
 * The usage panel prints one number under two claims — a window and a price —
 * and neither is derivable from what it is given. `summary.byChannel` is
 * `count(*)` on `messages` grouped by channel with NO date predicate and no
 * status filter (workers stats.ts `workspaceSummary`), and there is no ledger
 * behind the money at all. These lock the wording that makes both readable.
 */
describe('usage panel basis text', () => {
  it('never claims a billing period over an all-time count', () => {
    // The panel used to render "This period" above 1,001,068 all-time messages
    // on a tenant whose calendar month held 48,468 — a 20.7x overstatement of
    // the word. There is no period to compute instead: `wallets` is a prepaid
    // balance with no cycle and `usage_records` has no period column.
    expect(PANELS.usage.desc).not.toMatch(/this period/i);
    expect(PANELS.usage.desc).toMatch(/to date/i);
    expect(USAGE_VOLUME_BASIS).toMatch(/all time/i);
    expect(USAGE_VOLUME_BASIS).toMatch(/not a billing period/i);
  });

  it('says the count includes sends that never arrived', () => {
    // `sent` is `count(*)`, so failed, expired and still-queued rows are in it.
    expect(USAGE_VOLUME_BASIS).toMatch(/failed/i);
    expect(USAGE_VOLUME_BASIS).toMatch(/queued/i);
  });

  it('keeps the money wording an estimate, tied to the rates it multiplies', () => {
    expect(EST_RATE_BASIS).toMatch(/Estimate, not a charge/);
    // Generated from the same constants `estCost` uses, so the sentence cannot
    // drift from the arithmetic above it.
    expect(EST_RATE_BASIS).toContain('$0.0005');
  });

  it('still prices volume the way the note describes', () => {
    const rows = buildChannelUsageRows([
      { channel: 'email', sent: 236001, delivered: 0, failed: 0 },
      { channel: 'sms', sent: 235505, delivered: 0, failed: 0 },
      { channel: 'whatsapp', sent: 235358, delivered: 0, failed: 0 },
      { channel: 'voice', sent: 294204, delivered: 0, failed: 0 },
    ]);
    expect(totalSent(rows)).toBe(1001068);
    expect(estCost(rows[0])).toBeCloseTo(118.0005, 4);
    expect(totalEstCost(rows)).toBeCloseTo(12246.064, 3);
  });
});


describe('fmtUsd', () => {
  it('groups thousands — the estimate is five digits on a money screen', () => {
    // The live workspace read `$12246.06` before grouping, beside a correctly
    // grouped `1,001,068` message count.
    expect(fmtUsd(12246.06)).toBe('$12,246.06');
    expect(fmtUsd(1860.49)).toBe('$1,860.49');
    expect(fmtUsd(118)).toBe('$118.00');
  });

  it('never renders a non-zero amount as $0.00', () => {
    expect(fmtUsd(0.004)).toBe('< $0.01');
    expect(fmtUsd(0)).toBe('$0.00');
  });
});

describe('wholePercentShares', () => {
  it('totals exactly 100 where independent rounding did not', () => {
    // The live channel mix: 23.57 / 23.53 / 23.51 / 29.39, which rounded
    // per-row to 24+24+24+29 = 101%.
    const shares = wholePercentShares([236001, 235505, 235358, 294204]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    // Floors are 23/23/23/29 = 98, leaving 2 points. They go to the two
    // largest discarded fractions — email (.5749) and SMS (.5254) — not to
    // WhatsApp (.5107).
    expect(shares).toEqual([24, 24, 23, 29]);
  });

  it('keeps every row within a point of its true share', () => {
    const values = [1, 1, 1];
    const shares = wholePercentShares(values);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(100);
    // 33.33 each: two rows get 33, one gets 34 — none is off by more than 1.
    expect(shares.every((s) => Math.abs(s - 100 / 3) < 1)).toBe(true);
  });

  it('is stable when fractions tie', () => {
    expect(wholePercentShares([1, 1, 1])).toEqual(wholePercentShares([1, 1, 1]));
  });

  it('returns zeros rather than NaN for an empty workspace', () => {
    expect(wholePercentShares([0, 0, 0])).toEqual([0, 0, 0]);
    expect(wholePercentShares([])).toEqual([]);
  });
});
