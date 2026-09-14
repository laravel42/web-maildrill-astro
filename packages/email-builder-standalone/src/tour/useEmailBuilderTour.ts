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
 */

import { useEffect, useRef } from 'react';

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
  const isFirstRestartRender = useRef(true);
  useEffect(() => {
    if (isFirstRestartRender.current) {
      isFirstRestartRender.current = false;
      return;
    }
    if (!tourEnabled) return;
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
