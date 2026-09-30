/**
 * TourChooserModal — lets the visitor pick one of the four Builder42 tours (chain
 * F29, T3, D-F29.26/.29/.30). Opened two ways, both outside this component:
 *   1. `useBuilder42Tour.ts`'s `onEvent` handler calls
 *      `useTourChooserStore.getState().openChooser()` when the OVERVIEW tour's
 *      `tour_completed` event fires (never on `tour_dismissed`, and never for
 *      tours 1-3 — D-F29.26).
 *   2. `requestBuilder42TourRestart()` (`ProfileMenu`/`HostToolbar`'s "tour again"
 *      control) now opens this chooser instead of restarting the overview directly
 *      (D-F29.27).
 *
 * State lives in `tourChooserStore.ts` (D-F29.30), not local `useState` in a parent,
 * because the first opener above is a non-React call site. This component only reads
 * `open` and calls `closeChooser()`; it renders `null` when `open` is `false` so it can
 * be mounted unconditionally in both shells (`app/App.tsx`, `Builder42Editor.tsx`).
 *
 * Structure and classes are copied from `OnboardingExperienceModal.tsx` (D-F29.29 — this
 * task adds NO CSS): `SimpleModal` with `className="pbx-modal"`, a
 * `data-c42-modal-overlay` div (`pbx-modal__overlay`), a `data-c42-modal-content` div
 * (`pbx-modal__content pbx-onboarding-modal`), `pbx-modal__header`/`pbx-modal__title`/
 * `pbx-modal__body`, and the four tour choices as
 * `pbx-onboarding-modal__options`/`pbx-onboarding-modal__option`/
 * `pbx-onboarding-modal__option-title` (plus the precedent's own
 * `pbx-onboarding-modal__option-desc` for the one-line description — already used by
 * `OnboardingExperienceModal`'s experience-level step, not a new class).
 *
 * Copy (D-F29.31): `tour.json`'s new `chooser` section —
 * `chooser.title`, `chooser.subtitle`, `chooser.closeLabel`, and per-tour
 * `chooser.tours.<overview|library|canvas|rightPanel>.title`/`.description`, keyed by
 * the same `Builder42TourId` values as `BUILDER42_TOUR_IDS`. Resolved from this
 * component's own `useTranslation("tour")` — the same i18next instance already
 * providing this namespace to `useBuilder42Tour`/`tourSteps.ts` (standalone: the global
 * singleton via `I18nextProvider`-less default context; embedded: the per-instance
 * i18n `Builder42Editor.tsx` already wraps its tree in via `I18nextProvider`).
 *
 * Dismissal (Escape, the overlay, or the close button) starts nothing — it only calls
 * `closeChooser()`, mirroring `OnboardingExperienceModal`'s `onClose` wiring. Choosing a
 * tour closes the chooser AND calls `startBuilder42Tour(id)` (D-F29.28) immediately.
 */

import { useTranslation } from "react-i18next";
import { SimpleModal } from "@/components";
import { BUILDER42_TOUR_ORDER, type Builder42TourId } from "./tourSteps";
import { startBuilder42Tour } from "./useBuilder42Tour";
import { useTourChooserStore } from "./tourChooserStore";

/** Maps a tour id to the key segment used under `tour.json`'s `chooser.tours.*`. */
const TOUR_COPY_KEY: Record<Builder42TourId, "overview" | "library" | "canvas" | "rightPanel"> = {
  "builder42.overview": "overview",
  "builder42.library": "library",
  "builder42.canvas": "canvas",
  "builder42.rightPanel": "rightPanel",
};

export function TourChooserModal() {
  const { t } = useTranslation("tour");
  const open = useTourChooserStore((s) => s.open);
  const closeChooser = useTourChooserStore((s) => s.closeChooser);

  if (!open) return null;

  const handleClose = () => {
    closeChooser();
  };

  const chooseTour = (tourId: Builder42TourId) => {
    closeChooser();
    startBuilder42Tour(tourId);
  };

  return (
    <SimpleModal className="pbx-modal" onClose={handleClose}>
      <div data-c42-modal-overlay className="pbx-modal__overlay" />
      <div
        data-c42-modal-content
        className="pbx-modal__content pbx-onboarding-modal"
        aria-label={t("chooser.title")}
      >
        <div className="pbx-modal__header">
          <h3 className="pbx-modal__title">{t("chooser.title")}</h3>
        </div>

        <div className="pbx-modal__body">
          <p className="pbx-onboarding-modal__subtitle">{t("chooser.subtitle")}</p>

          <div className="pbx-onboarding-modal__options">
            {BUILDER42_TOUR_ORDER.map((tourId) => {
              const copyKey = TOUR_COPY_KEY[tourId];
              return (
                <button
                  key={tourId}
                  type="button"
                  className="pbx-onboarding-modal__option"
                  onClick={() => chooseTour(tourId)}
                >
                  <span className="pbx-onboarding-modal__option-title">
                    {t(`chooser.tours.${copyKey}.title`)}
                  </span>
                  <span className="pbx-onboarding-modal__option-desc">
                    {t(`chooser.tours.${copyKey}.description`)}
                  </span>
                </button>
              );
            })}
          </div>

          <button type="button" className="pbx-onboarding-modal__option" onClick={handleClose}>
            <span className="pbx-onboarding-modal__option-title">{t("chooser.closeLabel")}</span>
          </button>
        </div>
      </div>
    </SimpleModal>
  );
}
