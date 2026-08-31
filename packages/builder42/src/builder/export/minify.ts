/** Minify (docs/07 §8) — solo formateo de texto al final de la pipeline. */

export function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

export function minifyHtml(html: string): string {
  return html
    .replace(/>\s+</g, "><")
    .replace(/\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
