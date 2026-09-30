/**
 * zoneTourTriggers.ts — chain F29, T4, D-F29.32/.33/.34/.35: starts a zone's tour
 * (library/canvas/rightPanel) the first time the visitor clicks into that zone,
 * gated on the overview tour being finished.
 *
 * This module owns ALL the gating logic (D-F29.35) so `Sidebar.tsx`/`Canvas.tsx`/
 * `Inspector.tsx` stay ignorant of it — each of those three components only imports
 * `notifyTourZoneClick` and wires it to `onClickCapture` on its own root element.
 *
 * D-F29.32 — the trigger for a zone fires only when ALL of these hold:
 *   (a) the OVERVIEW tour is `completed` at the current version (D-F29.11: nothing
 *       auto-triggers until the visitor has finished the introduction);
 *   (b) that zone's own tour is NOT `completed` — deliberately not "has not been
 *       seen". Gating on `seen` would be wrong: `seen` is set by the very first
 *       `start()`, so an abandoned zone tour could never come back, while D-F29.12
 *       requires that an abandoned zone tour RESUMES at its stored step.
 *       `createTour().start()` already resumes on its own whenever
 *       `seen && !completed` — this module only has to let the trigger fire again;
 *   (c) the trigger has not already fired for that zone in this mount — one guard
 *       per zone, module-scoped (see `firedThisMount`, below) so a visitor clicking
 *       around the canvas twenty times gets one tour, not twenty. This is
 *       module-scoped rather than a React ref because this module has no component
 *       of its own — the three callers are plain event handlers, not hooks;
 *   (d) no tour is currently running, and the tour chooser modal is not open.
 *
 * D-F29.33 — callers MUST attach this via `onClickCapture` and MUST NOT call
 * `preventDefault()`/`stopPropagation()` around it: this function itself never
 * touches the event object at all (it takes no event, only a zone id), which makes
 * that contract impossible to violate from inside this module.
 *
 * D-F29.36 — one EXTRA, zone-specific precondition on top of D-F29.32(a)-(d), scoped
 * to `library` only: it also requires the sidebar's active tab to already be
 * `"components"`, because the library tour's first step forces that tab itself. See
 * the comment inside `notifyTourZoneClick` for why. This is deliberately not folded
 * into the general D-F29.32 list above — it is not a rule of the generic
 * zone-trigger mechanism, it is a fix for one zone's tour stepping on its own trigger.
 *
 * Dependency direction: this module imports `startBuilder42Tour`,
 * `isBuilder42TourRunning` and `createConfigBackedTourPersistence` from
 * `useBuilder42Tour.ts`, and `useTourChooserStore` from `tourChooserStore.ts`.
 * `useBuilder42Tour.ts` imports nothing from this module — keep it that way.
 */

import { BUILDER42_TOUR_IDS } from "./tourSteps";
import type { Builder42TourId } from "./tourSteps";
import { useTourChooserStore } from "./tourChooserStore";
import {
  createConfigBackedTourPersistence,
  isBuilder42TourRunning,
  startBuilder42Tour,
  TOUR_VERSION,
} from "./useBuilder42Tour";
import { useDocumentStore } from "@/builder/store/documentStore";

export type TourZone = "library" | "canvas" | "rightPanel";

/** Maps each zone to the tour id it starts (chain F29, T4, D-F29.34). */
const ZONE_TOUR_IDS: Record<TourZone, Builder42TourId> = {
  library: BUILDER42_TOUR_IDS.library,
  canvas: BUILDER42_TOUR_IDS.canvas,
  rightPanel: BUILDER42_TOUR_IDS.rightPanel,
};

/**
 * D-F29.32(c) — one-fire-per-zone guard for the current mount. Module-scoped (not a
 * React ref) because the callers are plain click handlers, not hooks; reset whenever
 * the host app re-mounts the editor in the same page load is not required — a full
 * page reload already clears this module's state along with everything else.
 */
const firedThisMount: Record<TourZone, boolean> = {
  library: false,
  canvas: false,
  rightPanel: false,
};

/**
 * Called by the three zone components' `onClickCapture`. Starts the zone's tour
 * when every D-F29.32 condition holds; otherwise a no-op. Never touches the
 * triggering event — callers attach it directly to `onClickCapture` with no
 * wrapper that could call `preventDefault`/`stopPropagation` (D-F29.33).
 */
export function notifyTourZoneClick(zone: TourZone): void {
  if (firedThisMount[zone]) return;

  // (d) no tour running, chooser not open.
  if (isBuilder42TourRunning()) return;
  if (useTourChooserStore.getState().open) return;

  // D-F29.36 — zone-specific precondition, NOT part of the general D-F29.32(a)-(d)
  // rule above: the `library` zone must not trigger unless the sidebar's active tab
  // is already `"components"`. This exists only because the library tour's first
  // step (`sidebarPalette` in `tourSteps.ts`) forces the tab to `"components"` via
  // `before: () => useDocumentStore.getState().setSidebarTab("components")`. Without
  // this check, `Sidebar.tsx` moving its `onClickCapture` onto the palette panel
  // (D-F29.36's other half) is not enough on its own: a visitor already sitting on
  // the Templates or Tokens tab who clicks something inside that panel (e.g. a
  // template card) would still start a tour whose first step yanks them back to
  // Components — a milder version of the same defect. Gating on the CURRENT tab
  // (read straight from the document store, same field the step itself reads/writes)
  // means the tour only ever auto-starts when it is already pointing at the panel the
  // visitor has open, so it can never move them away from a tab they deliberately
  // chose. This does not apply to `canvas` or `rightPanel` — leave their conditions
  // exactly as the general rule above states.
  if (zone === "library" && useDocumentStore.getState().sidebarTab !== "components") return;

  const persistence = createConfigBackedTourPersistence();

  // (a) overview completed at the current version.
  const overviewState = persistence.read(BUILDER42_TOUR_IDS.overview, TOUR_VERSION);
  if (!overviewState.completed) return;

  // (b) this zone's own tour is NOT completed (seen-but-abandoned still triggers,
  // so `createTour().start()` can resume it from its stored step).
  const tourId = ZONE_TOUR_IDS[zone];
  const zoneState = persistence.read(tourId, TOUR_VERSION);
  if (zoneState.completed) return;

  firedThisMount[zone] = true;
  startBuilder42Tour(tourId);
}
