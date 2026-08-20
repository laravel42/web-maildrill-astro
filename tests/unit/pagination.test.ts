import { describe, expect, it } from 'vitest';
import { MAX_VISIBLE_PAGES, visiblePageNumbers } from '@/components/react/shared/pagination';

describe('visiblePageNumbers', () => {
  it('returns nothing for an empty pager', () => {
    expect(visiblePageNumbers(1, 0)).toEqual([]);
    expect(visiblePageNumbers(3, -2)).toEqual([]);
  });

  it('lists every page when the total fits the window', () => {
    expect(visiblePageNumbers(1, 1)).toEqual([1]);
    expect(visiblePageNumbers(2, MAX_VISIBLE_PAGES)).toEqual([1, 2, 3, 4, 5]);
  });

  it('centers the window on the current page', () => {
    expect(visiblePageNumbers(10, 20)).toEqual([8, 9, 10, 11, 12]);
  });

  it('clamps the window at the start', () => {
    expect(visiblePageNumbers(1, 20)).toEqual([1, 2, 3, 4, 5]);
    expect(visiblePageNumbers(2, 20)).toEqual([1, 2, 3, 4, 5]);
  });

  it('clamps the window at the end', () => {
    expect(visiblePageNumbers(20, 20)).toEqual([16, 17, 18, 19, 20]);
    expect(visiblePageNumbers(19, 20)).toEqual([16, 17, 18, 19, 20]);
  });

  it('honors a custom window size', () => {
    expect(visiblePageNumbers(5, 9, 3)).toEqual([4, 5, 6]);
  });
});
