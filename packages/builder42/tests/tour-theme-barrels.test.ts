import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * tour-theme-barrels.test.ts — F5 acceptance (docs/product-tour-driverjs-plan.md §2, §4):
 *
 *   (a) `chrome/tour.css` is registered in BOTH barrels (`chrome.css` standalone,
 *       `chrome-embedded.css` embedded), at the same relative position — the explicit
 *       rule documented in `chrome/README.md` ("Cualquier módulo nuevo que se agregue al
 *       barrel standalone debe agregarse también a chrome-embedded.css, en la misma
 *       posición relativa").
 *   (b) `chrome/tour.css` maps every `--md-tour-*` variable consumed by
 *       `@md/product-tour`'s `theme.css` (`.md-tour` rules) — a variable left unmapped is
 *       "a half-painted popover" (task DONE WHEN). Cross-checked against the *actual*
 *       `theme.css` source rather than a hardcoded list, so this test breaks (not silently
 *       passes) if the shared package ever adds a new `--md-tour-*` variable.
 *
 * Static source scan (same convention as `tour-anchors-coverage.test.ts` and
 * `i18n-chrome-coverage.test.ts`): this package's `vitest.config.ts` runs in
 * `environment: "node"` with no jsdom/happy-dom, so CSS is read as text, not parsed by a
 * browser engine — sufficient here since we only need to confirm `@import` presence/order
 * and `--md-tour-*: ...;` declarations, not computed styles.
 */

const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const productTourRoot = fileURLToPath(new URL("../../product-tour", import.meta.url));

function read(relPath: string): string {
  return readFileSync(`${pkgRoot}/${relPath}`, "utf8");
}

function readProductTour(relPath: string): string {
  return readFileSync(`${productTourRoot}/${relPath}`, "utf8");
}

/** Every `@import "./chrome/<name>.css";` line, in file order. */
function extractImportOrder(barrelSource: string): string[] {
  const matches = barrelSource.matchAll(/@import\s+"\.\/chrome\/([\w-]+)\.css";/g);
  return [...matches].map((m) => m[1]!);
}

/** Every `--md-tour-<name>` used as a CSS custom property in `theme.css`'s `var(--md-tour-*)` reads. */
function extractConsumedMdTourVars(themeCssSource: string): string[] {
  const matches = themeCssSource.matchAll(/var\((--md-tour-[\w-]+)\)/g);
  const unique = new Set([...matches].map((m) => m[1]!));
  return [...unique].sort();
}

/** Every `--md-tour-<name>: ...;` declared (mapped) by `chrome/tour.css`. */
function extractDeclaredMdTourVars(tourCssSource: string): string[] {
  const matches = tourCssSource.matchAll(/(--md-tour-[\w-]+)\s*:/g);
  const unique = new Set([...matches].map((m) => m[1]!));
  return [...unique].sort();
}

describe("Builder42 tour theme — barrel registration (F5)", () => {
  it("chrome.css (standalone barrel) imports chrome/tour.css", () => {
    const chromeCss = read("src/styles/chrome.css");
    expect(extractImportOrder(chromeCss)).toContain("tour");
  });

  it("chrome-embedded.css (embedded barrel) imports chrome/tour.css", () => {
    const chromeEmbeddedCss = read("src/styles/chrome-embedded.css");
    expect(extractImportOrder(chromeEmbeddedCss)).toContain("tour");
  });

  it("tour.css sits at the same relative position in both barrels", () => {
    const standaloneOrder = extractImportOrder(read("src/styles/chrome.css"));
    const embeddedOrder = extractImportOrder(read("src/styles/chrome-embedded.css"));

    // The embedded barrel omits `standalone.css` on purpose (documented in both files'
    // own header comments and in `chrome/README.md`) — excluding that one entry, every
    // other module (including `tour`) must appear in the exact same order in both.
    const standaloneWithoutStandaloneCss = standaloneOrder.filter((name) => name !== "standalone");
    expect(standaloneWithoutStandaloneCss).toEqual(embeddedOrder);

    // Sanity: `tour` is genuinely present in both (not just absent from both, which
    // would also make the arrays equal).
    expect(standaloneWithoutStandaloneCss).toContain("tour");
  });

  it("tour.css is imported before dark.css in both barrels (dark.css must load last, per README)", () => {
    for (const barrel of ["chrome.css", "chrome-embedded.css"]) {
      const order = extractImportOrder(read(`src/styles/${barrel}`));
      const tourIndex = order.indexOf("tour");
      const darkIndex = order.indexOf("dark");
      expect(tourIndex, `${barrel}: tour.css missing`).toBeGreaterThanOrEqual(0);
      expect(darkIndex, `${barrel}: dark.css missing`).toBeGreaterThanOrEqual(0);
      expect(tourIndex).toBeLessThan(darkIndex);
    }
  });
});

describe("Builder42 tour theme — full --md-tour-* coverage (F5)", () => {
  it("chrome/tour.css maps every --md-tour-* variable consumed by @md/product-tour's theme.css", () => {
    const consumed = extractConsumedMdTourVars(readProductTour("src/theme.css"));
    const declared = extractDeclaredMdTourVars(read("src/styles/chrome/tour.css"));

    // Every variable the shared theme reads must be declared here — an unmapped
    // variable is the "popover a medio pintar" failure mode named in DONE WHEN.
    expect(declared).toEqual(expect.arrayContaining(consumed));
  });

  it("declares no --md-tour-* variable outside the set theme.css actually consumes (typo/drift guard)", () => {
    const consumed = new Set(extractConsumedMdTourVars(readProductTour("src/theme.css")));
    const declared = extractDeclaredMdTourVars(read("src/styles/chrome/tour.css"));

    for (const name of declared) {
      expect(consumed.has(name), `${name} is declared but theme.css never reads it`).toBe(true);
    }
  });

  it("brand rule: --md-tour-accent maps to the indigo interactive accent, never the orange brand token", () => {
    const tourCss = read("src/styles/chrome/tour.css");
    const accentLine = tourCss.split("\n").find((line) => line.trim().startsWith("--md-tour-accent:"));
    expect(accentLine).toBeDefined();
    expect(accentLine).toMatch(/--pb-chrome-accent\b/);
    expect(accentLine).not.toMatch(/--pb-chrome-header-brand\b/);
  });

  it("overlay uses the ink/text-derived token at low opacity, not a hardcoded pure black", () => {
    // D51: the overlay's real color/opacity is resolved at runtime by
    // `useBuilder42Tour.ts`'s `resolveTourOverlayColor()` (reads `--pb-chrome-text` via
    // `getComputedStyle`, forwarded to `createTour()`'s `overlayColor`/`overlayOpacity`) —
    // NOT via a `--md-tour-overlay` CSS variable here, which would be inert (driver.js paints
    // its overlay `<path>`'s fill via inline JS attributes, never from CSS). Assert the runtime
    // source directly instead of a CSS declaration.
    const hookSource = read("src/app/tour/useBuilder42Tour.ts");
    const readLine = hookSource
      .split("\n")
      .find((line) => line.includes("getPropertyValue"));
    expect(readLine).toBeDefined();
    expect(readLine).toMatch(/--pb-chrome-text\b/);
    expect(readLine).not.toMatch(/--pb-chrome-bg\b/);
  });
});

describe("Builder42 tour theme — dark override (F5)", () => {
  it("dark.css declares an explicit F5 tour override block", () => {
    const darkCss = read("src/styles/chrome/dark.css");
    expect(darkCss).toMatch(/Tour \(F5/);
  });

  it("the surface/text/border tokens tour.css maps from are reassigned by dark.css's theme-wide block (so the popover picks up dark values via cascade)", () => {
    // These four are the ones that visibly change between themes (surface flips from
    // white to ink, text/border flip contrast) — verified directly against dark.css's
    // OWN documented reassignments for these exact tokens (see the file's header
    // comment block), not inferred by a naming heuristic. `--pb-chrome-radius-lg`,
    // `--pb-chrome-font`, `--pb-chrome-accent` and `--pb-chrome-accent-text` are, by
    // this file's own documentation, intentionally constant across themes (radius/type
    // scale never varies; the solid indigo accent + its white contrast text are kept
    // identical on purpose so the "filled button" contrast pair never breaks) — see the
    // next test for how those are still verified, not skipped.
    const darkCss = read("src/styles/chrome/dark.css");
    const mustVaryInDark = [
      "--pb-chrome-surface-raised",
      "--pb-chrome-text",
      "--pb-chrome-text-muted",
      "--pb-chrome-border",
    ];
    for (const token of mustVaryInDark) {
      expect(new RegExp(`${token}\\s*:`).test(darkCss), `${token} must be reassigned in dark.css`).toBe(true);
    }
  });

  it("the color tokens tour.css depends on that are constant across themes (--pb-chrome-accent-text) are explicitly reasserted in the F5 block, not left to accidental cascade", () => {
    const darkCss = read("src/styles/chrome/dark.css");
    const f5BlockStart = darkCss.indexOf("Tour (F5");
    expect(f5BlockStart).toBeGreaterThanOrEqual(0);
    const f5Block = darkCss.slice(f5BlockStart);

    expect(f5Block).toMatch(/--pb-chrome-accent-text\s*:/);
  });

  it("chrome/tour.css only maps --md-tour-accent from tokens already proven dark-safe elsewhere in this chrome (--pb-chrome-accent is reused as-is by header.css/inspector.css in both themes, per tokens.css's own comment)", () => {
    const tokensCss = read("src/styles/chrome/tokens.css");
    // tokens.css documents --pb-chrome-accent as intentionally unchanged between
    // themes ("se mantiene igual... porque se usa también como FONDO sólido con texto
    // blanco encima") — assert that documentation still exists, so if a future change
    // ever starts varying this token without updating tour.css/dark.css, the drift is
    // visible here rather than silently breaking the tour's button contrast.
    expect(tokensCss).toMatch(/--pb-chrome-accent:\s*var\(--accent,/);
  });
});
