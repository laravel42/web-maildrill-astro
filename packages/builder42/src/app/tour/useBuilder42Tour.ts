/**
 * useBuilder42Tour.ts — F4 wiring (docs/product-tour-driverjs-plan.md §4): the piece
 * that actually starts the tour. F1 built the engine (`@md/product-tour`), F2b the
 * anchors, F3b the steps + copy — nothing consumed them yet.
 *
 * Responsibilities:
 * - Builds a `Tour` (`@md/product-tour`) from `buildBuilder42TourSteps` (F3b),
 *   re-created whenever the step-relevant config or the active i18next instance's
 *   language changes (copy is resolved at build time from `i18n.t`, not reactively).
 * - Persists "seen"/version through `useLocalConfig`'s `tours` record key
 *   (`pb:tours` in `localStorage`, one entry per tour id — chain F29, T1,
 *   D-F29.17) rather than letting `@md/product-tour`'s own
 *   `createLocalStoragePersistence` mint a second, independent set of keys —
 *   a custom `TourPersistence` adapter (below) bridges the package's
 *   persistence contract onto `readConfig`/`writeConfig` so there is a
 *   SINGLE source of truth for "has this browser seen this tour", reachable
 *   from both this controller and any future chrome UI that wants to read
 *   `tours` directly (e.g. a settings toggle) without reaching into
 *   `localStorage` under a second key convention. `@md/product-tour` itself
 *   stays unaware of `useLocalConfig` — it only sees the `TourPersistence`
 *   interface (§0.4: the package never assumes a prefix or a storage
 *   backend).
 * - Auto-starts once per mount, but ONLY after `OnboardingExperienceModal` has been
 *   resolved (`experienceLevelChosen === true`) — the tour and the modal must never
 *   overlap (§4 F4 acceptance). Callers pass `onboardingResolved` explicitly instead
 *   of this module reading `useLocalConfig("experienceLevelChosen")` itself, so the
 *   gating stays visible at the call site (`App.tsx` / `Builder42Editor.tsx`).
 * - Exposes `requestBuilder42TourRestart()` — since chain F29 T3 (D-F29.27), it opens
 *   the tour chooser (`TourChooserModal`) rather than restarting the overview tour
 *   directly, so the visitor can pick any of the four tours. Wired to the
 *   `ProfileMenu`/`HostToolbar` "tour again" control. `startBuilder42Tour(tourId)`
 *   (D-F29.28) is the chooser's own way to start a specific tour, built on the same
 *   module-scoped bridge pattern.
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
import { buildBuilder42TourStepsFor, getBuilder42TourLabels, BUILDER42_TOUR_IDS } from "./tourSteps";
import type { Builder42TourStepsConfig, Builder42TourId } from "./tourSteps";
import type { TourPersistedState } from "@/hooks/useLocalConfig";
import { useTourChooserStore } from "./tourChooserStore";

/** Bump to re-offer the tour to everyone who already saw a previous version — shared
 * across all four tours (chain F29, T2a, D-F29.19). Exported (chain F29, T4) so
 * `zoneTourTriggers.ts` reads persisted state at the same version this module builds
 * tours with, rather than hardcoding a second copy of the number. */
export const TOUR_VERSION = 1;

/**
 * Bridges `@md/product-tour`'s `TourPersistence` contract onto ONE `useLocalConfig`
 * record key, `tours` (chain F29, T1, D-F29.17) — `Record<tourId, TourPersistedState>` —
 * instead of the four flat keys (`tourSeen`/`tourVersion`/`tourCompleted`/
 * `tourLastStepIndex`) this bridge used before. Those four keys are now legacy: still
 * declared in `ConfigMap` (deployed browsers already carry them and no migration was
 * written, D-F29.18), but no longer read or written anywhere in this file. Builder42 can
 * now run several tours, each disambiguated by the `tourId` every method already receives.
 *
 * TRAP this bridge exists to avoid: every method below re-reads `readConfig("tours")`
 * at the moment it writes, and writes back the WHOLE record with only its own
 * `tours[tourId]` entry replaced. `buildTour()` (below) creates a fresh bridge instance
 * per tour, and the hook creates more than one bridge over a session — caching the
 * record in a closure or module variable would let two tours clobber each other's
 * entries on write. There is no cached state in this function at all; every method
 * hits `readConfig`/`writeConfig` directly.
 *
 * Exported (not just module-private) so it can be unit-tested directly
 * against `readConfig`/`writeConfig` without mounting any React tree — this
 * package intentionally has no jsdom/happy-dom (§ F2b precedent,
 * `tour-anchors-coverage.test.ts`), so hook-level tests that need a DOM are
 * out of reach without adding a new dependency.
 */
export function createConfigBackedTourPersistence(): TourPersistence {
  function readEntry(tourId: string): TourPersistedState | undefined {
    return readConfig("tours")[tourId];
  }

  /** Read-modify-write: always re-reads the full record, replaces only `tourId`'s entry. */
  function writeEntry(tourId: string, entry: TourPersistedState): void {
    const current = readConfig("tours");
    writeConfig("tours", { ...current, [tourId]: entry });
  }

  function read(tourId: string, currentVersion: number): TourPersistenceState {
    const entry = readEntry(tourId);
    if (!entry || entry.version !== currentVersion) {
      return { seen: false, completed: false, version: currentVersion };
    }
    return {
      seen: entry.seen,
      completed: entry.completed,
      version: entry.version,
      ...(entry.lastStepIndex !== undefined ? { lastStepIndex: entry.lastStepIndex } : {}),
    };
  }

  return {
    read,
    markSeen(tourId, currentVersion) {
      const entry = readEntry(tourId);
      // H125 correction (chain F29, T4): construct the written entry EXPLICITLY
      // instead of opening with `...entry` — spreading the old entry carried a stale
      // `lastStepIndex`/`completed` from a previous tour VERSION forward into the
      // freshly written one, because the conditional spread below only ever ADDED
      // those fields back, it never removed what the unconditional spread already
      // placed. Pre-existing, currently harmless (`TOUR_VERSION` is 1 and `pb:tours`
      // is a new key with no deployed data) — a correctness fix, not a bug fix.
      const carryForward = entry?.version === currentVersion;
      writeEntry(tourId, {
        seen: true,
        completed: carryForward ? (entry?.completed ?? false) : false,
        version: currentVersion,
        ...(carryForward && entry?.lastStepIndex !== undefined ? { lastStepIndex: entry.lastStepIndex } : {}),
      });
    },
    markCompleted(tourId, currentVersion) {
      // Un tour completado no tiene "progreso a medias" que reanudar — mismo criterio que
      // `createLocalStoragePersistence`'s `markCompleted` (`persistence.ts`): `lastStepIndex`
      // se omite del todo en vez de persistir un sentinel.
      writeEntry(tourId, {
        seen: true,
        completed: true,
        version: currentVersion,
      });
    },
    saveProgress(tourId, stepIndex, currentVersion) {
      const entry = readEntry(tourId);
      // Same H125 correction as `markSeen()` above — explicit construction, no
      // `...entry` spread of a possibly stale previous-version entry.
      const carryForward = entry?.version === currentVersion;
      writeEntry(tourId, {
        seen: true,
        completed: carryForward ? (entry?.completed ?? false) : false,
        version: currentVersion,
        lastStepIndex: stepIndex,
      });
    },
    reset(tourId) {
      const current = readConfig("tours");
      const { [tourId]: _removed, ...rest } = current;
      writeConfig("tours", rest);
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

/**
 * Relaunches the tour on demand — wired to the `ProfileMenu`/`HostToolbar` "tour
 * again" control. No-op if no `useBuilder42Tour` instance is currently mounted.
 *
 * chain F29, T3, D-F29.27: this function KEEPS its exact exported name and signature,
 * but its behaviour changed — it used to restart the overview tour directly; it now
 * OPENS the tour chooser (`useTourChooserStore.getState().openChooser()`) so the
 * visitor can pick any of the four tours, same as completing the overview tour does
 * (below). The name still reads true: the visitor is requesting the tour again, and
 * the chooser is how they now pick which one. A rename was deliberately deferred
 * (D-F29.27) because `tests/hostToolbar.tourRestart.test.ts` asserts on the literal
 * source text of `HostToolbar.tsx`, which this task does not touch.
 */
export function requestBuilder42TourRestart(): void {
  useTourChooserStore.getState().openChooser();
}

/**
 * chain F29, T3, D-F29.28 — starts the requested tour on the mounted controller,
 * built on the same module-scoped bridge pattern the old `activeRestart` used (a
 * module-level `let`, set in an effect, cleared on unmount) so `TourChooserModal` can
 * reach the mounted controller without prop-drilling. Stops any tour currently
 * running, builds the requested tour fresh (`buildTour`, which also updates
 * `activeTourIdRef` so a later language change rebuilds the right tour) and starts it.
 * No-op if no `useBuilder42Tour` instance is currently mounted.
 */
let activeStartTour: ((tourId: Builder42TourId) => void) | null = null;

export function startBuilder42Tour(tourId: Builder42TourId): void {
  activeStartTour?.(tourId);
}

/**
 * chain F29, T4, D-F29.32(d) — the smallest possible "is a tour running right now"
 * flag, added because `zoneTourTriggers.ts` needs to read it and nothing in this
 * module exposed it yet. Module-scoped like `activeStartTour` above (same bridge
 * pattern): set to `true` on the `tour_started` analytics event and cleared on
 * `tour_completed`/`tour_dismissed` (both forwarded through the existing `onEvent`
 * handler in `buildTour`, below) and on unmount, so it never gets stuck `true`
 * after a tour ends for any reason.
 */
let tourIsRunning = false;

export function isBuilder42TourRunning(): boolean {
  return tourIsRunning;
}

/**
 * Mounted once from `App.tsx` (standalone) or `Builder42Editor.tsx` (embedded).
 * Owns the `Tour` instance lifecycle: builds it from the current config/locale,
 * auto-starts it once when eligible, and starts any of the four tours on demand via
 * `startBuilder42Tour()` (chain F29, T3, D-F29.28) — which is what
 * `TourChooserModal` calls. Purely an effect-runner — renders nothing.
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
  /** chain F29, T2a — tracks whichever tour is currently mounted, so `languageChanged`
   * rebuilds THAT tour rather than hardcoding the overview. Starts on the overview
   * because that is also what the auto-start effect runs. */
  const activeTourIdRef = useRef<Builder42TourId>(BUILDER42_TOUR_IDS.overview);

  function buildTour(tourId: Builder42TourId): Tour {
    activeTourIdRef.current = tourId;
    return createTour({
      tourId,
      version: TOUR_VERSION,
      steps: buildBuilder42TourStepsFor(tourId, configRef.current, i18nInstance),
      persistence: createConfigBackedTourPersistence(),
      onEvent: (event) => {
        // chain F29, T4, D-F29.32(d) — tracks whether a tour is currently running so
        // `zoneTourTriggers.ts` can read it via `isBuilder42TourRunning()` without a
        // second source of truth. `tour_started` sets it; both terminal events clear
        // it — a tour must never leave this flag stuck `true`.
        if (event.event === "tour_started") {
          tourIsRunning = true;
        } else if (event.event === "tour_completed" || event.event === "tour_dismissed") {
          tourIsRunning = false;
        }
        // chain F29, T3, D-F29.26 — the chooser opens ONLY on `tour_completed` of the
        // OVERVIEW tour, never on `tour_dismissed`, and never for tours 1-3. This runs
        // in ADDITION to the forwarding below, never instead of it.
        if (event.event === "tour_completed" && event.tourId === BUILDER42_TOUR_IDS.overview) {
          useTourChooserStore.getState().openChooser();
        }
        onTourEventRef.current?.(event);
      },
      labels: getBuilder42TourLabels(i18nInstance),
      popoverClass: "md-tour",
      ...resolveTourOverlayColor(),
    });
  }

  function startTour(tourId: Builder42TourId): void {
    tourRef.current?.stop();
    tourIsRunning = false;
    const tour = buildTour(tourId);
    tourRef.current = tour;
    ensureTourThemeCss();
    void tour.start();
  }

  useEffect(() => {
    activeStartTour = startTour;
    return () => {
      if (activeStartTour === startTour) activeStartTour = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `startTour` reads current config/callback via refs
  }, []);

  useEffect(() => {
    if (!onboardingResolved) return;
    if (autoStartedRef.current) return;

    const persistence = createConfigBackedTourPersistence();
    const state = persistence.read(BUILDER42_TOUR_IDS.overview, TOUR_VERSION);
    if (!shouldAutoStartTour(onboardingResolved, autoStartedRef.current, state.seen, state.completed)) return;

    autoStartedRef.current = true;
    const tour = buildTour(BUILDER42_TOUR_IDS.overview);
    tourRef.current = tour;
    ensureTourThemeCss();
    void tour.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- config/onTourEvent read via refs so they don't retrigger auto-start
  }, [onboardingResolved]);

  useEffect(() => {
    const handleLanguageChanged = () => {
      tourRef.current?.stop();
      tourRef.current = buildTour(activeTourIdRef.current);
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
      tourIsRunning = false;
    };
  }, []);
}
