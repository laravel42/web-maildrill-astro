import { describe, expect, it } from 'vitest';
import { mockContactSubmit, mockResetPassword, mockSignUp } from '@/lib/app/services';

describe('marketing form services', () => {
  it('accepts sign-up submissions', async () => {
    await expect(
      mockSignUp({ firstName: 'A', lastName: 'B', email: 'a@b.com', password: 'password' }),
    ).resolves.toEqual({ ok: true });
  });

  it('accepts password reset requests', async () => {
    await expect(mockResetPassword('a@b.com')).resolves.toEqual({ ok: true });
  });

  it('accepts contact submissions', async () => {
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
