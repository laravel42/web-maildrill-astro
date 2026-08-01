import { config } from '@maildrill/config';
import { sendTransactionalEmail } from '@maildrill/providers';
import { createLogger } from '@maildrill/observability';

const log = createLogger({ component: 'welcome-email' });

/** Escape a user-supplied name before it goes into the HTML email body. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The sign-up welcome email (design/WelcomeEmail.html). Static apart from the
 * greeting, which uses the first name when we have one. Kept as a string here
 * so the service can send it without reaching into the frontend repo.
 */
export function welcomeEmailHtml(firstName?: string): string {
  const name = firstName?.trim() ? escapeHtml(firstName.trim()) : 'there';
  const loginUrl = `${config.app.url}/login`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Welcome to Maildrill</title>
<style>
  body{margin:0;padding:0;width:100%!important;background:#eceae3;}
  table{border-collapse:collapse;}
  a{color:#4f46e5;}
  @media (max-width:620px){
    .container{width:100%!important;}
    .px{padding-left:24px!important;padding-right:24px!important;}
    .stack{display:block!important;width:100%!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#eceae3;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">Your Maildrill workspace is live — sign in with your email and start sending.</span>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eceae3;">
    <tr>
      <td align="center" style="padding:32px 12px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="width:600px;max-width:600px;">

          <!-- Logo -->
          <tr>
            <td class="px" style="padding:4px 40px 20px;font-family:Arial,Helvetica,sans-serif;">
              <span style="font-size:20px;font-weight:bold;letter-spacing:-.02em;color:#1f1e1b;">Mail<span style="color:#ff441f;">drill</span></span>
            </td>
          </tr>

          <!-- Hero -->
          <tr>
            <td style="background:#131211;border-radius:20px 20px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="px" style="padding:44px 40px 40px;font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-family:'Courier New',Courier,monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a5a39a;">/ You're in</div>
                    <h1 style="margin:14px 0 0;font-size:34px;line-height:1.08;letter-spacing:-.02em;color:#ffffff;font-weight:bold;">Welcome to <span style="color:#ff441f;">Maildrill</span></h1>
                    <p style="margin:16px 0 0;font-size:16px;line-height:1.6;color:rgba(255,255,255,.72);">Thanks for signing up. Your account is confirmed and your workspace is live.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="px" style="padding:36px 40px 8px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#2b2a26;">Hi ${name},</p>
                    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#2b2a26;">We're thrilled to have you. Your personal workspace is set up and ready &mdash; one place for email, SMS, WhatsApp, and voice campaigns.</p>
                    <p style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#2b2a26;"><strong style="color:#1f1e1b;">Sign in any time with just your email</strong> &mdash; we'll send you a 6-digit code, no password needed.</p>
                  </td>
                </tr>

                <!-- Callout: timeline -->
                <tr>
                  <td class="px" style="padding:0 40px 8px;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f2;border:1px solid #e4e2da;border-radius:14px;">
                      <tr>
                        <td style="padding:20px 22px;font-family:Arial,Helvetica,sans-serif;">
                          <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a887f;">Your workspace</div>
                          <div style="margin-top:6px;font-size:22px;font-weight:bold;color:#1f1e1b;letter-spacing:-.01em;">Live now</div>
                          <div style="margin-top:6px;font-size:14px;line-height:1.55;color:#57554e;">Import your subscribers, build your first template, and send your first campaign &mdash; your free trial starts today.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- What's included -->
                <tr>
                  <td class="px" style="padding:26px 40px 4px;font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a887f;">Your free trial includes</div>
                  </td>
                </tr>
                <tr>
                  <td class="px" style="padding:12px 40px 4px;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="50%" class="stack" style="padding:0 8px 12px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f2;border-radius:12px;">
                            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;"><span style="font-size:20px;font-weight:bold;color:#1f1e1b;">100</span><span style="font-size:14px;color:#57554e;"> emails</span></td></tr>
                          </table>
                        </td>
                        <td width="50%" class="stack" style="padding:0 0 12px 8px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f2;border-radius:12px;">
                            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;"><span style="font-size:20px;font-weight:bold;color:#1f1e1b;">15</span><span style="font-size:14px;color:#57554e;"> SMS messages</span></td></tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" class="stack" style="padding:0 8px 4px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f2;border-radius:12px;">
                            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;"><span style="font-size:20px;font-weight:bold;color:#1f1e1b;">100</span><span style="font-size:14px;color:#57554e;"> WhatsApp messages</span></td></tr>
                          </table>
                        </td>
                        <td width="50%" class="stack" style="padding:0 0 4px 8px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f2;border-radius:12px;">
                            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;"><span style="font-size:20px;font-weight:bold;color:#1f1e1b;">60</span><span style="font-size:14px;color:#57554e;"> min voice calls</span></td></tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- CTA -->
                <tr>
                  <td class="px" style="padding:28px 40px 24px;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0;">
                      <tr>
                        <td bgcolor="#ff441f" style="border-radius:10px;">
                          <a href="${loginUrl}" style="display:block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">Open your workspace</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:0 40px 36px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0;font-size:15px;line-height:1.65;color:#57554e;">Questions? Just reply to this email or reach us at <a href="mailto:support@maildrill.net" style="color:#4f46e5;text-decoration:none;font-weight:bold;">support@maildrill.net</a>.</p>
                    <p style="margin:18px 0 0;font-size:15px;line-height:1.65;color:#2b2a26;">Talk soon,<br>The Maildrill team</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 20px 20px;border-top:1px solid #eceae3;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="px" style="padding:24px 40px 30px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#a5a39a;">You're receiving this because you signed up for Maildrill.</p>
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#a5a39a;">Maildrill, Inc. &middot; 2261 Market St, San Francisco, CA 94114 &middot; <a href="https://maildrill.net" style="color:#a5a39a;text-decoration:underline;">maildrill.net</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/** Plain-text fallback for clients that don't render HTML. */
function welcomeEmailText(firstName?: string): string {
  const name = firstName?.trim() || 'there';
  return (
    `Welcome to Maildrill\n\n` +
    `Hi ${name},\n\n` +
    `Thanks for signing up — your account is confirmed and your workspace is live. ` +
    `Sign in any time with just your email — we'll send you a 6-digit code, no ` +
    `password needed.\n\n` +
    `Your free trial includes 100 emails, 15 SMS messages, 100 WhatsApp messages and ` +
    `60 minutes of voice calls.\n\n` +
    `Open your workspace: ${config.app.url}/login\n\n` +
    `Questions? Reply to this email or reach us at support@maildrill.net.\n\n` +
    `Talk soon,\nThe Maildrill team`
  );
}

/**
 * Send the sign-up welcome email. Transactional — rides the Cloudflare relay
 * (never Infobip / the campaign pipeline), the same path as the login code.
 * Returns whether the relay accepted it; never throws.
 */
export async function sendWelcomeEmail(email: string, firstName?: string): Promise<boolean> {
  const to = email.trim().toLowerCase();
  try {
    const result = await sendTransactionalEmail({
      to,
      subject: 'Welcome to Maildrill',
      html: welcomeEmailHtml(firstName),
      text: welcomeEmailText(firstName),
    });
    if (result.accepted) {
      log.info({ email: to }, 'welcome email sent (cloudflare relay)');
    } else if (result.skipped) {
      log.warn({ email: to }, 'SMTP not configured — welcome email skipped');
    } else {
      log.error({ email: to, error: result.error }, 'welcome email send FAILED');
    }
    return result.accepted;
  } catch (err) {
    log.error({ email: to, err }, 'welcome email send threw');
    return false;
  }
}
