import { describe, expect, it } from 'vitest';
import { planBadgeLabel, type WalletInfo } from '@/lib/app/billing';

/**
 * The badge sits beside the wordmark on every page, so a wrong label is a
 * wrong claim shown everywhere — which is why the unknown case renders
 * nothing rather than falling back to a plausible-looking default.
 */
function wallet(over: Partial<WalletInfo> = {}): WalletInfo {
  return {
    balanceUsd: 0,
    reservedUsd: 0,
    lowBalanceUsd: 5,
    lowBalance: false,
    currency: 'USD',
    tier: null,
    onTrial: true,
    ...over,
  };
}

describe('planBadgeLabel', () => {
  it('reads Trial for a workspace that has bought nothing', () => {
    expect(planBadgeLabel(wallet({ onTrial: true }))).toBe('Trial');
  });

  it('switches to Pay as you go once credit is bought', () => {
    expect(planBadgeLabel(wallet({ onTrial: false }))).toBe('Pay as you go');
  });

  it('names the plan for a workspace on a commitment tier', () => {
    expect(
      planBadgeLabel(
        wallet({ onTrial: false, tier: { code: 'growth', name: 'Growth', discountBps: 500 } }),
      ),
    ).toBe('Growth');
  });

  it('prefers the tier over the trial flag', () => {
    // Reachable: a tier can be granted before any purchase settles, and the
    // trial flag is derived from purchase history. Testing `onTrial` first
    // would label an annual plan "Trial".
    expect(
      planBadgeLabel(
        wallet({ onTrial: true, tier: { code: 'scale', name: 'Scale', discountBps: 1200 } }),
      ),
    ).toBe('Scale');
  });

  it('renders nothing while the wallet is unknown', () => {
    // The wallet call failing must not put a guessed plan in the chrome.
    expect(planBadgeLabel(null)).toBeNull();
  });
});
