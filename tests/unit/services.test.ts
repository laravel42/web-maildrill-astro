import { describe, expect, it } from 'vitest';
import { listCampaigns, mockContactSubmit, mockSignIn } from '@/lib/app/services';

describe('mock app services', () => {
  it('filters campaigns by status and channel', async () => {
    const sentEmail = await listCampaigns({ status: 'sent', channel: 'email' });
    expect(sentEmail.length).toBeGreaterThan(0);
    expect(sentEmail.every((c) => c.status === 'sent' && c.channel === 'email')).toBe(true);
  });

  it('supports search queries', async () => {
    const results = await listCampaigns({ query: 'spring' });
    expect(results.some((c) => c.name.toLowerCase().includes('spring'))).toBe(true);
  });

  it('accepts placeholder auth and contact submits', async () => {
    await expect(mockSignIn('a@b.com', 'password')).resolves.toEqual({ ok: true });
    await expect(
      mockContactSubmit({
        firstName: 'A',
        lastName: 'B',
        email: 'a@b.com',
        topic: 'sales',
        message: 'Hello',
      }),
    ).resolves.toEqual({ ok: true });
  });
});
