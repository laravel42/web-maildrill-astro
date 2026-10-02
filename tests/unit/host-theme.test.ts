import { describe, expect, it } from 'vitest';
import {
  HOST_THEME_ATTRIBUTE,
  normalizeHostTheme,
  observeHostTheme,
  readHostTheme,
  type HostThemeObserverLike,
} from '@/components/react/hooks/useHostTheme';

/**
 * The vitest environment here is `node` (see vitest.config.ts) with no
 * jsdom/happy-dom/@testing-library, so this exercises the hook's DOM-free
 * core directly — a duck-typed attribute target and a duck-typed
 * MutationObserver fake — rather than mounting useHostTheme itself. Same
 * pattern as tests/unit/modal-focus-trap.test.ts.
 */
describe('normalizeHostTheme', () => {
  it('returns "dark" only for the exact string "dark"', () => {
    expect(normalizeHostTheme('dark')).toBe('dark');
  });

  it('returns "light" for the exact string "light"', () => {
    expect(normalizeHostTheme('light')).toBe('light');
  });

  it('returns "light" for null/undefined — the host default', () => {
    expect(normalizeHostTheme(null)).toBe('light');
    expect(normalizeHostTheme(undefined)).toBe('light');
  });

  it('returns "light" for empty or unknown values', () => {
    expect(normalizeHostTheme('')).toBe('light');
    expect(normalizeHostTheme('sepia')).toBe('light');
    expect(normalizeHostTheme('Dark')).toBe('light');
  });
});

describe('readHostTheme', () => {
  it('reads the normalized value off a duck-typed target', () => {
    const darkTarget = { getAttribute: (name: string) => (name === HOST_THEME_ATTRIBUTE ? 'dark' : null) };
    expect(readHostTheme(darkTarget)).toBe('dark');

    const lightTarget = { getAttribute: () => 'light' };
    expect(readHostTheme(lightTarget)).toBe('light');

    const unknownTarget = { getAttribute: () => 'neon' };
    expect(readHostTheme(unknownTarget)).toBe('light');
  });

  it('returns "light" for a null or undefined target', () => {
    expect(readHostTheme(null)).toBe('light');
    expect(readHostTheme(undefined)).toBe('light');
    expect(readHostTheme()).toBe('light');
  });
});

/** Minimal fake observer: captures the attribute callback so the test can
 * fire it manually, and records how many times disconnect() is called. */
function createFakeObserver() {
  let callback: (() => void) | null = null;
  let disconnectCalls = 0;
  const observerLike: HostThemeObserverLike = {
    observe: () => {},
    disconnect: () => {
      disconnectCalls += 1;
    },
  };
  const createObserver = (cb: () => void): HostThemeObserverLike => {
    callback = cb;
    return observerLike;
  };
  return {
    createObserver,
    fire: () => callback?.(),
    get disconnectCalls() {
      return disconnectCalls;
    },
  };
}

describe('observeHostTheme', () => {
  it('emits the normalized theme when the attribute changes', () => {
    let attr = 'light';
    const target = { getAttribute: () => attr };
    const emitted: string[] = [];
    const fake = createFakeObserver();

    const cleanup = observeHostTheme(target, (theme) => emitted.push(theme), fake.createObserver);

    attr = 'dark';
    fake.fire();

    expect(emitted).toEqual(['dark']);
    cleanup();
  });

  it('does not emit when the normalized value is unchanged', () => {
    let attr = 'light';
    const target = { getAttribute: () => attr };
    const emitted: string[] = [];
    const fake = createFakeObserver();

    const cleanup = observeHostTheme(target, (theme) => emitted.push(theme), fake.createObserver);

    // Same underlying value re-written (e.g. an unrelated mutation record) —
    // and an unknown value that still normalizes to the current 'light'.
    fake.fire();
    attr = 'sepia';
    fake.fire();

    expect(emitted).toEqual([]);
    cleanup();
  });

  it('calls disconnect() exactly once even if cleanup is invoked twice', () => {
    const target = { getAttribute: () => 'light' };
    const fake = createFakeObserver();

    const cleanup = observeHostTheme(target, () => {}, fake.createObserver);
    cleanup();
    cleanup();

    expect(fake.disconnectCalls).toBe(1);
  });

  it('is a safe no-op for a nullish target', () => {
    const fake = createFakeObserver();
    const emitted: string[] = [];

    const cleanupNull = observeHostTheme(null, (theme) => emitted.push(theme), fake.createObserver);
    const cleanupUndefined = observeHostTheme(
      undefined,
      (theme) => emitted.push(theme),
      fake.createObserver,
    );

    // No observer was ever created for a nullish target.
    expect(fake.disconnectCalls).toBe(0);
    expect(emitted).toEqual([]);

    // The returned cleanup is itself a safe no-op.
    expect(() => {
      cleanupNull();
      cleanupUndefined();
    }).not.toThrow();
  });
});
