/**
 * Word / token-aware search matching.
 *
 * Mid-word substrings do not match — e.g. query "two" must not hit the tag
 * "artwork" (which contains the letters t-w-o). A query matches when every
 * query token equals or prefixes some token in the haystack
 * ("art" → artwork, "street photo" → street photography).
 */

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** True if `query` matches `text` as whole words or word prefixes. */
export function matchesSearchQuery(text: string, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const hayTokens = tokens(text);
  if (hayTokens.length === 0) return false;
  const needleTokens = tokens(needle);
  if (needleTokens.length === 0) return false;
  return needleTokens.every((n) => hayTokens.some((h) => h === n || h.startsWith(n)));
}

/** True if any of the text parts matches the query. */
export function anyMatchesSearchQuery(parts: Iterable<string>, query: string): boolean {
  const needle = query.trim();
  if (!needle) return true;
  for (const part of parts) {
    if (matchesSearchQuery(part, needle)) return true;
  }
  return false;
}
