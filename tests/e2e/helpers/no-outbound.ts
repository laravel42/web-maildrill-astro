import type { Page } from '@playwright/test';

/**
 * Hard stop on anything that would leave the building.
 *
 * `PROVIDER_DRIVER` is `infobip` in the working `.env`, so a stray click on
 * "Send", "Send test", "Submit for approval" or a voice preview costs real
 * money and reaches real recipients — and a Stripe checkout would navigate off
 * the app entirely. The tour is written not to touch these, and this is the
 * belt to that pair of braces: the routes are aborted at the network layer, so
 * a future edit that wires a new button to one fails loudly instead of sending.
 *
 * Returns the list of blocked URLs so a test can assert nothing was attempted.
 */
export async function blockOutbound(page: Page): Promise<string[]> {
  const attempted: string[] = [];
  const forbidden = [
    /\/api\/v1\/campaigns\/[^/]+\/send\b/,
    /\/api\/v1\/campaigns\/[^/]+\/schedule\b/,
    /\/api\/v1\/templates\/[^/]+\/test-send\b/,
    /\/api\/v1\/templates\/[^/]+\/submit\b/,
    /\/api\/v1\/voice-preview\b/,
    /\/api\/v1\/billing\/checkout\b/,
  ];

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = request.url();
    if (request.method() !== 'GET' && forbidden.some((re) => re.test(url))) {
      attempted.push(`${request.method()} ${url}`);
      await route.abort('blockedbyclient');
      return;
    }
    await route.fallback();
  });

  return attempted;
}
