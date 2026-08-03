import { describe, expect, it } from 'vitest';
import {
  amrLabel,
  deviceIcon,
  deviceLine,
  eventIsAlert,
  eventLabel,
  formatRelative,
  passkeySyncLabel,
  recoveryCodesFile,
} from '@/components/react/profile/security.logic';

describe('formatRelative', () => {
  const now = Date.parse('2026-08-03T12:00:00Z');
  it('buckets recent instants', () => {
    expect(formatRelative('2026-08-03T11:59:40Z', now)).toBe('just now');
    expect(formatRelative('2026-08-03T11:55:00Z', now)).toBe('5 min ago');
    expect(formatRelative('2026-08-03T09:00:00Z', now)).toBe('3 hr ago');
    expect(formatRelative('2026-08-01T12:00:00Z', now)).toBe('2 days ago');
  });
  it('falls back to a date for old instants and dashes for null', () => {
    // Midday so the rendered calendar date is 2026-01-01 in any UTC±12 zone.
    expect(formatRelative('2026-01-01T12:00:00Z', now)).toMatch(/2026/);
    expect(formatRelative(null, now)).toBe('—');
  });
});

describe('amrLabel', () => {
  it('names the method sets', () => {
    expect(amrLabel(['webauthn'])).toBe('Passkey');
    expect(amrLabel(['code', 'totp'])).toBe('Email code + authenticator');
    expect(amrLabel(['code', 'recovery'])).toBe('Email code + recovery code');
    expect(amrLabel(['code', 'trusted_device'])).toBe('Email code · trusted device');
    expect(amrLabel(['code'])).toBe('Email code');
    expect(amrLabel(null)).toBe('Email code');
  });
});

describe('event presentation', () => {
  it('labels login events by method', () => {
    expect(eventLabel({ type: 'login_completed', metadata: { method: 'passkey' } })).toBe(
      'Signed in with a passkey',
    );
    expect(eventLabel({ type: 'login_completed', metadata: { method: 'code+totp' } })).toBe(
      'Signed in with email code + authenticator',
    );
    expect(eventLabel({ type: 'login_completed', metadata: {} })).toBe(
      'Signed in with an email code',
    );
  });
  it('labels known events and degrades unknown ones', () => {
    expect(eventLabel({ type: 'passkey_registered', metadata: {} })).toBe('Passkey added');
    expect(eventLabel({ type: 'brand_new_event', metadata: {} })).toBe('brand new event');
  });
  it('flags failure events as alerts', () => {
    expect(eventIsAlert('failed_second_factor')).toBe(true);
    expect(eventIsAlert('passkey_login_failed')).toBe(true);
    expect(eventIsAlert('reauth_failed')).toBe(true);
    expect(eventIsAlert('login_completed')).toBe(false);
  });
});

describe('device presentation', () => {
  it('picks icons by device type', () => {
    expect(deviceIcon('mobile')).toBe('smartphone');
    expect(deviceIcon('tablet')).toBe('smartphone');
    expect(deviceIcon('desktop')).toBe('monitor');
    expect(deviceIcon(null)).toBe('monitor');
  });
  it('joins browser and os', () => {
    expect(deviceLine('Chrome', 'macOS')).toBe('Chrome on macOS');
    expect(deviceLine('Chrome', null)).toBe('Chrome');
    expect(deviceLine(null, null)).toBe('Unknown device');
  });
  it('describes passkey sync state', () => {
    expect(passkeySyncLabel('multiDevice', true)).toBe('Synced');
    expect(passkeySyncLabel('multiDevice', false)).toBe('Device-bound');
    expect(passkeySyncLabel('singleDevice', false)).toBe('Device-bound');
  });
});

describe('recoveryCodesFile', () => {
  it('includes account, codes, and the one-time warning', () => {
    const text = recoveryCodesFile(['AB12-CD34', 'EF56-GH78'], 'user@example.com');
    expect(text).toContain('Account: user@example.com');
    expect(text).toContain('AB12-CD34');
    expect(text).toContain('EF56-GH78');
    expect(text).toContain('will not be shown again');
  });
  it('omits the account line when unknown', () => {
    expect(recoveryCodesFile(['AB12-CD34'], null)).not.toContain('Account:');
  });
});
