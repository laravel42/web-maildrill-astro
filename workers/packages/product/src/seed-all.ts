/**
 * Full dev seed — everything `pnpm db:seed` produces, in one command:
 *
 *   1. seedDev()     dev-workspace reset + six months of demo data, the
 *                    billing catalog, and the gallery email templates
 *                    (packages/database/src/seed.ts)
 *   2. seedImages()  Unsplash media library — skipped when UNSPLASH_API_KEY
 *                    or media storage (AWS_REGION, MEDIA_S3_BUCKET,
 *                    MEDIA_CDN_DOMAIN) is not configured
 *
 * Lives in @maildrill/product (not database) because the images seeder needs
 * the media pipeline, and product already depends on database — the reverse
 * import would be a workspace cycle.
 *
 * Flags: --no-posthog (skip the PostHog mirror), --no-images (skip the media
 * library), --missing-topics / --per-category=N (forwarded to the images
 * seeder). The granular db:seed:* commands still run each seeder alone.
 */
import { seedDev } from '@maildrill/database/seed';
import { mediaConfigured } from './media';
import { seedImages } from './seed-images';

async function main(): Promise<void> {
  await seedDev();
  if (process.argv.includes('--reset-only')) return;

  if (process.argv.includes('--no-images')) {
    console.log('images: skipped (--no-images)');
  } else if (!(process.env.UNSPLASH_API_KEY ?? '').trim()) {
    console.log('images: skipped — set UNSPLASH_API_KEY in .env');
  } else if (!mediaConfigured()) {
    console.log(
      'images: skipped — media storage not configured (AWS_REGION, MEDIA_S3_BUCKET, MEDIA_CDN_DOMAIN)',
    );
  } else {
    const { failed } = await seedImages();
    if (failed > 0) process.exitCode = 1;
  }
}

main()
  .then(() => {
    console.log('done');
    process.exit(process.exitCode ?? 0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
