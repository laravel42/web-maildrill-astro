/**
 * useEmailBuilderTour.ts — F4 wiring (docs/product-tour-driverjs-plan.md §4): the piece
 * that actually starts the tour. F1 built the engine, F2a the anchors, F3a the steps +
 * copy — nothing consumed them yet.
 *
 * Responsibilities:
 * - Builds a `Tour` (`@md/product-tour`) from `buildEmailBuilderTourSteps` (F3a),
 *   re-created whenever the step-relevant config or the active i18next language
 *   changes (copy is resolved at build time from `i18n.t`, not reactively).
 * - Persists "seen"/"completed" under the `eb:` prefix via
 *   `createLocalStoragePersistence('eb:')` (§0.4 — the package never assumes a
 *   prefix, EmailBuilder owns `eb:tour:*` per the `eb:lib:*` convention already used
 *   elsewhere in this package).
 * - Auto-starts once on mount when the host enables the tour (`tour` flag on
 *   `EditorContext`, already existed since F1 with no consumer) AND the tour hasn't
 *   been seen yet at the current `TOUR_VERSION` — bumping that constant re-offers the
 *   tour to everyone (F4 acceptance criterion).
 * - Exposes `requestTourRestart()` (`EditorContext`) as the one way to relaunch the
 *   tour on demand — wired to the CommandPalette entry and the header help button.
 * - Never imports `driver.js` eagerly: `createTour()` itself defers that import
 *   (`@md/product-tour/src/createTour.ts`) to `start()`, so mounting this controller
 *   costs nothing until the tour actually opens.
 * - Forwards `@md/product-tour`'s domain-agnostic `TourAnalyticsEvent` to the host via
 *   `onTourEvent` (new optional `EmailBuilderProps`) — this package never imports
 *   PostHog or any analytics SDK (§0.2); the host (`VisualEmailBuilder.tsx`) maps
 *   these events to `window.posthog?.capture(...)`.
 * - F5 (docs/product-tour-driverjs-plan.md §2, §4): stamps `--md-tour-*` onto the
 *   popover wrapper **in runtime**, read from the active MUI theme (`useTheme()`).
 *   The popover portals to `document.body` (driver.js), outside `.dark-email-builder`
 *   and outside emotion's scope — a class-based mapping like builder42's `tour.css`
 *   cannot reach it, so this hook watches for the wrapper's insertion instead (see
 *   `useTourThemeVars`/`applyTourThemeVars` below). `@md/product-tour`'s `createTour`
 *   does not expose a driver.js `onPopoverRender` passthrough (checked against its
 *   public `CreateTourOptions` — intentionally not modified, out of scope for F5), so
 *   the wrapper is located via a `MutationObserver` on `document.body` instead of that
 *   hook; the effect is equivalent (variables land on `popover.wrapper` before paint)
 *   without touching the engine's API surface.
 */

import { useEffect, useRef } from 'react';
import { useTheme, type Theme } from '@mui/material/styles';

import { createTour, createLocalStoragePersistence, type Tour, type TourAnalyticsEvent } from '@md/product-tour';

import i18n from '../i18n';
import {
  requestTourRestart,
  useTour,
  useTourRestartNonce,
} from '../documents/editor/EditorContext';
import { buildEmailBuilderTourSteps, getEmailBuilderTourLabels } from './tourSteps';
import type { EmailBuilderTourStepsConfig } from './tourSteps';

/** `eb:` — the `eb:lib:*` convention already used elsewhere in this package (§0.4). */
const TOUR_STORAGE_PREFIX = 'eb:';
const TOUR_ID = 'email-builder';
/** Bump to re-offer the tour to everyone who already saw a previous version. */
const TOUR_VERSION = 1;

/**
 * The popover theme is only needed once the tour actually renders. `createTour`
 * already defers `driver.js` itself to `start()` (§1.3) — this mirrors that for the
 * CSS side so the stylesheet never enters the editor's initial chunk either.
 */
let themeCssLoaded = false;
function ensureTourThemeCss(): void {
  if (themeCssLoaded) return;
  themeCssLoaded = true;
  void import('@md/product-tour/style.css');
}

/**
 * F5 — maps the active MUI theme to every `--md-tour-*` variable consumed by
 * `@md/product-tour`'s `theme.css` (`.md-tour` rules). Exported as a pure function so
 * it is unit-testable without mounting the popover or a `MutationObserver`.
 *
 * Brand rules (`docs/AGENTS.md`): the primary button / focus ring use the indigo
 * interactive accent — here that's `theme.palette.primary.main`, which is already the
 * email channel's indigo (`EMAIL_CHANNEL_COLOR`/`primaryColor`, see `theme.ts`), never
 * `--brand` orange (this package's theme never wires `--brand` into MUI `primary` —
 * that's an app-level, not editor-level, token). The overlay uses the theme's own ink
 * (`palette.text.primary`) at low opacity via `alpha()` (never pure black), mirroring
 * builder42's `color-mix`-based `--pb-chrome-bg` overlay in `chrome/tour.css`.
 */
export function buildEmailBuilderTourCssVars(theme: Theme): Record<string, string> {
  return {
    '--md-tour-surface': theme.palette.background.paper,
    '--md-tour-text': theme.palette.text.primary,
    '--md-tour-text-muted': theme.palette.text.secondary,
    '--md-tour-border': theme.palette.divider,
    '--md-tour-radius': `${typeof theme.shape.borderRadius === 'number' ? theme.shape.borderRadius : 10}px`,
    '--md-tour-shadow': theme.shadows[8],
    '--md-tour-accent': theme.palette.primary.main,
    '--md-tour-accent-text': theme.palette.primary.contrastText,
    '--md-tour-font': theme.typography.fontFamily,
    '--md-tour-overlay': alphaHex(theme.palette.text.primary, 0.55),
  };
}

/**
 * Minimal, dependency-free `alpha()` for a `#rrggbb`/`#rgb` color — used only for
 * `--md-tour-overlay`. Avoids importing `@mui/material/styles`' own `alpha()` here to
 * keep this helper trivially testable with plain hex fixtures; falls back to the input
 * color unchanged if it isn't a hex string (e.g. a theme customized to `rgb(...)`).
 */
function alphaHex(color: string, opacity: number): string {
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(color.trim());
  if (!match) return color;
  const hex = match[1];
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/** Applies every `--md-tour-*` variable from {@link buildEmailBuilderTourCssVars} onto a popover wrapper. */
function applyTourThemeVars(wrapper: HTMLElement, vars: Record<string, string>): void {
  for (const [name, value] of Object.entries(vars)) {
    wrapper.style.setProperty(name, value);
  }
}

/**
 * Watches `document.body` for the driver.js popover wrapper (`.driver-popover.md-tour`,
 * `popoverClass: 'md-tour'` set by `createTour`) and stamps the current theme's
 * `--md-tour-*` variables onto it as soon as it's inserted — driver.js portals the
 * popover to `document.body` on every highlight, outside this package's own DOM subtree
 * and outside emotion's `.dark-email-builder` scope, so a CSS class mapping (builder42's
 * approach) cannot reach it here (§2 of the plan). Re-applies on every theme change
 * (e.g. dark mode toggle) while the tour is mounted.
 */
function useTourThemeVars(theme: Theme): void {
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    function paintWrapper(wrapper: HTMLElement): void {
      applyTourThemeVars(wrapper, buildEmailBuilderTourCssVars(themeRef.current));
    }

    // Cover a wrapper already present when this effect (re-)runs, e.g. right after a
    // theme change while the tour is mid-step.
    document.querySelectorAll<HTMLElement>('.driver-popover.md-tour').forEach(paintWrapper);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches('.driver-popover.md-tour')) {
            paintWrapper(node);
            return;
          }
          node.querySelectorAll?.('.driver-popover.md-tour').forEach(paintWrapper);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [theme]);
}

export interface UseEmailBuilderTourOptions {
  /** Subset of `EmailBuilderProps` used to filter steps by host flags (F3a). */
  config: EmailBuilderTourStepsConfig;
  /** Forwarded to `createTour({ onEvent })` — see module doc. Never calls PostHog itself. */
  onTourEvent?: (event: TourAnalyticsEvent) => void;
}

/**
 * Mounted once from `App/index.tsx`. Owns the `Tour` instance lifecycle: builds it
 * from the current config/locale, auto-starts it once when eligible, and restarts it
 * whenever `requestTourRestart()` bumps the nonce (CommandPalette / help button).
 *
 * Purely an effect-runner — renders nothing. Kept separate from `App` so the tour
 * wiring is easy to find and doesn't grow `App`'s own effect list.
 */
export function useEmailBuilderTour({ config, onTourEvent }: UseEmailBuilderTourOptions): void {
  const tourEnabled = useTour();
  const restartNonce = useTourRestartNonce();
  const tourRef = useRef<Tour | null>(null);
  const autoStartedRef = useRef(false);
  // Keep the latest config/callback without re-running the auto-start effect on every
  // render — only `tourEnabled`/`restartNonce`/locale changes should rebuild the tour.
  const configRef = useRef(config);
  configRef.current = config;
  const onTourEventRef = useRef(onTourEvent);
  onTourEventRef.current = onTourEvent;
  // F5: `App/index.tsx` already mounts this hook inside MUI's `ThemeProvider`
  // (`src/index.tsx`) — reading `useTheme()` here (rather than threading it through a
  // new option on `UseEmailBuilderTourOptions`) keeps the entire theme mapping inside
  // this file, within F5's scope (`packages/email-builder-standalone/src/tour/**`).
  const theme = useTheme();
  useTourThemeVars(theme);

  useEffect(() => {
    if (!tourEnabled) return;

    function buildTour(): Tour {
      return createTour({
        tourId: TOUR_ID,
        version: TOUR_VERSION,
        steps: buildEmailBuilderTourSteps(configRef.current),
        persistence: createLocalStoragePersistence(TOUR_STORAGE_PREFIX),
        onEvent: (event) => onTourEventRef.current?.(event),
        labels: getEmailBuilderTourLabels(),
        popoverClass: 'md-tour',
      });
    }

    // Auto-start once per mount, only when the persisted state says "not seen at this
    // version" — `createTour`'s persistence already re-offers the tour after a version
    // bump (stale version reads back as unseen), so no extra check is needed here.
    if (!autoStartedRef.current) {
      autoStartedRef.current = true;
      const tour = buildTour();
      tourRef.current = tour;
      const persistence = createLocalStoragePersistence(TOUR_STORAGE_PREFIX);
      const state = persistence.read(TOUR_ID, TOUR_VERSION);
      if (!state.seen) {
        ensureTourThemeCss();
        void tour.start();
      }
    }

    // Changing the active i18next language rebuilds the tour so a relaunch after a
    // language switch shows the right copy (steps read `i18n.t` at build time).
    const handleLanguageChanged = () => {
      tourRef.current?.stop();
      tourRef.current = buildTour();
    };
    i18n.on('languageChanged', handleLanguageChanged);
    return () => {
      i18n.off('languageChanged', handleLanguageChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config/onTourEvent are read via refs so they don't retrigger auto-start
  }, [tourEnabled]);

  // `requestTourRestart()` bumps this nonce — rebuild fresh steps (state may have
  // changed since mount: selected block, drawer open, document contents) and start.
  //
  // Tracks the last `restartNonce` THIS effect actually reacted to, rather than a plain
  // "is this the first render" flag: the effect's own dependency array also includes
  // `tourEnabled` (so a relaunch requested before the tour was enabled still fires once
  // it becomes enabled), but that means this effect re-runs on ANY `tourEnabled` flip too
  // — including the false→true transition on mount that the auto-start effect above reacts
  // to for the very same reason. Guarding on "was this a real restartNonce bump" (not just
  // "not the first render") is what keeps a `tourEnabled` mount-time flip from being
  // mistaken for a restart request and firing a second, redundant `start()` while the
  // auto-start's own `start()` may still be awaiting its lazy `import('driver.js')` — PROVEN
  // by execution (see the task report FINDINGS): with the OLD "skip only the very first
  // render" guard, `markEmailTourSeen()` + a plain mount (no click, no restart requested at
  // all) still auto-started the tour after ~2-3s, because `isFirstRestartRender` only
  // protects render 1 — the SECOND render (the mount's own `tourEnabled` false→true flip)
  // sailed straight through and called `start()` unconditionally, regardless of whether the
  // tour had already been marked "seen". `@md/product-tour`'s per-tourId generation guard
  // (D7) already prevents that spurious start from ever producing a SECOND live instance
  // once the real auto-start (or a real restart) is in flight, but the call site should not
  // even attempt a bogus start in the first place.
  //
  // `lastHandledRestartNonce.current` is only written AFTER the `tourEnabled` gate below,
  // not before it: a restart requested while `tourEnabled` is still `false` must stay
  // unhandled so that when the flag later flips to `true` (and this effect re-runs, since
  // `tourEnabled` is in its dependency array), it still sees `restartNonce !== lastHandled`
  // and fires. Marking the nonce handled before the gate would silently swallow that
  // request — the effect would re-run on the `tourEnabled` flip, find the nonce already
  // "handled", and return without ever starting the tour.
  const lastHandledRestartNonce = useRef(restartNonce);
  useEffect(() => {
    if (restartNonce === lastHandledRestartNonce.current) return;
    if (!tourEnabled) return;
    lastHandledRestartNonce.current = restartNonce;
    tourRef.current?.stop();
    const tour = createTour({
      tourId: TOUR_ID,
      version: TOUR_VERSION,
      steps: buildEmailBuilderTourSteps(configRef.current),
      persistence: createLocalStoragePersistence(TOUR_STORAGE_PREFIX),
      onEvent: (event) => onTourEventRef.current?.(event),
      labels: getEmailBuilderTourLabels(),
      popoverClass: 'md-tour',
    });
    tourRef.current = tour;
    ensureTourThemeCss();
    void tour.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config/onTourEvent read via refs intentionally
  }, [restartNonce, tourEnabled]);

  useEffect(() => {
    return () => {
      tourRef.current?.stop();
    };
  }, []);
}

/** Re-exported so `App/index.tsx` has a single import site for the F4 wiring. */
export { requestTourRestart };
