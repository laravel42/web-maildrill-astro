/**
 * Helper para formatear el HTML del NotionText
 * Aplica estilos globales de links al HTML generado por Tiptap
 */

const htmlCache = new Map<string, string>();

/**
 * Normaliza HTML legado (Quill / bloques antiguos) para evitar
 * estructuras inválidas como <p><p>...</p></p> que rompen el render.
 *
 * La idea es aplanar párrafos anidados sin tocar el HTML moderno
 * generado por Tiptap (que ya es válido).
 */
export function normalizeNotionTextHtml(html: string): string {
  if (!html) return html;

  // `DOMParser` is a browser API. In a Node render (the Node-safe HTML
  // renderer / MCP) it is unavailable — skip the legacy nested-<p>
  // flattening, which only fixes old Quill content. Modern Tiptap HTML
  // is already valid, so returning it unchanged is safe.
  if (typeof DOMParser === 'undefined') return html;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  // Flatten nested <p> elements (up to 5 passes for multiple nesting levels)
  for (let pass = 0; pass < 5; pass++) {
    let changed = false;
    const paragraphs = Array.from(body.querySelectorAll('p'));
    for (const outer of paragraphs) {
      const innerPs = Array.from(outer.children).filter((c) => c.tagName === 'P');
      if (innerPs.length === 0) continue;
      changed = true;
      const outerAttrs = outer.getAttribute('style');
      // If all children are <p>, unwrap: apply outer style to first inner <p> if it has none
      if (innerPs.length === outer.childNodes.length || innerPs.length > 0) {
        if (outerAttrs && innerPs[0] && !innerPs[0].getAttribute('style')) {
          innerPs[0].setAttribute('style', outerAttrs);
        }
        outer.replaceWith(...Array.from(outer.childNodes));
      }
    }
    if (!changed) break;
  }

  // Remove duplicate </p></p> artifacts (text nodes between block elements)
  return body.innerHTML;
}

/**
 * Formatea el HTML del editor Tiptap aplicando estilos globales de links
 */
export function getFormattedHtmlCached(
  blockId: string,
  html: string,
  linkGlobal?: { linkColor?: string; underline?: boolean } | null,
  blockStyles?: {
    fontFamily?: string;
    fontSize?: string;
    color?: string;
    fontWeight?: string;
    lineHeight?: string;
  }
): string {
  // Proteger contra html null/undefined — evita TypeError en .replace()
  if (!html) return html ?? '';

  // Normalizar primero el HTML (manejo de <p> anidados legacy)
  const normalizedHtml = normalizeNotionTextHtml(html);

  const cacheKey = `${blockId}-${normalizedHtml}-${JSON.stringify(linkGlobal)}-${JSON.stringify(blockStyles)}`;

  if (htmlCache.has(cacheKey)) {
    return htmlCache.get(cacheKey)!;
  }

  let formattedHtml = normalizedHtml;

  // Preservar párrafos vacíos agregando <br> si están completamente vacíos
  // Esto evita que los saltos de línea en blanco se eliminen
  // Matches both <p></p> and <p style="...""></p> (with any attributes)
  formattedHtml = formattedHtml.replace(/<p(\s[^>]*)?><\/p>/g, '<p$1><br></p>');

  // Aplicar estilos globales de links si están definidos
  if (linkGlobal) {
    const linkColor = linkGlobal.linkColor;
    const underline = linkGlobal.underline;

    if (linkColor || underline !== undefined) {
      // Reemplazar todos los <a> tags con los estilos globales
      formattedHtml = formattedHtml.replace(/<a\s([^>]*)>/gi, (match, attributes) => {
        // Verificar si ya tiene un atributo style
        const styleMatch = /style\s*=\s*["']([^"']*)["']/i.exec(attributes);
        const existingStyles = styleMatch ? styleMatch[1] : '';

        // Verificar si ya tiene color o text-decoration definidos inline
        const hasInlineColor = /color\s*:/i.test(existingStyles);
        const hasInlineDecoration = /text-decoration\s*:/i.test(existingStyles);

        const styles: string[] = [];

        // Solo aplicar color global si no hay color inline
        if (linkColor && !hasInlineColor) {
          styles.push(`color: ${linkColor}`);
        }

        // Solo aplicar underline global si no hay text-decoration inline
        if (underline !== undefined && !hasInlineDecoration) {
          styles.push(`text-decoration: ${underline ? 'underline' : 'none'}`);
        }

        // Si no hay estilos globales que aplicar, retornar el match original
        if (styles.length === 0) {
          return match;
        }

        if (styleMatch) {
          // Agregar a los estilos existentes
          return match.replace(/style\s*=\s*["']([^"']*)["']/i, (_styleMatch, existingStylesInner) => {
            const newStyles = existingStylesInner ? `${existingStylesInner}; ${styles.join('; ')}` : styles.join('; ');
            return `style="${newStyles}"`;
          });
        } else {
          // Agregar nuevo atributo style
          return `<a ${attributes} style="${styles.join('; ')}">`;
        }
      });
    }
  }

  // Propagar color de <span> hijo al <a> padre para que el underline coincida.
  // Tiptap genera <a><span style="color: X">texto</span></a> al colorear un link;
  // sin esto, el underline usa el color del <a> (global) y no el del <span>.
  formattedHtml = formattedHtml.replace(
    /(<a\s+)([^>=]*(?:="[^"]*"[^>=]*)*)(>)([\s\S]*?)(<\/a>)/gi,
    (_match, aOpen, aAttrs, gt, content, aEnd) => {
      const spanMatch = /<span\s+style="([^"]*)"/.exec(content);
      if (!spanMatch) return _match;

      const spanStyle = spanMatch[1];
      const colorMatch = /(?:^|;\s*)color:\s*([^;"]+)/i.exec(spanStyle);
      if (!colorMatch) return _match;

      const spanColor = colorMatch[1].trim();
      const aStyleMatch = /style\s*=\s*["']([^"']*)["']/i.exec(aAttrs);

      let newAAttrs: string;
      if (aStyleMatch) {
        const existing = aStyleMatch[1];
        if (/(?:^|;\s*)color\s*:/i.test(existing)) {
          const updated = existing.replace(/(^|;\s*)color:\s*[^;"]+/i, `$1color: ${spanColor}`);
          newAAttrs = aAttrs.replace(/style\s*=\s*["'][^"']*["']/i, `style="${updated}"`);
        } else {
          newAAttrs = aAttrs.replace(
            /style\s*=\s*["']([^"']*)["']/i,
            (_: string, s: string) => `style="${s}; color: ${spanColor}"`
          );
        }
      } else {
        newAAttrs = `${aAttrs} style="color: ${spanColor}"`;
      }

      return `${aOpen}${newAAttrs}${gt}${content}${aEnd}`;
    }
  );

  // Limitar el tamaño del cache
  if (htmlCache.size > 100) {
    const firstKey = htmlCache.keys().next().value;
    if (firstKey) {
      htmlCache.delete(firstKey);
    }
  }

  htmlCache.set(cacheKey, formattedHtml);
  return formattedHtml;
}

/**
 * Limpia el cache de HTML formateado
 */
export function clearHtmlCache(): void {
  htmlCache.clear();
}
