/**
 * tourChooserStore.ts — tiny zustand store for `TourChooserModal`'s open/closed state
 * (chain F29, T3, D-F29.30).
 *
 * This is a store, not `useState` in a parent, because the modal must be openable from
 * a NON-React call site: `useBuilder42Tour.ts`'s `onEvent` callback (a plain function
 * handed to `@md/product-tour`, outside any component render) calls
 * `useTourChooserStore.getState().openChooser()` directly when the overview tour
 * completes. A prop threaded down from `App.tsx`/`Builder42Editor.tsx` cannot reach
 * that callback without prop-drilling through `useBuilder42Tour`'s own options, which
 * is exactly the seam this store avoids — same reasoning as `activeRestart`'s
 * module-scoped bridge in `useBuilder42Tour.ts`.
 *
 * Deliberately minimal (D-F29.30): only `open`/`openChooser`/`closeChooser`. No list of
 * tours, no selected id, no copy — `TourChooserModal` reads `BUILDER42_TOUR_ORDER` and
 * the i18n catalogs directly, and calls `startBuilder42Tour(id)` on choice.
 */

import { create } from "zustand";

interface TourChooserState {
  open: boolean;
  openChooser: () => void;
  closeChooser: () => void;
}

export const useTourChooserStore = create<TourChooserState>((set) => ({
  open: false,
  openChooser: () => set({ open: true }),
  closeChooser: () => set({ open: false }),
}));
