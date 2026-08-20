/**
 * Property-path resolution — adapted from Activepieces (MIT).
 *
 * Upstream: packages/server/engine/src/lib/variables/property-path.ts
 *
 * Same segment semantics and the same prototype-pollution blocklist. Upstream parses the
 * token with `jsep` (a JS expression parser) and rejects anything that is not a plain
 * member chain; here the chain is scanned directly. Maildrill's resolver accepts *only*
 * paths, so introducing a JS parser would widen exactly the surface this narrows.
 *
 * Accepted: `a`, `a.b`, `a[0]`, `a["b c"]`, `a['b'].c[1]`
 * Rejected: anything with operators, calls, or a blocked segment.
 */
const BLOCKED_SEGMENTS = new Set(['__proto__', 'constructor', 'prototype']);
const LITERAL_KEYWORDS = new Set(['undefined', 'NaN', 'Infinity']);
const IDENT_START = /[A-Za-z_$]/;
const IDENT_CHAR = /[A-Za-z0-9_$]/;

function readIdentifier(input: string, start: number): { value: string; next: number } | null {
  if (start >= input.length || !IDENT_START.test(input[start]!)) return null;
  let i = start + 1;
  while (i < input.length && IDENT_CHAR.test(input[i]!)) i += 1;
  return { value: input.slice(start, i), next: i };
}

/** `["…"]`, `['…']` or `[123]`. Escape sequences are refused rather than decoded. */
function readBracket(input: string, start: number): { value: string; next: number } | null {
  let i = start + 1;
  const quote = input[i];
  if (quote === '"' || quote === "'") {
    i += 1;
    const from = i;
    while (i < input.length && input[i] !== quote) {
      if (input[i] === '\\') return null;
      i += 1;
    }
    if (input[i] !== quote) return null;
    const value = input.slice(from, i);
    i += 1;
    if (input[i] !== ']') return null;
    return { value, next: i + 1 };
  }
  const from = i;
  while (i < input.length && input[i] !== ']') i += 1;
  if (input[i] !== ']') return null;
  const raw = input.slice(from, i).trim();
  if (!/^\d+$/.test(raw)) return null;
  return { value: raw, next: i + 1 };
}

export const propertyPath = {
  /** Segments for a plain member chain, or `null` when the token is not one. */
  parse(expression: string): string[] | null {
    const input = expression.trim();
    if (input.length === 0) return null;

    const first = readIdentifier(input, 0);
    if (!first) return null;
    if (LITERAL_KEYWORDS.has(first.value)) return null;

    const segments = [first.value];
    let i = first.next;
    while (i < input.length) {
      if (input[i] === '.') {
        const ident = readIdentifier(input, i + 1);
        if (!ident) return null;
        segments.push(ident.value);
        i = ident.next;
        continue;
      }
      if (input[i] === '[') {
        const bracket = readBracket(input, i);
        if (!bracket) return null;
        segments.push(bracket.value);
        i = bracket.next;
        continue;
      }
      return null;
    }

    if (segments.some((segment) => BLOCKED_SEGMENTS.has(segment))) return null;
    return segments;
  },

  resolveValue({ segments, scope }: { segments: string[]; scope: unknown }): unknown {
    let current: unknown = scope;
    for (const segment of segments) {
      if (current === null || current === undefined) return undefined;
      current = Reflect.get(Object(current), segment) as unknown;
    }
    return current;
  },
};
