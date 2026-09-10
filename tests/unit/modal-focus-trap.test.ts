import { describe, expect, it } from 'vitest';
import { computeTrapFocusTarget } from '@/components/react/shared/Modal';

/**
 * Modal's focus trap keeps Tab/Shift+Tab inside the dialog. The vitest
 * environment here is `node` (see vitest.config.ts) with no jsdom and no
 * @testing-library in the project's devDependencies, so this exercises the
 * trap's navigation decision as a pure, DOM-free function rather than
 * mounting the component — per the plan's fallback for environments without
 * React DOM testing infra. `getFocusableElements` (the DOM-querying half of
 * the trap) is exercised indirectly by this same export's usage in Modal.tsx
 * and is not unit tested here for the same reason.
 */
describe('computeTrapFocusTarget', () => {
  it('does nothing when there is nothing focusable — Tab is still prevented by the caller', () => {
    expect(computeTrapFocusTarget(0, null, false)).toBeNull();
    expect(computeTrapFocusTarget(0, null, true)).toBeNull();
  });

  it('wraps Tab from the last focusable element to the first', () => {
    expect(computeTrapFocusTarget(3, 2, false)).toBe(0);
  });

  it('wraps Shift+Tab from the first focusable element to the last', () => {
    expect(computeTrapFocusTarget(3, 0, true)).toBe(2);
  });

  it('leaves the browser default alone for every other Tab in the middle', () => {
    expect(computeTrapFocusTarget(3, 1, false)).toBeNull();
    expect(computeTrapFocusTarget(3, 1, true)).toBeNull();
  });

  it('forces focus back inside when focus is outside the panel (e.g. the overlay), Tab or Shift+Tab', () => {
    expect(computeTrapFocusTarget(3, null, false)).toBe(0);
    expect(computeTrapFocusTarget(3, null, true)).toBe(2);
    // A stale/-1 index (element not found in the focusable list) is the same as "outside".
    expect(computeTrapFocusTarget(3, -1, false)).toBe(0);
  });

  it('treats a single focusable element as both first and last, trapping Tab on itself', () => {
    expect(computeTrapFocusTarget(1, 0, false)).toBe(0);
    expect(computeTrapFocusTarget(1, 0, true)).toBe(0);
  });

  it('treats an out-of-range index past the end as outside the panel', () => {
    expect(computeTrapFocusTarget(3, 5, false)).toBe(0);
    expect(computeTrapFocusTarget(3, 5, true)).toBe(2);
  });
});
