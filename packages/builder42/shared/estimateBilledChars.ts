/**
 * Estimador puro de caracteres facturables por DeepL (docs/51 §1.6/F0).
 *
 * DeepL factura por longitud del texto FUENTE en **code points Unicode**
 * ("DeepL bills by source-text length in Unicode code points" — Estimating
 * Character Usage, verificado 2026-08-27). Los tags HTML/XML no se
 * facturan cuando el tag handling está activo, y el parámetro `context`
 * tampoco se factura — ninguno de los dos entra aquí porque este módulo
 * solo ve el texto plano de los segmentos (docs/51 §2.1), nunca HTML
 * completo salvo en el fallback `html-whole`, que se estima igual (el
 * costo de los tags es cero con `tagHandling:'html'`).
 *
 * **Por qué `[...text].length` y NO `text.length`:** `String.length` cuenta
 * unidades UTF-16, no code points. Un emoji fuera del BMP (p. ej. 👋,
 * U+1F44B) ocupa 2 unidades UTF-16 (un par surrogate) pero es 1 solo code
 * point — `text.length` lo contaría como 2 caracteres, sobreestimando el
 * costo real. El spread de string (`[...text]`) itera por code point.
 */

/** Cuenta los code points Unicode de un texto (unidad de facturación real de DeepL). */
export function countCodePoints(text: string): number {
  return [...text].length;
}

/**
 * Suma los code points de un lote de textos — el estimado que se muestra
 * al usuario ANTES de gastar cuota (docs/51 F5: "Traducir 37 segmentos ·
 * 2 480 caracteres · IT"). Se calcula 100% local, sin llamar a la API.
 */
export function estimateBilledChars(texts: string[]): number {
  return texts.reduce((sum, text) => sum + countCodePoints(text), 0);
}
