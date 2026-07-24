import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { and, desc, eq } from "drizzle-orm";
import { db, mediaAssets, type MediaAssetRow } from "@maildrill/database";
import { config } from "@maildrill/config";
import { ConflictError, NotFoundError, ValidationError } from "@maildrill/domain";

/**
 * Media library backed by S3 for storage and CloudFront for delivery.
 *
 * Uploads go straight from the browser to S3 with a presigned PUT, so large
 * files never pass through this service. The row is written only after the
 * object exists (see confirmUpload), which means a failed upload leaves no
 * asset claiming to be there.
 */

/** What the browser is allowed to store. Anything else is rejected up front. */
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "application/pdf",
  // Audio — usable as Voice-message audio files (Infobip prefers mp3/wav).
  "audio/mpeg", // mp3
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4", // m4a
  "audio/x-m4a",
  "audio/aac",
]);

/** Presigned PUT lifetime — long enough for a slow upload, short enough to expire. */
const UPLOAD_URL_TTL_SECONDS = 900;

let client: S3Client | null = null;

function s3(): S3Client {
  if (!config.media.configured) {
    throw new ConflictError(
      "media storage is not configured (set AWS_REGION, MEDIA_S3_BUCKET, MEDIA_CDN_DOMAIN)",
    );
  }
  client ??= new S3Client({
    region: config.media.region,
    // Fall back to the ambient AWS credential chain (instance role, SSO, env)
    // when explicit keys aren't set, which is what production should use.
    credentials: config.media.accessKeyId
      ? {
          accessKeyId: config.media.accessKeyId,
          secretAccessKey: config.media.secretAccessKey,
        }
      : undefined,
  });
  return client;
}

/** Public CloudFront URL for a stored object. */
export function publicUrlFor(storageKey: string): string {
  const domain = config.media.cdnDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${domain}/${storageKey}`;
}

/** Strip anything that could escape the tenant prefix or confuse a URL. */
function safeName(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120) || "file";
}

export interface MediaAsset {
  id: string;
  name: string;
  folder: string | null;
  tags: string[];
  sizeBytes: number | null;
  contentType: string | null;
  width: number | null;
  height: number | null;
  url: string;
  createdAt: Date;
}

function toAsset(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    name: row.name,
    folder: row.folder,
    tags: row.tags,
    sizeBytes: row.sizeBytes,
    contentType: row.contentType,
    width: row.width,
    height: row.height,
    url: publicUrlFor(row.storageKey),
    createdAt: row.createdAt,
  };
}

export interface UploadTicket {
  storageKey: string;
  uploadUrl: string;
  /** Where the object will be readable once the PUT succeeds. */
  publicUrl: string;
  expiresInSeconds: number;
}

/**
 * Issue a presigned PUT for a single file. Validates type and size here rather
 * than after the bytes are already in the bucket.
 */
export async function createUploadTicket(
  tenantId: string,
  input: { filename: string; contentType: string; sizeBytes: number },
): Promise<UploadTicket> {
  if (!ALLOWED_TYPES.has(input.contentType)) {
    throw new ValidationError(`unsupported file type: ${input.contentType}`);
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > config.media.maxBytes) {
    throw new ValidationError(
      `file must be between 1 byte and ${Math.floor(config.media.maxBytes / 1024 / 1024)}MB`,
    );
  }

  // Tenant-prefixed and uuid-scoped: keys are unguessable and can never collide
  // with another workspace's object.
  const storageKey = `tenants/${tenantId}/${randomUUID()}-${safeName(input.filename)}`;
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: config.media.bucket,
      Key: storageKey,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );

  return {
    storageKey,
    uploadUrl,
    publicUrl: publicUrlFor(storageKey),
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  };
}

/**
 * Register an object that has finished uploading. Keyed on storage_key, so a
 * retried confirm returns the existing asset instead of duplicating it.
 */
export async function confirmUpload(
  tenantId: string,
  input: {
    storageKey: string;
    name: string;
    contentType?: string | null;
    sizeBytes?: number | null;
    folder?: string | null;
    width?: number | null;
    height?: number | null;
  },
): Promise<MediaAsset> {
  if (!input.storageKey.startsWith(`tenants/${tenantId}/`)) {
    throw new ValidationError("storage key does not belong to this workspace");
  }
  const rows = await db
    .insert(mediaAssets)
    .values({
      tenantId,
      storageKey: input.storageKey,
      name: safeName(input.name),
      folder: input.folder ?? null,
      contentType: input.contentType ?? null,
      sizeBytes: input.sizeBytes ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
    })
    .onConflictDoNothing({ target: mediaAssets.storageKey })
    .returning();

  if (rows[0]) return toAsset(rows[0]);

  const existing = await db
    .select()
    .from(mediaAssets)
    .where(
      and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.storageKey, input.storageKey)),
    )
    .limit(1);
  if (!existing[0]) throw new ConflictError("storage key already registered");
  return toAsset(existing[0]);
}

export async function listMedia(tenantId: string): Promise<MediaAsset[]> {
  const rows = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.tenantId, tenantId))
    .orderBy(desc(mediaAssets.createdAt));
  return rows.map(toAsset);
}

export async function updateMedia(
  tenantId: string,
  id: string,
  patch: { name?: string; folder?: string | null; tags?: string[] },
): Promise<MediaAsset | null> {
  const set: Record<string, unknown> = {};
  if (patch.name !== undefined) set.name = safeName(patch.name);
  if (patch.folder !== undefined) set.folder = patch.folder;
  if (patch.tags !== undefined) set.tags = patch.tags;
  if (Object.keys(set).length === 0) {
    const rows = await db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.id, id), eq(mediaAssets.tenantId, tenantId)))
      .limit(1);
    return rows[0] ? toAsset(rows[0]) : null;
  }

  const rows = await db
    .update(mediaAssets)
    .set(set)
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.tenantId, tenantId)))
    .returning();
  return rows[0] ? toAsset(rows[0]) : null;
}

/**
 * Delete the row and the object. The row goes first: an orphaned S3 object is
 * recoverable waste, whereas a row pointing at a deleted object is a broken
 * image in every template that used it.
 */
export async function deleteMedia(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(mediaAssets)
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.tenantId, tenantId)))
    .returning({ storageKey: mediaAssets.storageKey });
  const row = rows[0];
  if (!row) throw new NotFoundError("media asset not found");

  await s3().send(
    new DeleteObjectCommand({ Bucket: config.media.bucket, Key: row.storageKey }),
  );
  return true;
}

/** Whether the media endpoints can do anything at all. */
export function mediaConfigured(): boolean {
  return config.media.configured;
}
