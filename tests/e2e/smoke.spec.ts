import { expect, test } from '@playwright/test';

test.describe('marketing smoke', () => {
  test('homepage renders brand, H1, and primary CTA without requiring app JS for content', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Maildrill home' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('One workspace');
    await expect(page.getByRole('link', { name: 'Start free trial' }).first()).toBeVisible();
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', /\/?$/);
  });

  test('pricing page exposes FAQ and estimator', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Pay only');
    await expect(page.getByText('Frequently asked')).toBeVisible();
    await expect(page.getByText('Your estimate')).toBeVisible();
    const jsonLd = page.locator('script[type="application/ld+json"]');
    await expect(jsonLd.first()).toBeAttached();
  });

  test('contact form validates and shows success for placeholder submit', async ({ page }) => {
    await page.goto('/contact');
    await page.getByLabel('First name').fill('Ada');
    await page.getByLabel('Last name').fill('Lovelace');
    await page.getByLabel('Work email').fill('ada@example.com');
    await page.getByLabel('What can we help with?').selectOption('Talk to sales');
    await page.getByLabel('Message').fill('Interested in Maildrill.');
    await page.getByRole('button', { name: 'Send message' }).click();
    await expect(page.getByRole('heading', { name: 'Message sent' })).toBeVisible();
  });

  test('404 page works', async ({ page }) => {
    const response = await page.goto('/this-route-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('inbox');
  });
});

test.describe('app shell', () => {
  test('dashboard and campaigns navigation work', async ({ page }) => {
    await page.goto('/app');
    // The dashboard's single H1 is the greeting (per the design).
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Good evening');
    await page.getByRole('link', { name: 'Campaigns' }).first().click();
    await expect(page).toHaveURL(/\/app\/campaigns$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Campaigns' })).toBeVisible();
    await expect(page.getByText('Spring Launch')).toBeVisible();
  });

  test('login placeholder routes into app', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill('andrea@acme.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/app\/?$/);
  });
});

test.describe('SEO artifacts', () => {
  test('robots and sitemap are available', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.ok()).toBeTruthy();
    expect(await robots.text()).toContain('Sitemap:');

    const sitemap = await request.get('/sitemap-index.xml');
    expect(sitemap.ok()).toBeTruthy();
    expect(await sitemap.text()).toContain('sitemap');
  });

  test('blog RSS exists', async ({ request }) => {
    const rss = await request.get('/rss.xml');
    expect(rss.ok()).toBeTruthy();
    expect(await rss.text()).toContain('<rss');
  });
});
