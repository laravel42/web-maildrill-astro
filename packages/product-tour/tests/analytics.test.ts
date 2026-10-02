import { describe, it, expect, vi } from 'vitest';
import { createAnalyticsEmitter } from '@/analytics';

describe('analytics', () => {
  it('calls the provided onEvent callback with the event', () => {
    const onEvent = vi.fn();
    const emit = createAnalyticsEmitter(onEvent);
    emit({ event: 'tour_started', tourId: 't1', totalSteps: 5 });
    expect(onEvent).toHaveBeenCalledWith({ event: 'tour_started', tourId: 't1', totalSteps: 5 });
  });

  it('is a no-op (does not throw) when no callback is provided', () => {
    const emit = createAnalyticsEmitter(undefined);
    expect(() => emit({ event: 'tour_completed', tourId: 't1' })).not.toThrow();
  });

  it('swallows errors thrown by the consumer callback instead of propagating them', () => {
    const onEvent = vi.fn(() => {
      throw new Error('boom');
    });
    const emit = createAnalyticsEmitter(onEvent);
    expect(() => emit({ event: 'tour_dismissed', tourId: 't1', stepIndex: 2 })).not.toThrow();
    expect(onEvent).toHaveBeenCalled();
  });
});
