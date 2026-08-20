/**
 * Money arithmetic for the billing domain. Credits are integer micro-USD
 * (1 USD = 1_000_000 micro) so sub-cent unit prices like $0.0005/email stay
 * exact. All helpers are pure and integer-only — floats never carry value,
 * they only appear at the display boundary.
 */

export const MICRO_PER_USD = 1_000_000;
export const MICRO_PER_CENT = 10_000;

/** Whole-number guard: every financial quantity must be a safe integer. */
export function assertMicro(value: number, label = 'amount'): number {
  if (!Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be an integer number of micro-credits, got ${value}`);
  }
  return value;
}

export function usdToMicro(usd: number): number {
  return Math.round(usd * MICRO_PER_USD);
}

export function centsToMicro(cents: number): number {
  return assertMicro(cents * MICRO_PER_CENT, 'cents→micro');
}

export function microToUsd(micro: number): number {
  return micro / MICRO_PER_USD;
}

/** Display helper: `1234500` → `"1.2345"` (trailing zeros per precision). */
export function formatMicroUsd(micro: number, precision = 2): string {
  return (micro / MICRO_PER_USD).toFixed(precision);
}

/**
 * Apply a basis-point discount to a micro amount. Rounds half-up in the
 * customer's favor is NOT what a ledger wants — we round to nearest to keep
 * sums stable, and the same function is used everywhere so totals agree.
 */
export function applyDiscountBps(micro: number, discountBps: number): number {
  assertMicro(micro);
  if (discountBps <= 0) return micro;
  if (discountBps >= 10_000) return 0;
  return Math.round((micro * (10_000 - discountBps)) / 10_000);
}

/** Basis points as a human percentage string: 1550 → "15.5%". */
export function bpsToPercent(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}
