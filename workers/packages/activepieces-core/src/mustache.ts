/**
 * Mustache tokenizing — adapted from Activepieces (MIT).
 *
 * Upstream: packages/core/utils/src/lib/mustache-utils.ts and object-utils.ts.
 *
 * Brace counting rather than a regex: `/\{\{(.*?)\}\}/` stops at the first `}}`, which
 * truncates tokens containing nested braces. `inner` is deliberately NOT trimmed — callers
 * that treat it as a variable name trim it themselves.
 */
export interface MustacheToken {
  token: string;
  inner: string;
  index: number;
}

export function extractMustacheTokens(input: string): MustacheToken[] {
  const results: MustacheToken[] = [];
  let i = 0;
  while (i < input.length - 1) {
    if (input[i] === '{' && input[i + 1] === '{') {
      const start = i;
      let depth = 1;
      i += 2;
      while (i < input.length - 1 && depth > 0) {
        if (input[i] === '{' && input[i + 1] === '{') {
          depth += 1;
          i += 2;
        } else if (input[i] === '}' && input[i + 1] === '}') {
          depth -= 1;
          i += 2;
        } else {
          i += 1;
        }
      }
      if (depth === 0) {
        const token = input.slice(start, i);
        results.push({ token, inner: token.slice(2, -2), index: start });
      }
    } else {
      i += 1;
    }
  }
  return results;
}

/** Walk every string leaf of a JSON-ish value, replacing it with `apply`'s result. */
export function applyToStringLeaves<T>(value: unknown, apply: (str: string) => unknown): T {
  if (value === null || value === undefined) return value as T;
  if (typeof value === 'string') return apply(value) as T;
  if (Array.isArray(value)) return value.map((item) => applyToStringLeaves(item, apply)) as T;
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        applyToStringLeaves(v, apply),
      ]),
    ) as T;
  }
  return value as T;
}
