/**
 * Minimal user-agent classification for session / trusted-device rows. This is
 * display metadata only — never a trust signal — so a tiny heuristic beats a
 * parser dependency.
 */

export interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet';
}

export function parseUserAgent(ua: string | null | undefined): ParsedUserAgent {
  if (!ua) return { browser: null, os: null, deviceType: 'desktop' };

  let browser: string | null = null;
  if (/Edg(e|A|iOS)?\//.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua)) browser = 'Opera';
  else if (/Firefox\/|FxiOS\//.test(ua)) browser = 'Firefox';
  else if (/CriOS\//.test(ua)) browser = 'Chrome';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = 'Safari';

  let os: string | null = null;
  if (/Windows NT/.test(ua)) os = 'Windows';
  else if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Mac OS X/.test(ua)) os = 'macOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/CrOS/.test(ua)) os = 'ChromeOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  const deviceType: ParsedUserAgent['deviceType'] = /iPad|Android(?!.*Mobile)/.test(ua)
    ? 'tablet'
    : /Mobi|iPhone|iPod/.test(ua)
      ? 'mobile'
      : 'desktop';

  return { browser, os, deviceType };
}

/** Human label like "Chrome on macOS" for device/session rows. */
export function deviceLabel(ua: string | null | undefined): string {
  const parsed = parseUserAgent(ua);
  if (parsed.browser && parsed.os) return `${parsed.browser} on ${parsed.os}`;
  return parsed.browser ?? parsed.os ?? 'Unknown device';
}
