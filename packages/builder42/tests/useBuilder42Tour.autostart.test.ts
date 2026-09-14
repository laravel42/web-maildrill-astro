/**
 * useBuilder42Tour.autostart.test.ts — F4 acceptance
 * (docs/product-tour-driverjs-plan.md §4): "arranque automático solo tras resolver
 * OnboardingExperienceModal; el tour y el modal nunca se solapan."
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
    expect(shouldAutoStartTour(false, false, false)).toBe(false);
  });

  it("starts once onboarding resolves, for an unseen tour that hasn't started yet this mount", () => {
    expect(shouldAutoStartTour(true, false, false)).toBe(true);
  });

  it("does not start again this mount even if onboarding just resolved (already started guard)", () => {
    expect(shouldAutoStartTour(true, true, false)).toBe(false);
  });

  it("does not start when the tour was already seen at the current version", () => {
    expect(shouldAutoStartTour(true, false, true)).toBe(false);
  });

  it("never starts while onboarding is unresolved, regardless of seen/started state", () => {
    for (const alreadyStarted of [false, true]) {
      for (const seen of [false, true]) {
        expect(shouldAutoStartTour(false, alreadyStarted, seen)).toBe(false);
      }
    }
  });
});
