/**
 * Registration waitlist email (design/RegistrationWaitlistEmail.html). Sent on
 * every sign-up while the rollout period is active. Static apart from the
 * greeting, which uses the first name when we have one; the trial quotas are
 * filled from the constants below.
 */

/** Trial quotas shown in the "your free trial includes" tiles. */
const TRIAL = {
  emails: 100,
  sms: 15,
  whatsapp: 100,
  voiceMinutes: 60,
} as const;

/** Escape a user-supplied name before it goes into the HTML email body. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function waitlistEmailHtml(firstName?: string): string {
  const name = firstName?.trim() ? escapeHtml(firstName.trim()) : 'there';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>You're on the Maildrill waiting list</title>
<style>
  body{margin:0;padding:0;width:100%!important;background:#eceae3;}
  table{border-collapse:collapse;}
  a{color:#4f46e5;}
  @media (max-width:620px){
    .container{width:100%!important;}
    .px{padding-left:24px!important;padding-right:24px!important;}
    .stack{display:block!important;width:100%!important;padding-left:0!important;padding-right:0!important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#eceae3;">
  <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">You're on the list &mdash; your Maildrill workspace is being provisioned and will be ready within 7 days, likely sooner.</span>

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
            <td width="600" style="background:#131211;border-radius:20px 20px 0 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="px" style="padding:44px 40px 40px;font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-family:'Courier New',Courier,monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#a5a39a;">/ You're on the list</div>
                    <h1 style="margin:14px 0 0;font-size:32px;line-height:1.1;mso-line-height-rule:exactly;letter-spacing:-.02em;color:#ffffff;font-weight:bold;">Welcome to <span style="color:#ff441f;">Maildrill</span></h1>
                    <p style="margin:16px 0 0;font-size:15px;line-height:1.6;mso-line-height-rule:exactly;color:rgba(255,255,255,.68);">Thanks for signing up. Your account is confirmed and your seat is reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td width="600" style="background:#ffffff;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">

                <tr>
                  <td class="px" style="padding:34px 40px 0;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 18px;font-size:16px;line-height:1.65;mso-line-height-rule:exactly;color:#2b2a26;">Hi ${name},</p>
                    <p style="margin:0;font-size:16px;line-height:1.65;mso-line-height-rule:exactly;color:#2b2a26;">We're thrilled to have you. Because demand has been far higher than we expected, we're rolling out new accounts in controlled waves to keep deliverability and support quality high for everyone.</p>
                  </td>
                </tr>

                <!-- Callout: timeline -->
                <tr>
                  <td class="px" style="padding:22px 40px 0;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f2;border:1px solid #e4e2da;border-radius:14px;">
                      <tr>
                        <td style="padding:20px 22px;font-family:Arial,Helvetica,sans-serif;">
                          <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a887f;">Estimated rollout</div>
                          <div style="margin-top:6px;font-size:22px;font-weight:bold;color:#1f1e1b;letter-spacing:-.01em;">Within 7 days &middot; often sooner</div>
                          <div style="margin-top:6px;font-size:14px;line-height:1.55;mso-line-height-rule:exactly;color:#57554e;">We provision in the order accounts were confirmed. You'll get a &ldquo;Your workspace is ready&rdquo; email with your login link.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- What's included -->
                <tr>
                  <td class="px" style="padding:30px 40px 0;font-family:Arial,Helvetica,sans-serif;">
                    <div style="font-family:'Courier New',Courier,monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#8a887f;">Your free trial includes</div>
                  </td>
                </tr>
                <tr>
                  <td class="px" style="padding:12px 40px 0;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                      <tr>
                        <td width="50%" class="stack" style="padding:0 7px 14px 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f2;border-radius:12px;">
                            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;"><span style="font-size:20px;font-weight:bold;color:#1f1e1b;">${TRIAL.emails}</span><span style="font-size:14px;color:#57554e;"> emails</span></td></tr>
                          </table>
                        </td>
                        <td width="50%" class="stack" style="padding:0 0 14px 7px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f2;border-radius:12px;">
                            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;"><span style="font-size:20px;font-weight:bold;color:#1f1e1b;">${TRIAL.sms}</span><span style="font-size:14px;color:#57554e;"> SMS messages</span></td></tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td width="50%" class="stack" style="padding:0 7px 0 0;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f2;border-radius:12px;">
                            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;"><span style="font-size:20px;font-weight:bold;color:#1f1e1b;">${TRIAL.whatsapp}</span><span style="font-size:14px;color:#57554e;"> WhatsApp messages</span></td></tr>
                          </table>
                        </td>
                        <td width="50%" class="stack" style="padding:0 0 0 7px;">
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f6f5f2;border-radius:12px;">
                            <tr><td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;"><span style="font-size:20px;font-weight:bold;color:#1f1e1b;">${TRIAL.voiceMinutes}</span><span style="font-size:14px;color:#57554e;"> min voice calls</span></td></tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Meanwhile -->
                <tr>
                  <td class="px" style="padding:30px 40px 0;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0;font-size:16px;line-height:1.65;mso-line-height-rule:exactly;color:#2b2a26;">In the meantime, get a head start:</p>
                  </td>
                </tr>
                <tr>
                  <td class="px" align="center" style="padding:16px 40px 0;font-family:Arial,Helvetica,sans-serif;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0;">
                      <tr>
                        <td bgcolor="#4f46e5" style="border-radius:10px;">
                          <a href="https://maildrill.net/guides" style="display:block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:10px;">Explore the docs &amp; guides</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td class="px" style="padding:26px 40px 34px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0;font-size:15px;line-height:1.65;mso-line-height-rule:exactly;color:#57554e;">Questions before you're live? Just reply to this email or reach us at <a href="mailto:support@maildrill.net" style="color:#4f46e5;text-decoration:none;font-weight:bold;">support@maildrill.net</a>.</p>
                    <p style="margin:18px 0 0;font-size:15px;line-height:1.65;mso-line-height-rule:exactly;color:#2b2a26;">Talk soon,<br>The Maildrill team</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td width="600" style="background:#ffffff;border-radius:0 0 20px 20px;border-top:1px solid #eceae3;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td class="px" style="padding:24px 40px 30px;font-family:Arial,Helvetica,sans-serif;">
                    <p style="margin:0 0 6px;font-size:12px;line-height:1.6;mso-line-height-rule:exactly;color:#a5a39a;">You're receiving this because you signed up for Maildrill.</p>
                    <p style="margin:0;font-size:12px;line-height:1.6;mso-line-height-rule:exactly;color:#a5a39a;">Maildrill, Inc. &middot; 2261 Market St, San Francisco, CA 94114 &middot; <a href="https://maildrill.net/unsubscribe" style="color:#a5a39a;text-decoration:underline;">Unsubscribe</a></p>
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
export function waitlistEmailText(firstName?: string): string {
  const name = firstName?.trim() || 'there';
  return (
    `You're on the Maildrill waiting list\n\n` +
    `Hi ${name},\n\n` +
    `Thanks for signing up — your account is confirmed and your seat is reserved. ` +
    `Because demand has been higher than expected, we're rolling out new accounts in ` +
    `controlled waves. Your workspace will be ready within the next 7 days, most likely ` +
    `sooner, and we'll email you the moment it's live.\n\n` +
    `Your free trial includes ${TRIAL.emails} emails, ${TRIAL.sms} SMS messages, ` +
    `${TRIAL.whatsapp} WhatsApp messages and ${TRIAL.voiceMinutes} minutes of voice calls.\n\n` +
    `In the meantime, get a head start with the docs & guides: https://maildrill.net/guides\n\n` +
    `Questions? Reply to this email or reach us at support@maildrill.net.\n\n` +
    `Talk soon,\nThe Maildrill team`
  );
}
