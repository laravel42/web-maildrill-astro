import type { IconName } from '@/lib/icons';

/**
 * Pure presentation logic for the Profile security surfaces — API payload
 * types, label/icon mapping, and time formatting. Kept UI-free so it can be
 * unit-tested under the node vitest config.
 */

export interface PasskeyInfo {
  id: string;
  name: string;
  deviceType: string;
  backedUp: boolean;
  transports: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

export interface SecurityOverview {
  totp: { enabled: boolean; enabledAt: string | null; recoveryCodesRemaining: number };
  passkeys: PasskeyInfo[];
  elevated: boolean;
}

export interface SessionInfo {
  id: string;
  current: boolean;
  amr: string[];
  browser: string | null;
  os: string | null;
  deviceType: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
}

export interface TrustedDeviceInfo {
  id: string;
  current: boolean;
  name: string;
  browser: string | null;
  os: string | null;
  ip: string | null;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
}

export interface SecurityEventInfo {
  id: string;
  type: string;
  sessionId: string | null;
  ip: string | null;
  userAgent: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/** "just now" / "5 min ago" / "3 hr ago" / "2 days ago" / a date. */
export function formatRelative(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const diff = nowMs - then;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
  if (diff < 14 * 86_400_000) return `${Math.floor(diff / 86_400_000)} days ago`;
  return formatDate(iso);
}

/** Human label for a session's auth-method set. */
export function amrLabel(amr: readonly string[] | null | undefined): string {
  if (!amr || amr.length === 0) return 'Email code';
  if (amr.includes('webauthn')) return 'Passkey';
  if (amr.includes('totp')) return 'Email code + authenticator';
  if (amr.includes('recovery')) return 'Email code + recovery code';
  if (amr.includes('trusted_device')) return 'Email code · trusted device';
  return 'Email code';
}

/** "Synced" (cloud-backed, e.g. iCloud Keychain) vs device-bound key. */
export function passkeySyncLabel(deviceType: string, backedUp: boolean): string {
  return deviceType === 'multiDevice' && backedUp ? 'Synced' : 'Device-bound';
}

export function deviceIcon(deviceType: string | null): IconName {
  return deviceType === 'mobile' || deviceType === 'tablet' ? 'smartphone' : 'monitor';
}

/** Device line like "Chrome on macOS" from whatever parts exist. */
export function deviceLine(browser: string | null, os: string | null): string {
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? 'Unknown device';
}

const EVENT_LABELS: Record<string, string> = {
  magic_link_requested: 'Sign-in code requested',
  login_completed: 'Signed in',
  failed_second_factor: 'Failed two-factor attempt',
  passkey_registered: 'Passkey added',
  passkey_renamed: 'Passkey renamed',
  passkey_removed: 'Passkey removed',
  passkey_login_failed: 'Passkey verification rejected',
  totp_setup_started: 'Authenticator setup started',
  totp_enabled: 'Authenticator enabled',
  totp_disabled: 'Authenticator disabled',
  recovery_codes_generated: 'Recovery codes generated',
  recovery_code_used: 'Recovery code used',
  recovery_codes_regenerated: 'Recovery codes regenerated',
  trusted_device_added: 'Device trusted',
  trusted_device_revoked: 'Trusted device revoked',
  trusted_devices_revoked_others: 'Other trusted devices revoked',
  session_revoked: 'Session signed out',
  sessions_revoked_others: 'Other sessions signed out',
  sessions_revoked_all: 'Signed out everywhere',
  reauth_succeeded: 'Identity re-confirmed',
  reauth_failed: 'Failed identity check',
};

export function eventLabel(event: Pick<SecurityEventInfo, 'type' | 'metadata'>): string {
  const base = EVENT_LABELS[event.type];
  if (!base) return event.type.replace(/_/g, ' ');
  if (event.type === 'login_completed') {
    const method = event.metadata.method;
    if (method === 'passkey') return 'Signed in with a passkey';
    if (method === 'code+totp') return 'Signed in with email code + authenticator';
    if (method === 'code+recovery') return 'Signed in with email code + recovery code';
    return 'Signed in with an email code';
  }
  return base;
}

/** Events that deserve the alert (amber) treatment in the activity feed. */
export function eventIsAlert(type: string): boolean {
  return (
    type === 'failed_second_factor' || type === 'passkey_login_failed' || type === 'reauth_failed'
  );
}

export function eventIcon(type: string): IconName {
  if (type.startsWith('passkey')) return 'fingerprint';
  if (type.startsWith('totp') || type === 'failed_second_factor') return 'smartphone';
  if (type.startsWith('recovery')) return 'key';
  if (type.startsWith('trusted_device')) return 'monitor';
  if (type.startsWith('session')) return 'logout';
  if (type.startsWith('reauth')) return 'shield';
  if (type === 'magic_link_requested') return 'mail';
  return 'shield';
}

/** Formats the recovery codes as the downloadable .txt payload. */
export function recoveryCodesFile(codes: readonly string[], email: string | null): string {
  return [
    'Maildrill recovery codes',
    email ? `Account: ${email}` : null,
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'Each code signs you in once if you lose your authenticator.',
    'Store them somewhere safe — they will not be shown again.',
    '',
    ...codes,
    '',
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
}
