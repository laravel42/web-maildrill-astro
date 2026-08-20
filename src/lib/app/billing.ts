import { api } from './api';

/**
 * Billing BFF client — wallet, catalog, checkout, portal. All amounts arrive
 * as display-ready USD numbers; micro-credit precision stays server-side.
 */

export type WalletInfo = {
  balanceUsd: number;
  reservedUsd: number;
  lowBalanceUsd: number;
  lowBalance: boolean;
  currency: string;
  tier: { code: string; name: string; discountBps: number } | null;
  /** True until the workspace buys credit or is placed on a tier. */
  onTrial: boolean;
};

/**
 * What the badge beside the wordmark should read.
 *
 * Three states, in the order they can occur, and the order matters: a
 * workspace on a commitment tier has necessarily bought something, so testing
 * the tier first is what keeps an annual plan from being labelled "Pay as you
 * go" the moment its first invoice clears.
 *
 *   trial          → nothing bought, no tier          → "Trial"
 *   tier           → annual / commitment plan          → the tier's name
 *   otherwise      → bought credit, no commitment      → "Pay as you go"
 *
 * Returns null while the wallet is unknown. The caller renders nothing rather
 * than guessing: this sits in the chrome of every page, so a wrong plan name
 * is a wrong claim shown everywhere.
 */
export function planBadgeLabel(wallet: WalletInfo | null): string | null {
  if (!wallet) return null;
  if (wallet.tier) return wallet.tier.name;
  if (wallet.onTrial) return 'Trial';
  return 'Pay as you go';
}

export type BillingPackage = {
  code: string;
  name: string;
  description: string | null;
  priceUsd: number;
  creditsUsd: number;
  bonusUsd: number;
  totalCreditsUsd: number;
  grantsTier: { code: string; name: string; discountBps: number } | null;
};

export type WalletTransaction = {
  id: string;
  type: string;
  amountUsd: number;
  balanceAfterUsd: number;
  channel: string | null;
  description: string | null;
  createdAt: string;
};

/**
 * One credit top-up and what it has paid for so far.
 *
 * `campaigns` comes from the recharge's derived rollup — spend allocated to
 * this top-up FIFO, split into what was estimated at send time and what the
 * provider's own billing later corrected. `rebuiltAt` is null when the rollup
 * has never been built, which is NOT the same as "nothing spent": the UI has
 * to say "not calculated yet" rather than render a zero it can't support.
 */
export type RechargeCampaign = {
  campaignId: string;
  name: string | null;
  channel: string | null;
  amountUsd: number;
  estimatedUsd: number;
  /** Signed. Positive = the provider billed more than we estimated. */
  reconciledUsd: number;
};

export type Recharge = {
  id: string;
  source: 'purchase' | 'promotion' | 'bonus' | 'adjustment' | 'trial';
  currency: string;
  createdAt: string;
  amountUsd: number;
  consumedUsd: number;
  remainingUsd: number;
  rebuiltAt: string | null;
  campaigns: RechargeCampaign[];
};

export const fetchWallet = () => api.get<WalletInfo>('billing/wallet');

export const fetchRecharges = async (): Promise<Recharge[]> =>
  (await api.get<{ data: Recharge[] }>('billing/recharges?limit=20')).data;

export const fetchBillingPackages = async (): Promise<BillingPackage[]> =>
  (await api.get<{ data: BillingPackage[] }>('billing/packages')).data;

export const fetchWalletTransactions = async (): Promise<WalletTransaction[]> =>
  (await api.get<{ data: WalletTransaction[] }>('billing/transactions?limit=25')).data;

/** Start hosted checkout; caller redirects the browser to the returned URL. */
export const startCheckout = async (packageCode: string): Promise<string> =>
  (await api.post<{ url: string }>('billing/checkout', { packageCode })).url;

/** Open the hosted customer portal (payment methods, invoices, tax info). */
export const openBillingPortal = async (): Promise<string> =>
  (await api.post<{ url: string }>('billing/portal')).url;
