/**
 * useBuilder42Tour.ts — F4 wiring (docs/product-tour-driverjs-plan.md §4): the piece
 * that actually starts the tour. F1 built the engine (`@md/product-tour`), F2b the
 * anchors, F3b the steps + copy — nothing consumed them yet.
 *
 * Responsibilities:
 * - Builds a `Tour` (`@md/product-tour`) from `buildBuilder42TourSteps` (F3b),
 *   re-created whenever the step-relevant config or the active i18next instance's
 *   language changes (copy is resolved at build time from `i18n.t`, not reactively).
 * - Persists "seen"/version through `useLocalConfig`'s `tourSeen`/`tourVersion` keys
 *   (`pb:tourSeen`, `pb:tourVersion` in `localStorage`) rather than letting
 *   `@md/product-tour`'s own `createLocalStoragePersistence` mint a second,
 *   independent set of keys — a custom `TourPersistence` adapter (below) bridges the
 *   package's persistence contract onto `readConfig`/`writeConfig` so there is a
 *   SINGLE source of truth for "has this browser seen the tour", reachable from both
 *   this controller and any future chrome UI that wants to read `tourSeen` directly
 *   (e.g. a settings toggle) without reaching into `localStorage` under a second key
 *   convention. `@md/product-tour` itself stays unaware of `useLocalConfig` — it only
 *   sees the `TourPersistence` interface (§0.4: the package never assumes a prefix or
 *   a storage backend).
 * - Auto-starts once per mount, but ONLY after `OnboardingExperienceModal` has been
 *   resolved (`experienceLevelChosen === true`) — the tour and the modal must never
 *   overlap (§4 F4 acceptance). Callers pass `onboardingResolved` explicitly instead
 *   of this module reading `useLocalConfig("experienceLevelChosen")` itself, so the
 *   gating stays visible at the call site (`App.tsx` / `Builder42Editor.tsx`).
 * - Exposes `requestBuilder42TourRestart()` as the one way to relaunch the tour on
 *   demand — wired to the `ProfileMenu` entry.
 * - Never imports `driver.js` eagerly: `createTour()` defers that import to
 *   `start()` (§1.3); this module also defers the theme stylesheet import to the
 *   same moment, so mounting this controller costs nothing until the tour opens.
 * - Forwards `@md/product-tour`'s domain-agnostic `TourAnalyticsEvent` via the
 *   `onTourEvent` callback — this package never imports PostHog or any analytics SDK
 *   (§0.2); the host (`LandingPageBuilder.tsx`) maps these events to
 *   `window.posthog?.capture(...)`.
 *
 * Boundary (§0 of the plan): cero imports de `src/` del host Astro. Vive en
 * `src/app/tour` (chrome) — nada en `src/builder/runtime/**` ni rutas de export.
 */

import { useEffect, useRef } from "react";
import type { i18n as I18nInstance } from "i18next";

import {
  createTour,
  type Tour,
  type TourAnalyticsEvent,
  type TourPersistence,
  type TourPersistenceState,
} from "@md/product-tour";

import { readConfig, writeConfig } from "@/hooks/useLocalConfig";
import { buildBuilder42TourSteps, getBuilder42TourLabels } from "./tourSteps";
import type { Builder42TourStepsConfig } from "./tourSteps";

const TOUR_ID = "builder42";
/** Bump to re-offer the tour to everyone who already saw a previous version. */
const TOUR_VERSION = 1;

/**
 * Bridges `@md/product-tour`'s `TourPersistence` contract onto the two
 * `useLocalConfig` keys (`tourSeen`, `tourVersion`) instead of a second
 * independent `localStorage` namespace — see module doc. `tourId` is accepted
 * for interface compatibility but unused: Builder42 only ever runs a single
 * tour, so there is nothing to disambiguate between multiple tour ids (unlike
 * the generic package, which supports many tours sharing one prefix).
 *
 * Exported (not just module-private) so it can be unit-tested directly
 * against `readConfig`/`writeConfig` without mounting any React tree — this
 * package intentionally has no jsdom/happy-dom (§ F2b precedent,
 * `tour-anchors-coverage.test.ts`), so hook-level tests that need a DOM are
 * out of reach without adding a new dependency.
 */
export function createConfigBackedTourPersistence(): TourPersistence {
  function read(_tourId: string, currentVersion: number): TourPersistenceState {
    const seen = readConfig("tourSeen");
    const version = readConfig("tourVersion");
    if (version !== currentVersion) {
      return { seen: false, completed: false, version: currentVersion };
    }
    const completed = readConfig("tourCompleted");
    const lastStepIndex = readConfig("tourLastStepIndex");
    return {
      seen,
      completed,
      version,
      ...(lastStepIndex >= 0 ? { lastStepIndex } : {}),
    };
  }
  return {
    read,
    markSeen(_tourId, currentVersion) {
      writeConfig("tourSeen", true);
      writeConfig("tourVersion", currentVersion);
    },
    markCompleted(_tourId, currentVersion) {
      writeConfig("tourSeen", true);
      writeConfig("tourVersion", currentVersion);
      writeConfig("tourCompleted", true);
      // Un tour completado no tiene "progreso a medias" que reanudar — mismo criterio que
      // `createLocalStoragePersistence`'s `markCompleted` (`persistence.ts`).
      writeConfig("tourLastStepIndex", -1);
    },
    saveProgress(_tourId, stepIndex, currentVersion) {
      writeConfig("tourSeen", true);
      writeConfig("tourVersion", currentVersion);
      writeConfig("tourLastStepIndex", stepIndex);
    },
    reset() {
      writeConfig("tourSeen", false);
      writeConfig("tourCompleted", false);
      writeConfig("tourLastStepIndex", -1);
    },
  };
}

let themeCssLoaded = false;
/** Deferred alongside `driver.js` itself (§1.3) — never in the initial chunk. */
function ensureTourThemeCss(): void {
  if (themeCssLoaded) return;
  themeCssLoaded = true;
  void import("@md/product-tour/style.css");
}

/**
 * D51 — resolves the tour overlay's REAL color/opacity, forwarded to `createTour`'s
 * `overlayColor`/`overlayOpacity` (reenviadas tal cual a driver.js's own `driver()` config).
 * `chrome/tour.css`'s `--md-tour-overlay` (and any CSS `.driver-overlay` rule) is INERT for
 * this purpose — driver.js paints its overlay `<path>`'s `fill`/`fill-opacity` via inline JS
 * attributes, never from CSS (a `<path>` has no `background`) — so the only way to make the
 * overlay reflect this chrome's own ink color is to read it via `getComputedStyle` and hand
 * driver.js a plain color plus a separate numeric opacity, mirroring the email editor's own
 * `alphaHex(theme.palette.text.primary, 0.55)` (`useEmailBuilderTour.ts`) at the same 0.55.
 *
 * Reads `--pb-chrome-text` (this chrome's tinta principal — `--text`/`--ink` on the host,
 * exactly the token email builder's `text.primary` mirrors) rather than `--pb-chrome-bg`
 * (`--ink-band`, a dedicated SOLID dark-band token, not a scrim) — same reasoning as the
 * `chrome/tour.css` fix. Reading via `getComputedStyle` (not the raw custom-property string)
 * is required because `--pb-chrome-text` ultimately resolves through `var(--text, #1f1e1b)`
 * and dark-mode overrides — only the computed style gives the final concrete color driver.js
 * can use directly (it does not evaluate CSS `var()`/`color-mix()` itself).
 *
 * Falls back to driver.js's own defaults (`undefined`) when `document` is unavailable (SSR —
 * never actually reached, this hook only runs client-side, but keeps this function callable
 * without guards at every call site) or when the computed value is empty.
 */
function resolveTourOverlayColor(): { overlayColor?: string; overlayOpacity?: number } {
  if (typeof document === "undefined" || typeof window === "undefined") return {};
  const computed = window.getComputedStyle(document.documentElement).getPropertyValue("--pb-chrome-text").trim();
  if (!computed) return {};
  return { overlayColor: computed, overlayOpacity: 0.55 };
}

/**
 * Pure eligibility check for auto-starting the tour on mount — extracted so the
 * "never overlap `OnboardingExperienceModal`" invariant (§4 F4 acceptance) is
 * unit-testable without mounting a React tree (this package intentionally has no
 * jsdom/happy-dom, see `tour-anchors-coverage.test.ts`'s own precedent/rationale).
 *
 * - `onboardingResolved` must be `true`: the tour and the onboarding modal (or its
 *   embedded equivalent, the `experienceLevelChosen` auto-resolution in
 *   `Builder42Editor.tsx`) must never overlap.
 * - `alreadyStartedThisMount` guards against re-running the auto-start once per
 *   component lifetime (the `autoStartedRef` in the hook).
 * - `persistedSeen` is `TourPersistenceState.seen` at the current tour version —
 *   `false` either on a true first run, or right after a version bump (the
 *   persistence layer itself treats a stale version as unseen).
 * - `persistedCompleted` is `TourPersistenceState.completed` at the current tour version.
 *   **Progreso persistido**: un tour visto pero NO completado (cerrado a medias por
 *   Escape, click en el overlay, ×, o cierre de pestaña) todavía debe auto-arrancar en
 *   el siguiente mount — `createTour()`'s `start()` ya sabe reanudar desde
 *   `lastStepIndex` en vez de reiniciar en el paso 0 (ver `persistence.ts`), pero ese
 *   mecanismo nunca se alcanza si este guard sigue exigiendo `!persistedSeen`: la
 *   PRIMERA llamada a `start()` ya marca `seen = true` (vía `markSeen`), así que sin
 *   este cambio ningún cierre a medias volvía a auto-arrancar jamás — el usuario tenía
 *   que usar `requestBuilder42TourRestart()` (`ProfileMenu`) a mano, reiniciando desde
 *   el paso 0, exactamente el defecto reportado ("no se persiste el step en el que me
 *   quedé"). Solo `seen && completed` (tour ya terminado con "Listo") sigue sin
 *   auto-arrancar — ese caso es intencional, no un progreso pendiente.
 */
export function shouldAutoStartTour(
  onboardingResolved: boolean,
  alreadyStartedThisMount: boolean,
  persistedSeen: boolean,
  persistedCompleted: boolean,
): boolean {
  return onboardingResolved && !alreadyStartedThisMount && !(persistedSeen && persistedCompleted);
}

export interface UseBuilder42TourOptions {
  /** Subset of host/embed conditions used to filter steps by flag (F3b). */
  config: Builder42TourStepsConfig;
  /**
   * `true` once `OnboardingExperienceModal` has been resolved
   * (`experienceLevelChosen`). The tour never auto-starts before this is
   * `true` — they must never overlap (§4 F4 acceptance).
   */
  onboardingResolved: boolean;
  /** Forwarded to `createTour({ onEvent })`. Never calls any analytics SDK itself. */
  onTourEvent?: (event: TourAnalyticsEvent) => void;
  /**
   * i18next instance whose `languageChanged` event triggers a rebuild so a
   * relaunch after a language switch shows the right copy. `App.tsx`
   * (standalone) uses the default singleton; `Builder42Editor` (embedded)
   * passes its own per-instance i18n (`createEditorI18n`, never the global
   * singleton — see that module's doc).
   */
  i18nInstance: I18nInstance;
}

/** Module-scoped so `requestBuilder42TourRestart()` can reach the mounted controller without prop-drilling a store through `ProfileMenu`. */
let activeRestart: (() => void) | null = null;

/** Relaunches the tour on demand — wired to the `ProfileMenu` entry. No-op if no `useBuilder42Tour` instance is currently mounted. */
export function requestBuilder42TourRestart(): void {
  activeRestart?.();
}

/**
 * Mounted once from `App.tsx` (standalone) or `Builder42Editor.tsx` (embedded).
 * Owns the `Tour` instance lifecycle: builds it from the current config/locale,
 * auto-starts it once when eligible, and restarts it on
 * `requestBuilder42TourRestart()`. Purely an effect-runner — renders nothing.
 */
export function useBuilder42Tour({
  config,
  onboardingResolved,
  onTourEvent,
  i18nInstance,
}: UseBuilder42TourOptions): void {
  const tourRef = useRef<Tour | null>(null);
  const autoStartedRef = useRef(false);
  const configRef = useRef(config);
  configRef.current = config;
  const onTourEventRef = useRef(onTourEvent);
  onTourEventRef.current = onTourEvent;

  function buildTour(): Tour {
    return createTour({
      tourId: TOUR_ID,
      version: TOUR_VERSION,
      steps: buildBuilder42TourSteps(configRef.current),
      persistence: createConfigBackedTourPersistence(),
      onEvent: (event) => onTourEventRef.current?.(event),
      labels: getBuilder42TourLabels(),
      popoverClass: "md-tour",
      ...resolveTourOverlayColor(),
    });
  }

  function restart(): void {
    tourRef.current?.stop();
    const tour = buildTour();
    tourRef.current = tour;
    ensureTourThemeCss();
    void tour.start();
  }

  useEffect(() => {
    activeRestart = restart;
    return () => {
      if (activeRestart === restart) activeRestart = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `restart` reads current config/callback via refs
  }, []);

  useEffect(() => {
    if (!onboardingResolved) return;
    if (autoStartedRef.current) return;

    const persistence = createConfigBackedTourPersistence();
    const state = persistence.read(TOUR_ID, TOUR_VERSION);
    if (!shouldAutoStartTour(onboardingResolved, autoStartedRef.current, state.seen, state.completed)) return;

    autoStartedRef.current = true;
    const tour = buildTour();
    tourRef.current = tour;
    ensureTourThemeCss();
    void tour.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config/onTourEvent read via refs so they don't retrigger auto-start
  }, [onboardingResolved]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      tourRef.current?.stop();
      tourRef.current = buildTour();
    };
    i18nInstance.on("languageChanged", handleLanguageChanged);
    return () => {
      i18nInstance.off("languageChanged", handleLanguageChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config/onTourEvent read via refs intentionally
  }, [i18nInstance]);

  useEffect(() => {
    return () => {
      tourRef.current?.stop();
    };
  }, []);
}
