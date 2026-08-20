import type { SelectOption } from '@/components/react/shared/SearchableSelect';

/**
 * IANA timezones for the profile picker. The list comes from the runtime
 * (`Intl.supportedValuesOf`) rather than a bundled table, so it tracks the
 * platform's tzdata instead of going stale — with a small fallback for engines
 * that lack the API.
 */

const FALLBACK_ZONES = [
  'UTC',
  'Europe/London',
  'Europe/Rome',
  'Europe/Berlin',
  'Europe/Madrid',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export function listTimeZones(): string[] {
  const supported = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] })
    .supportedValuesOf;
  try {
    const zones = supported?.('timeZone');
    if (zones && zones.length > 0) return zones;
  } catch {
    /* fall through */
  }
  return FALLBACK_ZONES;
}

/** "GMT+2" / "GMT-5:30" for a zone right now (DST-aware, hence computed live). */
export function zoneOffsetLabel(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'shortOffset',
    }).formatToParts(new Date());
    const name = parts.find((p) => p.type === 'timeZoneName')?.value;
    return name ?? '';
  } catch {
    return '';
  }
}

/** The browser's own zone, used as the default for a profile that has none. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Accepts what is actually stored on existing profiles. Values were once
 * display strings like "Europe/Rome (GMT+2)"; strip the parenthetical so those
 * accounts keep their zone instead of silently resetting.
 */
export function normalizeTimeZone(raw: string): string {
  const value = raw.trim().replace(/\s*\(.*\)\s*$/, '');
  if (!value) return '';
  const zones = listTimeZones();
  if (zones.includes(value)) return value;
  // Case-insensitive rescue ("europe/rome").
  const match = zones.find((z) => z.toLowerCase() === value.toLowerCase());
  return match ?? '';
}

/** Options for SearchableSelect: "Europe/Rome" + a live GMT offset. */
export function timeZoneOptions(): SelectOption[] {
  return listTimeZones().map((zone) => ({
    value: zone,
    label: zone.replace(/_/g, ' '),
    hint: zoneOffsetLabel(zone),
    // Searching "rome" or "gmt+2" should both work.
    keywords: zone,
  }));
}
