import { useEffect, useState } from 'react';

/**
 * The host's theme, as reflected on `<html data-theme="...">` (set by the
 * pre-paint script in the layouts and toggled by AppShell — see
 * src/layouts/AppLayout.astro, src/layouts/BaseLayout.astro,
 * src/components/react/AppShell.tsx). D30: the vendored email editor never
 * reads this itself — the host resolves it and passes `darkMode` as a prop.
 */
export type HostTheme = 'light' | 'dark';

/** The attribute the host writes the theme to; kept as a constant so the
 * hook and its tests agree on exactly one string. */
export const HOST_THEME_ATTRIBUTE = 'data-theme';

/** Small duck-typed surface so `readHostTheme`/`observeHostTheme` can run
 * against a real `Element` or a plain test double — no DOM required. */
type AttributeTarget = { getAttribute(name: string): string | null };

/** Duck-typed `MutationObserver` surface — only what this hook needs, so a
 * fake can be injected under the `node` vitest environment (D31). */
export interface HostThemeObserverLike {
  observe(target: AttributeTarget, options: { attributes: true; attributeFilter: string[] }): void;
  disconnect(): void;
}

/**
 * The host's own default is light, so anything other than the exact string
 * `'dark'` (missing attribute, empty, unknown value) normalizes to light —
 * never guess "maybe dark" from a malformed value.
 */
export function normalizeHostTheme(value: string | null | undefined): HostTheme {
  return value === 'dark' ? 'dark' : 'light';
}

/** Reads the current theme off `target` (defaults to light when there's no
 * target — SSR, or the attribute hasn't been set yet). */
export function readHostTheme(target?: AttributeTarget | null): HostTheme {
  if (!target) return 'light';
  return normalizeHostTheme(target.getAttribute(HOST_THEME_ATTRIBUTE));
}

/**
 * Subscribes to changes on `HOST_THEME_ATTRIBUTE`, calling `onChange` with
 * the normalized theme whenever it actually changes (never on a no-op
 * mutation, e.g. the toggle re-writing the same value). Returns a cleanup
 * that disconnects the observer — safe to call more than once.
 *
 * `createObserver` defaults to a real `MutationObserver` and exists purely
 * as an injection point: the repo's root vitest environment is `node` (no
 * jsdom/happy-dom/@testing-library), so tests supply a duck-typed fake here
 * instead of touching a real DOM (D31).
 */
export function observeHostTheme(
  target: AttributeTarget | null | undefined,
  onChange: (theme: HostTheme) => void,
  createObserver?: (callback: () => void) => HostThemeObserverLike,
): () => void {
  // No target to watch (SSR, or not mounted yet) is always a no-op. Falling
  // back to a *real* MutationObserver additionally requires the global to
  // exist — but an injected `createObserver` (tests, under `node`) doesn't,
  // since it never touches the global itself.
  if (!target || (!createObserver && typeof MutationObserver === 'undefined')) {
    return () => {};
  }

  let current = readHostTheme(target);
  const check = () => {
    const next = readHostTheme(target);
    if (next === current) return;
    current = next;
    onChange(next);
  };

  const factory =
    createObserver ??
    ((callback: () => void): HostThemeObserverLike => {
      // Adapter, not a cast: MutationObserver.observe wants a real `Node`,
      // narrower than our duck-typed AttributeTarget — this wrapper is the
      // one place that bridges the two, since HOST_THEME_ATTRIBUTE is only
      // ever observed on document.documentElement (a Node) in practice.
      const mo = new MutationObserver(callback);
      return {
        observe: (t, options) => mo.observe(t as unknown as Node, options),
        disconnect: () => mo.disconnect(),
      };
    });
  const observer = factory(check);
  observer.observe(target, { attributes: true, attributeFilter: [HOST_THEME_ATTRIBUTE] });

  let disconnected = false;
  return () => {
    if (disconnected) return;
    disconnected = true;
    observer.disconnect();
  };
}

/**
 * React hook: the host's current theme, kept in sync with
 * `<html data-theme>` via a MutationObserver. SSR-safe — `document` doesn't
 * exist during Astro's server render, so the initial state falls back to
 * the host's light default and the real read happens once mounted.
 */
export function useHostTheme(): HostTheme {
  const [theme, setTheme] = useState<HostTheme>(() =>
    typeof document === 'undefined' ? 'light' : readHostTheme(document.documentElement),
  );

  useEffect(() => {
    const root = document.documentElement;
    setTheme(readHostTheme(root));
    return observeHostTheme(root, setTheme);
  }, []);

  return theme;
}
