/** Minify (docs/07 §8) — solo formateo de texto al final de la pipeline. */

export function minifyCss(css: string): string {
  return (
    css
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\s+/g, " ")
      // `:` se trata aparte de `{};,`: colapsar el espacio que lo PRECEDE
      // cambia el significado de un selector, no solo su tamaño.
      // `.pb-navbar__brand :where(a)` (descendiente que además es `a`) se
      // convertía en `.pb-navbar__brand:where(a)` (el propio brand siendo un
      // `a`), un selector que no acierta nunca — la regla quedaba muerta sin
      // que nada fallara. Lo mismo valía para cualquier `.x :hover`,
      // `.x :is(...)` o `div :first-child`. Solo el espacio POSTERIOR es
      // seguro de quitar (`color: red` → `color:red`, `(max-width: 40em)` →
      // `(max-width:40em)`).
      .replace(/\s*([{};,])\s*/g, "$1")
      .replace(/:\s+/g, ":")
      .replace(/;}/g, "}")
      .trim()
  );
}

export function minifyHtml(html: string): string {
  return html
    .replace(/>\s+</g, "><")
    .replace(/\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}
