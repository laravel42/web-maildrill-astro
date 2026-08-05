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
};

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

export const fetchWallet = () => api.get<WalletInfo>('billing/wallet');

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
