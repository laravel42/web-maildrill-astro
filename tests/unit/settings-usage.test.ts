import { describe, expect, it } from 'vitest';
import {
  EST_RATE_BASIS,
  PANELS,
  USAGE_VOLUME_BASIS,
  buildChannelUsageRows,
  estCost,
  totalEstCost,
  totalSent,
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
