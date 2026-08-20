import { describe, expect, it } from 'vitest';
import { entityIdForTenant } from './infobip-entity';

describe('entityIdForTenant', () => {
  const tenantId = '3f0d5c2a-9b1e-4d7a-8c6f-2e5a1b4c7d90';

  it('is deterministic, so it can be recomputed for rows predating the column', () => {
    expect(entityIdForTenant(tenantId)).toBe(entityIdForTenant(tenantId));
  });

  it('distinguishes workspaces', () => {
    expect(entityIdForTenant('a')).not.toBe(entityIdForTenant('b'));
  });

  it('needs no URL encoding — Infobip uses it as a path parameter', () => {
    const id = entityIdForTenant(tenantId);
    expect(encodeURIComponent(id)).toBe(id);
  });

  it('is not one of the placeholders the provider drops', () => {
    expect(entityIdForTenant(tenantId)).not.toMatch(/^(local|test|example|changeme)$/i);
  });
});
