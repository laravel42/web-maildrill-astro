import { describe, expect, it } from "vitest";
import { minifyCss } from "../src/builder/export/minify";

/**
 * minifyCss.selectors.test.ts — the CSS minifier may shrink text, never change
 * what a selector matches.
 *
 * The bug this pins: `\s*([{}:;,])\s*` → `$1` collapsed the whitespace on BOTH
 * sides of every `:`, including the descendant combinator in front of a
 * pseudo-class. `.pb-navbar__brand :where(a)` came out as
 * `.pb-navbar__brand:where(a)` — "the brand element, which is also an `<a>`" —
 * a selector that never matches, so the rule went silently dead in all 18
 * exported template sites. Found while giving the `pizzeria-page` navbar its
 * pill chips: the chips' own font-size and colour only apply because that rule
 * is a `:where()` at specificity 0,1,0, and the dead selector made the
 * behaviour look correct for the wrong reason.
 */
describe("minifyCss", () => {
  it("keeps the descendant space in front of a pseudo-class", () => {
    expect(minifyCss(".a :where(b) { color: red; }")).toBe(".a :where(b){color:red}");
    expect(minifyCss(".a :hover { color: red; }")).toBe(".a :hover{color:red}");
    expect(minifyCss("div :first-child { margin: 0; }")).toBe("div :first-child{margin:0}");
  });

  it("still joins a pseudo-class to its own subject", () => {
    expect(minifyCss(".a:hover { color: red; }")).toBe(".a:hover{color:red}");
    expect(minifyCss("a:focus-visible { outline: 2px solid red; }")).toBe("a:focus-visible{outline:2px solid red}");
  });

  it("still strips the space after a declaration colon and inside media queries", () => {
    expect(minifyCss("p { color: red; font-size: 12px; }")).toBe("p{color:red;font-size:12px}");
    expect(minifyCss("@media (max-width: 767px) { p { margin: 0; } }")).toBe("@media (max-width:767px){p{margin:0}}");
  });

  it("drops comments and collapses runs of whitespace", () => {
    expect(minifyCss("/* note */\n.a,\n.b {\n  color:  red;\n}")).toBe(".a,.b{color:red}");
  });
});
