import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * hostToolbar.tourRestart.test.ts — covers the landings-editor toolbar's tour-relaunch
 * button added in `HostToolbar.tsx` (D9/D14).
 *
 * Static source scan, not a render test: this package runs vitest in
 * `environment: "node"` with no `@testing-library/react`/`jsdom`/`happy-dom` installed
 * (see `tour-anchors-coverage.test.ts`'s own note on the same constraint), so mounting
 * `HostCanvasToolbar` and clicking the button is not possible without adding a
 * dependency, which is out of scope here. What is coverable — and what this test
 * asserts — is the source contract: the control calls `requestBuilder42TourRestart()`
 * and, per the corrected D14 contract, carries no `data-tour` anchor (this control is
 * reachable by accessible name, not by a tour-step anchor — `BUILDER42_TOUR_ANCHORS`
 * stays 1:1 with actual tour steps).
 */

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));

function read(relPath: string): string {
  return readFileSync(`${pkgRoot}/${relPath}`, "utf8");
}

describe("HostToolbar — tour-restart control (D14: no tour anchor)", () => {
  const source = read("src/app/layout/HostToolbar.tsx");

  it("renders a real button wired to requestBuilder42TourRestart()", () => {
    expect(source).toMatch(/function HostTourRestart\(\)/);
    expect(source).toMatch(/<button\s+type="button"[\s\S]*?onClick=\{\(\)\s*=>\s*requestBuilder42TourRestart\(\)\}/);
  });

  it("resolves title/aria-label from the existing restartTour i18n key", () => {
    expect(source).toMatch(/title=\{t\("restartTour\.label"\)\}/);
    expect(source).toMatch(/aria-label=\{t\("restartTour\.label"\)\}/);
  });

  it("marks its icon aria-hidden", () => {
    expect(source).toMatch(/<HelpCircle size=\{16\} aria-hidden="true" \/>/);
  });

  it("never hardcodes a data-tour string literal anywhere in this file", () => {
    expect(source).not.toMatch(/data-tour\s*=\s*["'{]/);
  });

  it("does not stamp dataTourAttr on the tour-restart group (no toolbarTourRestart anchor)", () => {
    const restartFnBody = source.slice(source.indexOf("function HostTourRestart()"));
    expect(restartFnBody.slice(0, restartFnBody.indexOf("function HostCanvasToolbar"))).not.toMatch(
      /dataTourAttr/,
    );
  });
});
