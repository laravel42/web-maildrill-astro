/** Max numbered buttons shown in table pagers (prev/next are separate). */
export const MAX_VISIBLE_PAGES = 5;

/** Sliding window of page numbers centered on `current`, capped at `max`. */
export function visiblePageNumbers(
  current: number,
  total: number,
  max: number = MAX_VISIBLE_PAGES,
): number[] {
  if (total <= 0) return [];
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
  const half = Math.floor(max / 2);
  let start = Math.max(1, current - half);
  let end = start + max - 1;
  if (end > total) {
    end = total;
    start = end - max + 1;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
