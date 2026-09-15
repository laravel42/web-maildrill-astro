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

  it("renders <HostTourRestart /> as a sibling of the toolbarHistory-anchored wrapper, not inside it (B15)", () => {
    const toolbarFnBody = source.slice(source.indexOf("export function HostCanvasToolbar"));
    // The element carrying the toolbarHistory anchor must close (</div>) before
    // <HostTourRestart /> appears — i.e. HostTourRestart is NOT a descendant of it.
    const anchorOpenIdx = toolbarFnBody.indexOf(
      "dataTourAttr(BUILDER42_TOUR_ANCHORS.toolbarHistory)",
    );
    expect(anchorOpenIdx).toBeGreaterThan(-1);
    const afterAnchor = toolbarFnBody.slice(anchorOpenIdx);
    const anchorWrapperCloseIdx = afterAnchor.indexOf("</div>");
    const restartUsageIdx = afterAnchor.indexOf("<HostTourRestart />");
    expect(anchorWrapperCloseIdx).toBeGreaterThan(-1);
    expect(restartUsageIdx).toBeGreaterThan(-1);
    expect(restartUsageIdx).toBeGreaterThan(anchorWrapperCloseIdx);
  });

  it("drops the redundant role=group/aria-label on the tour-restart wrapper (button keeps its own accessible name)", () => {
    const restartFnBody = source.slice(
      source.indexOf("function HostTourRestart()"),
      source.indexOf("export function HostCanvasToolbar"),
    );
    expect(restartFnBody).not.toMatch(/role="group"/);
    // The wrapper div itself must not carry aria-label (only the button does).
    const wrapperOpenTag = restartFnBody.slice(
      restartFnBody.indexOf('<div className="pbx-history"'),
      restartFnBody.indexOf(">") + restartFnBody.indexOf('<div className="pbx-history"'),
    );
    expect(wrapperOpenTag).not.toMatch(/aria-label/);
    // The button still carries its own accessible name via aria-label.
    expect(restartFnBody).toMatch(/aria-label=\{t\("restartTour\.label"\)\}/);
  });
});
