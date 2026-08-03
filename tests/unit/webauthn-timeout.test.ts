import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WebAuthnTimeoutError, withCeremonyTimeout } from '@/lib/app/webauthn';

describe('withCeremonyTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the ceremony result when it finishes in time', async () => {
    let resolveCeremony!: (v: string) => void;
    const ceremony = new Promise<string>((resolve) => {
      resolveCeremony = resolve;
    });
    const raced = withCeremonyTimeout(ceremony, 30_000, 'timed out');
    resolveCeremony('credential');
    await expect(raced).resolves.toBe('credential');
  });

  it('rejects with WebAuthnTimeoutError and aborts the prompt at the deadline', async () => {
    const onTimeout = vi.fn();
    // A ceremony that never settles — a prompt waiting on absent hardware.
    const raced = withCeremonyTimeout(new Promise<never>(() => {}), 30_000, 'no device', onTimeout);
    const outcome = raced.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    const err = await outcome;
    expect(err).toBeInstanceOf(WebAuthnTimeoutError);
    expect((err as Error).message).toBe('no device');
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('does not fire the timeout after the ceremony settles', async () => {
    const onTimeout = vi.fn();
    const raced = withCeremonyTimeout(Promise.resolve('ok'), 30_000, 'late', onTimeout);
    await expect(raced).resolves.toBe('ok');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it('propagates ceremony errors (e.g. user cancel) unchanged', async () => {
    const cancel = new Error('user cancelled');
    cancel.name = 'NotAllowedError';
    const raced = withCeremonyTimeout(Promise.reject(cancel), 30_000, 'timed out');
    await expect(raced).rejects.toBe(cancel);
  });

  it('swallows the late AbortError from the cancelled prompt after timing out', async () => {
    let rejectCeremony!: (e: Error) => void;
    const ceremony = new Promise<never>((_resolve, reject) => {
      rejectCeremony = reject;
    });
    const raced = withCeremonyTimeout(ceremony, 30_000, 'no device', () => {
      // Simulate WebAuthnAbortService: the native call rejects with AbortError
      // right after we abort it.
      const abort = new Error('aborted');
      abort.name = 'AbortError';
      rejectCeremony(abort);
    });
    const outcome = raced.catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(30_000);
    // The timeout error wins; the AbortError lands in a settled promise.
    expect(await outcome).toBeInstanceOf(WebAuthnTimeoutError);
  });
});
