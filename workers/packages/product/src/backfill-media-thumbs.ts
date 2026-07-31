/**
 * Backfill 250×250 cover twins for media assets that predate thumb support.
 *
 * Downloads each original from S3, cover-crops with sharp, uploads a WebP twin,
 * and sets `thumb_storage_key`. Skips rows that already have a twin.
 *
 * Run (root .env via @maildrill/config):
 *   pnpm --dir workers db:backfill:thumbs
 *   pnpm --dir workers db:backfill:thumbs --dry-run
 *   pnpm --dir workers db:backfill:thumbs --limit=20
 *   pnpm --dir workers db:backfill:thumbs --tenant=hello@laravel42.com
 */
import sharp from "sharp";
import { eq } from "drizzle-orm";
import { db, tenants } from "@maildrill/database";
import {
  attachMediaThumb,
  getMediaObjectBytes,
  listMediaMissingThumbs,
  MEDIA_THUMB_SIZE,
  mediaConfigured,
} from "./media";

const DEFAULT_CONCURRENCY = 4;

function argValue(flag: string): string | null {
  const eqArg = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (eqArg) return eqArg.slice(flag.length + 1);
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1]!.startsWith("-")) {
    return process.argv[i + 1]!;
  }
  return null;
}

async function resolveTenantId(nameOrId: string): Promise<string> {
  if (/^[0-9a-f-]{36}$/i.test(nameOrId)) return nameOrId;
  const rows = await db.select().from(tenants).where(eq(tenants.name, nameOrId)).limit(1);
  const row = rows[0];
  if (!row) throw new Error(`tenant not found: ${nameOrId}`);
  return row.id;
}

async function makeThumb250(bytes: Buffer): Promise<Buffer> {
  // failOn none: tolerate truncated/corrupt JPEG segments that still decode.
  return sharp(bytes, { failOn: "none" })
    .autoOrient()
    .resize(MEDIA_THUMB_SIZE, MEDIA_THUMB_SIZE, {
      fit: "cover",
      position: "centre",
    })
    .webp({ quality: 82 })
    .toBuffer();
}

async function runPool<T>(
  items: T[],
  width: number,
  worker: (item: T) => Promise<void>,
): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;
  let next = 0;
  const lane = async () => {
    while (next < items.length) {
      const item = items[next++]!;
      try {
        await worker(item);
        ok += 1;
      } catch (err) {
        fail += 1;
        console.log(`  ! ${err instanceof Error ? err.message : err}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(width, items.length) }, lane));
  return { ok, fail };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Math.max(1, parseInt(limitRaw, 10)) : null;
  const tenantArg = argValue("--tenant");
  const concurrencyRaw = argValue("--concurrency");
  const concurrency = concurrencyRaw
    ? Math.max(1, parseInt(concurrencyRaw, 10))
    : DEFAULT_CONCURRENCY;

  if (!mediaConfigured()) {
    throw new Error(
      "media storage is not configured (AWS_REGION, MEDIA_S3_BUCKET, MEDIA_CDN_DOMAIN)",
    );
  }

  const tenantId = tenantArg ? await resolveTenantId(tenantArg) : undefined;
  let rows = await listMediaMissingThumbs(tenantId);
  rows = rows.filter((r) => {
    const ct = r.contentType ?? "";
    // Rasterize anything image/* (including SVG via sharp/librsvg when available).
    return ct.startsWith("image/");
  });
  if (limit != null) rows = rows.slice(0, limit);

  console.log(
    `missing thumbs: ${rows.length}` +
      (tenantId ? ` (tenant ${tenantId})` : " (all tenants)") +
      (dryRun ? " [dry-run]" : ""),
  );
  if (rows.length === 0) return;

  if (dryRun) {
    for (const row of rows.slice(0, 15)) {
      console.log(`  would thumb: ${row.name} (${row.contentType ?? "?"})`);
    }
    if (rows.length > 15) console.log(`  … +${rows.length - 15} more`);
    return;
  }

  let done = 0;
  const { ok, fail } = await runPool(rows, concurrency, async (row) => {
    const original = await getMediaObjectBytes(row.storageKey);
    const thumb = await makeThumb250(original);
    await attachMediaThumb(row.tenantId, row.id, {
      body: thumb,
      contentType: "image/webp",
      filename: "thumb-250.webp",
    });
    done += 1;
    if (done % 25 === 0 || done === rows.length) {
      console.log(`  progress ${done}/${rows.length}`);
    }
  });

  console.log(`\ndone: ${ok} thumbed, ${fail} failed`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
