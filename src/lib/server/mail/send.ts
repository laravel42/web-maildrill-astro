import nodemailer, { type Transporter } from 'nodemailer';
import { welcomeEmailHtml, welcomeEmailText } from './welcome-template';

/**
 * Temporary in-repo email sending over SMTP (Nodemailer), so sign-up can send
 * the welcome email without maildrill-service running.
 *
 * Config comes from server-only env (never PUBLIC_*):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE?, MAIL_FROM
 *
 * When SMTP isn't configured the sender no-ops (logs a warning) so the sign-up
 * flow still works in dev without credentials.
 */

let cached: Transporter | null = null;

function getTransport(): Transporter | null {
  if (cached) return cached;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  // 465 is implicit TLS; 587/25 use STARTTLS. Allow an explicit override.
  const secure =
    process.env.SMTP_SECURE != null ? process.env.SMTP_SECURE === 'true' : port === 465;

  cached = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });
  return cached;
}

/** Address emails are sent from; falls back to a sensible default. */
function mailFrom(): string {
  return process.env.MAIL_FROM ?? 'Maildrill <hello@maildrill.com>';
}

/**
 * Send the sign-up welcome email. Never throws — returns whether SMTP accepted
 * it, so the caller can log without letting a mail hiccup break the request.
 */
export async function sendWelcomeEmail(email: string, firstName?: string): Promise<boolean> {
  const to = email.trim();
  const transport = getTransport();
  if (!transport) {
    console.warn('[mail] SMTP not configured — skipping welcome email to', to);
    return false;
  }
  try {
    await transport.sendMail({
      from: mailFrom(),
      to,
      subject: 'Welcome to Maildrill',
      html: welcomeEmailHtml(firstName),
      text: welcomeEmailText(firstName),
    });
    console.info('[mail] welcome email sent to', to);
    return true;
  } catch (err) {
    console.error('[mail] welcome email send failed for', to, err);
    return false;
  }
}
