import { readFileSync } from 'node:fs';
import { createTransport } from 'nodemailer';

// Load repo-root .env without overriding real shell env.
try {
  const txt = readFileSync(new URL('.env', import.meta.url), 'utf8');
  for (const raw of txt.split('\n')) {
    const m = raw.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* no .env — rely on shell env */
}

const host = process.env.SMTP_HOST;
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const port = Number(process.env.SMTP_PORT ?? 465);
const secure =
  process.env.SMTP_SECURE != null ? process.env.SMTP_SECURE === 'true' : port === 465;

if (!host || !user || !pass) {
  console.error('✗ Need SMTP_HOST, SMTP_USER, and SMTP_PASS in .env or shell. Aborting.');
  process.exit(2);
}

const transporter = createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
});

const info = await transporter.sendMail({
  from: process.env.MAIL_FROM ?? '"Acme" <welcome@maildrill.net>',
  to: process.env.SIGNUP_NOTIFY_TO ?? 'recipient@example.com',
  subject: 'Welcome to Acme',
  text: 'Thanks for signing up.',
});

console.log('✓ Sent', info.messageId);
