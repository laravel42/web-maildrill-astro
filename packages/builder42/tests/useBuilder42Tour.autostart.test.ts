/**
 * useBuilder42Tour.autostart.test.ts — F4 acceptance
 * (docs/product-tour-driverjs-plan.md §4): "arranque automático solo tras resolver
 * OnboardingExperienceModal; el tour y el modal nunca se solapan." Extendido con el
 * criterio de progreso persistido (§ reanudación): un tour visto pero NO completado
 * debe seguir auto-arrancando (para reanudar desde `lastStepIndex`, ver
 * `createTour.ts`'s `start()`) — solo un tour ya COMPLETADO deja de auto-arrancar.
 *
 * Tests the pure `shouldAutoStartTour` eligibility check `useBuilder42Tour` wires into its
 * auto-start effect — extracted specifically so this invariant is unit-testable without
 * mounting a React tree (this package has no jsdom/happy-dom, see
 * `tour-anchors-coverage.test.ts`'s precedent).
 */
import { describe, expect, it } from "vitest";
import { shouldAutoStartTour } from "@/app/tour/useBuilder42Tour";

describe("shouldAutoStartTour — never overlaps OnboardingExperienceModal (§4 F4)", () => {
  it("does NOT start while onboarding is unresolved, even on a fresh (unseen) tour", () => {
    expect(shouldAutoStartTour(false, false, false, false)).toBe(false);
  });

  it("starts once onboarding resolves, for an unseen tour that hasn't started yet this mount", () => {
    expect(shouldAutoStartTour(true, false, false, false)).toBe(true);
  });

  it("does not start again this mount even if onboarding just resolved (already started guard)", () => {
    expect(shouldAutoStartTour(true, true, false, false)).toBe(false);
  });

  it("does not start when the tour was already seen AND completed at the current version", () => {
    expect(shouldAutoStartTour(true, false, true, true)).toBe(false);
  });

  it("never starts while onboarding is unresolved, regardless of seen/completed/started state", () => {
    for (const alreadyStarted of [false, true]) {
      for (const seen of [false, true]) {
        for (const completed of [false, true]) {
          expect(shouldAutoStartTour(false, alreadyStarted, seen, completed)).toBe(false);
        }
      }
    }
  });
});

describe("shouldAutoStartTour — progreso persistido (§ reanudación, defecto: 'no se persiste el step en el que me quedé')", () => {
  it("starts again for a tour that was seen but NOT completed (closed mid-way — Escape/overlay/×/tab close)", () => {
    expect(shouldAutoStartTour(true, false, true, false)).toBe(true);
  });

  it("does not start for a tour that was seen and completed, even with the already-started guard clear", () => {
    expect(shouldAutoStartTour(true, false, true, true)).toBe(false);
  });

  it("an unseen tour is never reported as completed (completed=true with seen=false is not a real persisted shape, but the guard still starts on seen=false regardless of completed)", () => {
    expect(shouldAutoStartTour(true, false, false, true)).toBe(true);
    expect(shouldAutoStartTour(true, false, false, false)).toBe(true);
  });
});
