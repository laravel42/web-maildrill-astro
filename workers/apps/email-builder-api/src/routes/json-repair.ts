/**
 * Best-effort JSON repair for LLM-emitted lines.
 *
 * Two failure modes show up in practice and each has its own strategy below:
 *
 *  1. **Missing closing braces** at the end of a long nested object — most
 *     often Image blocks with the `_unsplash` metadata sub-object. The
 *     strategy is to count `{` vs `}` outside of string literals and append
 *     up to 4 closing braces.
 *
 *  2. **Unescaped double quotes inside string values** — typically inside
 *     the `props.html` of NotionText blocks where the model writes HTML
 *     attributes with literal `"` characters (e.g. `<a href="#">`) instead
 *     of escaping them as `\"`. JSON.parse closes the string at the first
 *     bare quote and chokes on the next character. The strategy is to walk
 *     the line, treat a `"` as the real string-close ONLY when the next
 *     non-whitespace char is a JSON delimiter (`,`, `}`, `]`, `:`), and
 *     escape every other inner quote in place.
 *
 * Anything still un-parseable after both strategies is returned as `null`
 * and the caller falls back to the malformed-line warning.
 */

const MAX_BRACE_REPAIR = 4;

/**
 * Walk a string and try to close it by appending `}` characters when the
 * brace depth ends positive (and within the {@link MAX_BRACE_REPAIR} cap).
 * Returns the repaired line on success, `null` otherwise.
 *
 * Handles escaped quotes (`\"`) and skips bracket counting inside string
 * literals so braces in payloads like `"value with } inside"` aren't
 * counted.
 */
function balanceBraces(line: string): string | null {
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (const ch of line) {
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
  }
  if (depth <= 0 || depth > MAX_BRACE_REPAIR) return null;
  const repaired = line + '}'.repeat(depth);
  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    return null;
  }
}

/**
 * Re-escape unescaped double quotes inside JSON string literals. Used to
 * salvage NDJSON lines like:
 *
 *   `{"props":{"html":"<a href="#" style="color:red">x</a>"}}`
 *
 * The walk distinguishes the *real* string-close `"` from inner literal
 * quotes by peeking the next non-whitespace character: a real close is
 * followed by a JSON delimiter (`,`, `}`, `]`, `:`) or end-of-input;
 * anything else (a letter, a digit, `<`, `>`, `#`, …) signals an unescaped
 * inner quote that gets rewritten to `\"`.
 *
 * Returns the rewritten string regardless of validity. Always idempotent
 * over already-valid JSON because every closing quote there satisfies the
 * delimiter check, so no inner quotes are touched. The caller validates
 * the result with `JSON.parse`.
 */
function escapeInnerQuotes(line: string): string {
  let out = '';
  let i = 0;
  let inString = false;

  // Characters that legitimately follow the close of a JSON string value
  // (or string key, in which case the next non-WS char is `:`).
  const isStringTerminatorFollower = (ch: string | undefined): boolean => {
    if (ch === undefined) return true;
    return ch === ',' || ch === '}' || ch === ']' || ch === ':' || ch === '\n' || ch === '\r';
  };

  while (i < line.length) {
    const ch = line[i];

    if (!inString) {
      out += ch;
      if (ch === '"') {
        inString = true;
      }
      i++;
      continue;
    }

    // Inside a string literal — preserve escape sequences verbatim so we
    // don't double-escape `\"` or break `\\`.
    if (ch === '\\') {
      out += ch;
      if (i + 1 < line.length) {
        out += line[i + 1];
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (ch === '"') {
      // Peek next non-whitespace char.
      let j = i + 1;
      while (j < line.length && (line[j] === ' ' || line[j] === '\t')) j++;
      const next = line[j];
      if (isStringTerminatorFollower(next)) {
        // Real string close.
        out += ch;
        inString = false;
        i++;
      } else {
        // Unescaped inner quote — escape it.
        out += '\\"';
        i++;
      }
      continue;
    }

    out += ch;
    i++;
  }

  return out;
}

/**
 * Best-effort repair of an LLM-emitted NDJSON line. Tries each of the
 * strategies above (alone and in combination) and returns the first
 * variant that parses cleanly. Returns `null` when nothing works — the
 * caller surfaces it as a `malformed_line` warning.
 *
 * The cap on brace appending is a guardrail: dramatic mismatches usually
 * indicate the line is genuinely truncated mid-string, which we can't
 * repair. The unescaped-quotes pass is bounded by the line length and
 * doesn't interact with the cap.
 */
export function tryRepairJsonLine(line: string): string | null {
  // Strategy 1: brace balancing only (cheap; most repairs are this).
  const braceFixed = balanceBraces(line);
  if (braceFixed !== null) return braceFixed;

  // Strategy 2: escape inner quotes only.
  const escaped = escapeInnerQuotes(line);
  if (escaped !== line) {
    try {
      JSON.parse(escaped);
      return escaped;
    } catch {
      // Strategy 3: escape inner quotes AND balance braces.
      const combo = balanceBraces(escaped);
      if (combo !== null) return combo;
    }
  }

  return null;
}
