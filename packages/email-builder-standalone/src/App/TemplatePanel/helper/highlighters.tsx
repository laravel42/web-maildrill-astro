import hljs from 'highlight.js';
import jsonHighlighter from 'highlight.js/lib/languages/json';
import xmlHighlighter from 'highlight.js/lib/languages/xml';
import prettierPluginBabel from 'prettier/plugins/babel';
import prettierPluginEstree from 'prettier/plugins/estree';
import prettierPluginHtml from 'prettier/plugins/html';
import { format } from 'prettier/standalone';

// Compacta los atributos de las etiquetas HTML para que queden en una sola línea
function collapseTagAttributes(input: string): string {
  let out = '';
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];
    if (ch === '<') {
      // Comentarios HTML
      if (input.startsWith('<!--', i)) {
        const end = input.indexOf('-->', i + 4);
        if (end === -1) {
          out += input.slice(i);
          break;
        }
        out += input.slice(i, end + 3);
        i = end + 3;
        continue;
      }

      // Cierre de etiqueta
      if (input.startsWith('</', i)) {
        const end = input.indexOf('>', i + 2);
        if (end === -1) {
          out += input.slice(i);
          break;
        }
        out += input.slice(i, end + 1);
        i = end + 1;
        continue;
      }

      // Apertura o self-closing
      let j = i + 1;
      let quote: '"' | "'" | null = null;
      while (j < len) {
        const cj = input[j];
        if (quote) {
          if (cj === quote) quote = null;
        } else {
          if (cj === '"' || cj === "'") quote = cj as '"' | "'";
          else if (cj === '>') break;
        }
        j++;
      }
      if (j >= len) {
        out += input.slice(i);
        break;
      }

      const segment = input.slice(i, j + 1); // incluye < ... >
      // Normalizar espacios sólo dentro de la etiqueta (excluyendo comillas)
      let k = 1; // saltamos '<'
      let inQuote: '"' | "'" | null = null;
      let prevSpace = false;
      let normalized = '<';
      while (k < segment.length - 1) {
        // hasta antes de '>'
        const c = segment[k];
        if (inQuote) {
          if (c === inQuote) inQuote = null;
          normalized += c;
        } else {
          if (c === '"' || c === "'") {
            inQuote = c as '"' | "'";
            normalized += c;
            prevSpace = false;
          } else if (c === '\n' || c === '\r' || c === '\t' || c === ' ') {
            if (!prevSpace) {
              normalized += ' ';
              prevSpace = true;
            }
          } else {
            normalized += c;
            prevSpace = false;
          }
        }
        k++;
      }
      normalized += '>';
      out += normalized;
      i = j + 1;
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

hljs.registerLanguage('json', jsonHighlighter);
hljs.registerLanguage('html', xmlHighlighter);

export async function html(value: string): Promise<string> {
  const prettyValue = await format(value, {
    parser: 'html',
    // Aumentamos el printWidth para minimizar quiebres de línea automáticos
    printWidth: 1000,
    plugins: [prettierPluginHtml],
  });
  const inlined = collapseTagAttributes(prettyValue);
  return hljs.highlight(inlined, { language: 'html' }).value;
}

export async function json(value: string): Promise<string> {
  const prettyValue = await format(value, {
    parser: 'json',
    printWidth: 0,
    trailingComma: 'all',
    plugins: [prettierPluginBabel, prettierPluginEstree],
  });
  return hljs.highlight(prettyValue, { language: 'javascript' }).value;
}
