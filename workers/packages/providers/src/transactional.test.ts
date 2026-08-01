import { describe, expect, it } from 'vitest';
import { createTransactionalMailer } from './transactional';

const unconfigured = { host: '', port: 587, user: '', pass: '', secure: false, from: 'X <x@y.z>' };

describe('createTransactionalMailer', () => {
  it('no-ops with skipped=true when SMTP is unconfigured', async () => {
    const mailer = createTransactionalMailer(unconfigured);
    expect(mailer.configured).toBe(false);
    const r = await mailer.send({ to: 'a@b.c', subject: 's', html: '<p>h</p>', text: 't' });
    expect(r.accepted).toBe(false);
    expect(r.skipped).toBe(true);
  });

  it('is configured when host+user+pass are all present', () => {
    const mailer = createTransactionalMailer({
      ...unconfigured,
      host: 'smtp.mx.cloudflare.net',
      user: 'api_token',
      pass: 'secret',
    });
    expect(mailer.configured).toBe(true);
  });
});
