/**
 * Curated country metadata for the guided phone input: typical markets with
 * their international dial prefix, national-number length bounds, and display
 * grouping. Deliberately not libphonenumber — sign-up needs a friendly guide
 * and an E.164 value, not carrier-grade parsing.
 */
export interface PhoneCountry {
  /** ISO 3166-1 alpha-2, uppercase. */
  iso: string;
  name: string;
  /** International dial prefix, digits only (no `+`). */
  dial: string;
  /** Digit grouping for as-you-type display; overflow digits join the tail. */
  groups: number[];
  /** [min, max] national-number digits considered valid. */
  len: [number, number];
  /** Tie-breaker when several countries share a dial prefix (lower wins). */
  pri?: number;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'AR', name: 'Argentina', dial: '54', groups: [2, 4, 4], len: [10, 11] },
  { iso: 'AU', name: 'Australia', dial: '61', groups: [3, 3, 3], len: [9, 9] },
  { iso: 'AT', name: 'Austria', dial: '43', groups: [3, 4, 4], len: [9, 13] },
  { iso: 'BE', name: 'Belgium', dial: '32', groups: [3, 2, 2, 2], len: [8, 9] },
  { iso: 'BR', name: 'Brazil', dial: '55', groups: [2, 5, 4], len: [10, 11] },
  { iso: 'CA', name: 'Canada', dial: '1', groups: [3, 3, 4], len: [10, 10], pri: 2 },
  { iso: 'CL', name: 'Chile', dial: '56', groups: [1, 4, 4], len: [9, 9] },
  { iso: 'CO', name: 'Colombia', dial: '57', groups: [3, 3, 4], len: [10, 10] },
  { iso: 'CZ', name: 'Czechia', dial: '420', groups: [3, 3, 3], len: [9, 9] },
  { iso: 'DK', name: 'Denmark', dial: '45', groups: [2, 2, 2, 2], len: [8, 8] },
  { iso: 'FI', name: 'Finland', dial: '358', groups: [2, 3, 4], len: [9, 10] },
  { iso: 'FR', name: 'France', dial: '33', groups: [1, 2, 2, 2, 2], len: [9, 9] },
  { iso: 'DE', name: 'Germany', dial: '49', groups: [3, 4, 4], len: [10, 11] },
  { iso: 'GR', name: 'Greece', dial: '30', groups: [3, 3, 4], len: [10, 10] },
  { iso: 'HK', name: 'Hong Kong', dial: '852', groups: [4, 4], len: [8, 8] },
  { iso: 'IN', name: 'India', dial: '91', groups: [5, 5], len: [10, 10] },
  { iso: 'IE', name: 'Ireland', dial: '353', groups: [2, 3, 4], len: [9, 9] },
  { iso: 'IL', name: 'Israel', dial: '972', groups: [2, 3, 4], len: [9, 9] },
  { iso: 'IT', name: 'Italy', dial: '39', groups: [3, 3, 4], len: [9, 10] },
  { iso: 'JP', name: 'Japan', dial: '81', groups: [2, 4, 4], len: [10, 10] },
  { iso: 'MX', name: 'Mexico', dial: '52', groups: [2, 4, 4], len: [10, 10] },
  { iso: 'NL', name: 'Netherlands', dial: '31', groups: [1, 4, 4], len: [9, 9] },
  { iso: 'NZ', name: 'New Zealand', dial: '64', groups: [2, 3, 4], len: [8, 10] },
  { iso: 'NO', name: 'Norway', dial: '47', groups: [3, 2, 3], len: [8, 8] },
  { iso: 'PE', name: 'Peru', dial: '51', groups: [3, 3, 3], len: [9, 9] },
  { iso: 'PL', name: 'Poland', dial: '48', groups: [3, 3, 3], len: [9, 9] },
  { iso: 'PT', name: 'Portugal', dial: '351', groups: [3, 3, 3], len: [9, 9] },
  { iso: 'SA', name: 'Saudi Arabia', dial: '966', groups: [2, 3, 4], len: [9, 9] },
  { iso: 'SG', name: 'Singapore', dial: '65', groups: [4, 4], len: [8, 8] },
  { iso: 'ZA', name: 'South Africa', dial: '27', groups: [2, 3, 4], len: [9, 9] },
  { iso: 'KR', name: 'South Korea', dial: '82', groups: [2, 4, 4], len: [9, 10] },
  { iso: 'ES', name: 'Spain', dial: '34', groups: [3, 3, 3], len: [9, 9] },
  { iso: 'SE', name: 'Sweden', dial: '46', groups: [2, 3, 2, 2], len: [9, 9] },
  { iso: 'CH', name: 'Switzerland', dial: '41', groups: [2, 3, 2, 2], len: [9, 9] },
  { iso: 'TR', name: 'Türkiye', dial: '90', groups: [3, 3, 4], len: [10, 10] },
  { iso: 'AE', name: 'United Arab Emirates', dial: '971', groups: [2, 3, 4], len: [9, 9] },
  { iso: 'GB', name: 'United Kingdom', dial: '44', groups: [4, 6], len: [10, 10] },
  { iso: 'US', name: 'United States', dial: '1', groups: [3, 3, 4], len: [10, 10], pri: 1 },
];

const BY_ISO = new Map(PHONE_COUNTRIES.map((c) => [c.iso, c]));

export function phoneCountry(iso: string): PhoneCountry | null {
  return BY_ISO.get(iso.toUpperCase()) ?? null;
}

/** ISO code → regional-indicator emoji flag (native <option> rows, img fallback). */
export function flagEmoji(iso: string): string {
  return String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 0x1f1a5 + ch.charCodeAt(0)));
}

/**
 * Flat flag PNG (flagcdn) — the same source the template-language pickers use
 * (`templateLanguageFlagSrc`), so flags look identical across the app.
 */
export function countryFlagSrc(iso: string, size = 40): string {
  return `https://flagcdn.com/w${size}/${iso.toLowerCase()}.png`;
}

/** Group national digits for display, e.g. "3319751986" (MX) → "33 1975 1986". */
export function formatNational(digits: string, country: PhoneCountry): string {
  const parts: string[] = [];
  let i = 0;
  for (const size of country.groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + size));
    i += size;
  }
  if (i < digits.length) parts.push(digits.slice(i));
  return parts.join(' ');
}

export function maxNationalLen(country: PhoneCountry): number {
  return country.len[1];
}

/** '' when valid/empty; otherwise a user-facing problem statement. */
export function nationalLengthError(digits: string, country: PhoneCountry): string {
  if (digits.length === 0 || digits.length >= country.len[0]) return '';
  return `Enter a valid ${country.name} number (${
    country.len[0] === country.len[1] ? country.len[0] : `${country.len[0]}–${country.len[1]}`
  } digits).`;
}

export function toE164(digits: string, country: PhoneCountry): string {
  return digits ? `+${country.dial}${digits}` : '';
}

/**
 * Match a pasted/typed international number ("+523319751986", "0052 33 …")
 * to a known country. Longest dial prefix wins; shared prefixes (e.g. +1)
 * resolve by `pri`. Returns the remaining national digits.
 */
export function matchInternational(raw: string): { country: PhoneCountry; digits: string } | null {
  const cleaned = raw.replace(/[^\d+]/g, '').replace(/^00/, '+');
  if (!cleaned.startsWith('+')) return null;
  const digits = cleaned.slice(1).replace(/\D/g, '');
  for (let take = 3; take >= 1; take--) {
    const prefix = digits.slice(0, take);
    const hits = PHONE_COUNTRIES.filter((c) => c.dial === prefix);
    if (hits.length > 0) {
      const country = hits.sort((a, b) => (a.pri ?? 9) - (b.pri ?? 9))[0];
      return { country, digits: digits.slice(take) };
    }
  }
  return null;
}
