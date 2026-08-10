import { describe, expect, it } from 'vitest';
import { resolvePlatformFields } from './infobip';

const APP = 'default';

describe('resolvePlatformFields', () => {
  it("prefers the workspace's entity over the account-wide default", () => {
    expect(resolvePlatformFields(APP, 'account-entity', 'ws-abc')).toEqual({
      applicationId: APP,
      entityId: 'ws-abc',
    });
  });

  it('falls back to the configured entity for workspaces without one', () => {
    expect(resolvePlatformFields(APP, 'account-entity', undefined)).toEqual({
      applicationId: APP,
      entityId: 'account-entity',
    });
    // An empty tenant value is "unset", not "send an empty entity".
    expect(resolvePlatformFields(APP, 'account-entity', '  ')).toEqual({
      applicationId: APP,
      entityId: 'account-entity',
    });
  });

  it('drops .env placeholders rather than sending them', () => {
    for (const placeholder of ['local', 'TEST', 'example', 'changeme']) {
      expect(resolvePlatformFields(APP, placeholder)).toEqual({ applicationId: APP });
    }
  });

  it('omits absent values instead of sending empty strings', () => {
    expect(resolvePlatformFields('', '')).toEqual({});
    expect(resolvePlatformFields('  ', '', 'ws-abc')).toEqual({ entityId: 'ws-abc' });
  });

  it('still tags the workspace when the account has no default entity', () => {
    expect(resolvePlatformFields(APP, '', 'ws-abc')).toEqual({
      applicationId: APP,
      entityId: 'ws-abc',
    });
  });
});
