import nodemailer, { type Transporter } from 'nodemailer';

/**
 * In-repo email sending over SMTP (Nodemailer → Cloudflare Email Service
 * relay). Only the internal sign-up notification lives here — the user-facing
 * welcome email is sent by workers when the first verified code creates the
 * account.
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
  // Must match the authenticated SMTP mailbox (e.g. forwardemail.net rejects a
  // mismatched From with 550) — the domain is maildrill.net.
  return process.env.MAIL_FROM ?? 'Maildrill <hello@maildrill.net>';
}

/** Escape user-supplied values before they go into the notification HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SignupData {
  email: string;
  firstName?: string;
  lastName?: string;
}

/**
 * Notify the team of a new sign-up, with the subscriber's details. Sent to
 * SIGNUP_NOTIFY_TO (default hello@laravel42.com); reply-to is the subscriber so
 * a reply reaches them directly. Never throws.
 */
export async function sendSignupNotification(sub: SignupData): Promise<boolean> {
  const to = process.env.SIGNUP_NOTIFY_TO ?? 'hello@laravel42.com';
  const transport = getTransport();
  if (!transport) {
    console.warn('[mail] SMTP not configured — skipping signup notification');
    return false;
  }
  const email = sub.email.trim();
  const name =
    [sub.firstName, sub.lastName]
      .map((v) => v?.trim())
      .filter(Boolean)
      .join(' ') || '—';
  const rows: [string, string][] = [
    ['Name', name],
    ['Email', email],
  ];
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#1f1e1b;">` +
    `<h2 style="margin:0 0 12px;font-size:18px;">New Maildrill sign-up</h2>` +
    `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">` +
    rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:4px 16px 4px 0;color:#57554e;">${k}</td>` +
          `<td style="padding:4px 0;font-weight:600;">${esc(v)}</td></tr>`,
      )
      .join('') +
    `</table></div>`;
  const text = `New Maildrill sign-up\n\nName: ${name}\nEmail: ${email}\n`;
  try {
    await transport.sendMail({
      from: mailFrom(),
      to,
      replyTo: email,
      subject: `New sign-up: ${email}`,
      html,
      text,
    });
    console.info('[mail] signup notification sent for', email);
    return true;
  } catch (err) {
    console.error('[mail] signup notification failed for', email, err);
    return false;
  }
}
