import { afterEach, describe, expect, it } from 'vitest';
import { messagingBaseUrl, serviceBaseUrl, v1BackendBaseUrl } from '@/lib/server/service';
import { ebBaseUrl } from '@/lib/server/eb-proxy';

const KEYS = ['API_BASE_URL', 'MESSAGING_API_BASE_URL', 'EB_API_BASE_URL'] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe('backend base URLs', () => {
  it('defaults product and messaging to localhost:3001 when unset', () => {
    expect(serviceBaseUrl()).toBe('http://localhost:3001');
    expect(messagingBaseUrl()).toBe('http://localhost:3001');
    expect(ebBaseUrl()).toBe('http://localhost:3001');
  });

  it('routes messages paths to the messaging base', () => {
    process.env.API_BASE_URL = 'http://product:3001';
    process.env.MESSAGING_API_BASE_URL = 'http://messaging:3002';
    expect(v1BackendBaseUrl('campaigns')).toBe('http://product:3001');
    expect(v1BackendBaseUrl('messages')).toBe('http://messaging:3002');
    expect(v1BackendBaseUrl('messages/abc')).toBe('http://messaging:3002');
  });

  it('uses EB_API_BASE_URL when set', () => {
    process.env.API_BASE_URL = 'http://product:3001';
    process.env.EB_API_BASE_URL = 'http://eb:3003';
    expect(ebBaseUrl()).toBe('http://eb:3003');
  });
});
