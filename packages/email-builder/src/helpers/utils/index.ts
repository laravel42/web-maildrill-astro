/**
 * Updates only hex code in background string
 * @param value
 * @param newHex
 */
export const updateHexColorInBackgroundString = (value: string, newHex: string) => {
  const hexRegex = /#([0-9a-fA-F]{3,6})\b/;
  if (hexRegex.test(value)) {
    return value.replace(hexRegex, newHex);
  }
  if (value.trim() === '') {
    return newHex;
  }
  return value.replace(/^(\S+)/, `$1 ${newHex}`);
};

export function getRoundedCorners(style: any) {
  const shape = style?.shape ?? 'rectangle';

  if (typeof shape === 'string') {
    switch (shape) {
      case 'rectangle':
        return undefined;
      case 'pill':
        return 9999; // Very large value for pill shape
      default:
        return undefined;
    }
  } else if (typeof shape === 'object' && shape !== null) {
    const { topLeft = 0, topRight = 0, bottomLeft = 0, bottomRight = 0 } = shape;
    // CSS 4-value shorthand: top-left top-right bottom-right bottom-left
    return `${topLeft}px ${topRight}px ${bottomRight}px ${bottomLeft}px`;
  }

  return undefined;
}

export function getProperties(html: string, property: string) {
  // Expresión regular para capturar valores de la propiedad indicada
  const regex = new RegExp(`${property}\\s*:\\s*([^;"']+)`, 'gi');
  const resultados = [];
  let match;

  while ((match = regex.exec(html)) !== null) {
    resultados.push(match[1].trim());
  }

  return resultados;
}

//This function is very important to preserve the spaces in Quill editor
export function preserveWhiteSpace(value: string): string {
  const domParser = new DOMParser();
  const doc = domParser.parseFromString(value, 'text/html');

  doc.body.querySelectorAll('*').forEach((el) => {
    el.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        let text = child.textContent ?? '';
        text = text.replace(/ {2,}/g, (spaces) => '&nbsp;'.repeat(spaces.length - 1) + ' ');
        const span = document.createElement('span');
        span.innerHTML = text;
        el.replaceChild(span.firstChild!, child);
      }
    });
  });

  return doc.body.innerHTML;
}

// Deterministic short id for CSS class/ids: FNV-1a 32-bit + base62
function fnv1a32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // 32-bit FNV-1a prime: 16777619
    h = (h >>> 0) * 0x01000193;
  }
  return h >>> 0;
}

function toBase62(num: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  if (num === 0) return 'a';
  let s = '';
  while (num > 0) {
    s = chars[num % 62] + s;
    num = Math.floor(num / 62);
  }
  return s;
}

/**
 * Converts a potentially long block id into a short, stable token suitable
 * for CSS classes/ids. Always starts with a letter.
 */
export function shortCssId(input: string): string {
  const hash = fnv1a32(input);
  const encoded = toBase62(hash);
  // Prefix with a letter to ensure valid CSS identifier start
  return `b${encoded}`;
}
