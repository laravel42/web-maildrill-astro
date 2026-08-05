/** Traffic-light colour for a quota percentage (higher = more urgent). */
export function quotaColor(q: number): string {
  if (q >= 90) return '#dc2626';
  if (q >= 75) return '#d97706';
  return '#16a34a';
}

/** Traffic-light colour for a deliverability percentage (higher = healthier). */
export function delivColor(d: number): string {
  if (d >= 98) return '#16a34a';
  if (d >= 95) return '#d97706';
  return '#dc2626';
}
