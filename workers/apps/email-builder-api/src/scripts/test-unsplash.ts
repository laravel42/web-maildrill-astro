/**
 * Dev-only smoke test for the Unsplash client.
 *
 * Performs a small fixed number of requests (default: 4 searches + 1 track =
 * 5 requests total) so we exercise the happy path without burning through
 * the demo quota of 50 req/h.
 *
 * Usage (from repo root):
 *   pnpm -F @eb/backend test:unsplash
 *   pnpm -F @eb/backend test:unsplash "yoga studio"
 *
 * The script prints a compact summary per call so we can eyeball that:
 *  - authentication works (no 401)
 *  - results look semantically relevant to the query
 *  - rate-limit headers are exposed
 *  - track-download returns `true`
 *  - requests with different filters return different photos
 */

import 'dotenv/config';

import { createUnsplashClient, UnsplashUpstreamError } from '../unsplash/client.js';

interface SearchCase {
  label: string;
  query: string;
  orientation?: 'landscape' | 'portrait' | 'squarish';
}

// Keep this list at 4 entries — 4 searches + 1 track ping = 5 total API
// calls, well under the 50 req/h demo quota even if run repeatedly.
const DEFAULT_CASES: SearchCase[] = [
  { label: 'Welcome hero (landscape)', query: 'welcome onboarding', orientation: 'landscape' },
  { label: 'Product newsletter', query: 'product launch', orientation: 'landscape' },
  { label: 'Team / community', query: 'diverse team collaboration', orientation: 'landscape' },
  { label: 'Brand / creative', query: 'abstract gradient brand', orientation: 'squarish' },
];

function formatPhoto(photo: {
  id: string;
  user: { name: string };
  alt: string;
  urls: { thumb: string; small: string };
}): string {
  // `urls.small` is a public CDN URL on images.unsplash.com — paste it in a
  // browser to see the photo. Do NOT paste `links.downloadLocation`: that is
  // an API endpoint that requires the Client-ID auth header and will return
  // `{"errors":["OAuth error: The access token is invalid"]}` when opened
  // unauthenticated, which can look like a setup failure but isn't.
  return (
    `  • ${photo.id}  ${photo.user.name.padEnd(20).slice(0, 20)}  ` +
    `${photo.alt.slice(0, 50).padEnd(50)}\n` +
    `      preview: ${photo.urls.small}`
  );
}

async function main(): Promise<void> {
  if (!process.env.UNSPLASH_API_KEY) {
    console.error('UNSPLASH_API_KEY is not set. Fill it in packages/backend/.env first.');
    process.exit(1);
  }

  const cliQuery = process.argv.slice(2).join(' ').trim();
  const cases: SearchCase[] = cliQuery
    ? [{ label: 'Custom query', query: cliQuery, orientation: 'landscape' }]
    : DEFAULT_CASES;

  const client = createUnsplashClient();

  let lastDownloadLocation: string | null = null;

  for (const testCase of cases) {
    console.log(`\n── ${testCase.label} ───────────────────────────────`);
    console.log(`query="${testCase.query}" orientation=${testCase.orientation ?? '(none)'}`);

    try {
      const res = await client.searchPhotos({
        query: testCase.query,
        perPage: 5,
        orientation: testCase.orientation,
      });

      console.log(`  total=${res.total}  rate-limit-remaining=${res.rateLimitRemaining ?? '?'}`);
      for (const photo of res.results.slice(0, 5)) {
        console.log(formatPhoto(photo));
      }
      // Capture the first usable download_location to exercise /track once at
      // the end.
      if (!lastDownloadLocation && res.results[0]) {
        lastDownloadLocation = res.results[0].links.downloadLocation;
      }
    } catch (error) {
      if (error instanceof UnsplashUpstreamError) {
        console.error(`  [upstream error ${error.status}]`, error.message);
      } else {
        console.error('  [error]', error);
      }
    }
  }

  if (lastDownloadLocation) {
    console.log('\n── Download tracking ───────────────────────────────');
    console.log(`downloadLocation=${lastDownloadLocation}`);
    const ok = await client.trackDownload(lastDownloadLocation);
    console.log(`tracked=${ok}`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('\n[test-unsplash] error:', err);
  process.exit(1);
});
