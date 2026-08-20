/**
 * Shared multipart-with-thumbnail parser for the library save routes.
 *
 * Three POST endpoints (`/dev/save-section`, `/dev/save-layout`,
 * `/dev/save-template`) accept the same request shape:
 *
 *   - `application/json` body with the save payload only.
 *   - `multipart/form-data` body with:
 *       - `payload` (string field): the same JSON encoded as a string.
 *       - `thumbnail` (binary field, optional): a PNG or WebP capture.
 *
 * With Fastify + @fastify/multipart, the discrimination works as follows:
 *   - JSON requests are parsed by Fastify's built-in JSON parser — `request.body`
 *     is already the parsed object.
 *   - Multipart requests are parsed by @fastify/multipart — fields and files are
 *     consumed via `request.file()` / `request.fields`.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import {
  detectThumbnailFormat,
  extractImageDimensions,
  MAX_THUMBNAIL_BYTES,
  type ThumbnailFormat,
} from './dev-library-thumbnails';

export type ParsedSavePayloadWithThumbnail<T> = {
  payload: T;
  thumbnail: {
    bytes: Buffer;
    format: ThumbnailFormat;
    width: number;
    height: number;
  } | null;
};

/**
 * Parse a save request body from a Fastify request. Detects JSON vs
 * multipart by checking `request.isMultipart()`.
 *
 * Returns either the parsed payload or sends an error response and
 * returns `null`.
 */
export async function parseSaveRequestWithThumbnail<TSchema extends z.ZodTypeAny>(
  request: FastifyRequest,
  reply: FastifyReply,
  schema: TSchema,
): Promise<ParsedSavePayloadWithThumbnail<z.infer<TSchema>> | null> {
  let rawJson: unknown;
  let fileBuffer: Buffer | null = null;

  if (request.isMultipart()) {
    // Consume the multipart stream — we expect a `payload` field and
    // an optional `thumbnail` file.
    let payloadField: string | undefined;
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'payload') {
        payloadField = part.value as string;
      } else if (part.type === 'file' && part.fieldname === 'thumbnail') {
        fileBuffer = await part.toBuffer();
      } else if (part.type === 'file') {
        // Any other uploaded file still has to be drained. @fastify/multipart
        // yields parts sequentially from one stream, so an unconsumed file
        // stalls the iterator and the request hangs until it times out.
        part.file.resume();
      }
    }

    if (typeof payloadField !== 'string') {
      reply.status(400).send({
        error: 'invalid_request',
        message: 'multipart body must include a string `payload` field',
      });
      return null;
    }
    try {
      rawJson = JSON.parse(payloadField);
    } catch {
      reply.status(400).send({ error: 'invalid_json' });
      return null;
    }
  } else {
    rawJson = request.body;
  }

  // Validate the JSON portion against the supplied schema.
  let payload: z.infer<TSchema>;
  try {
    payload = schema.parse(rawJson);
  } catch (err) {
    if (err instanceof z.ZodError) {
      reply.status(400).send({ error: 'invalid_request', issues: err.issues });
      return null;
    }
    reply.status(400).send({ error: 'invalid_json' });
    return null;
  }

  // No thumbnail file → JSON path or multipart with no thumbnail.
  if (!fileBuffer) {
    return { payload, thumbnail: null };
  }

  // Validate the binary blob.
  if (fileBuffer.byteLength > MAX_THUMBNAIL_BYTES) {
    reply.status(413).send({
      error: 'thumbnail_too_large',
      limitBytes: MAX_THUMBNAIL_BYTES,
      actualBytes: fileBuffer.byteLength,
    });
    return null;
  }
  const format = detectThumbnailFormat(fileBuffer);
  if (format === null) {
    reply
      .status(400)
      .send({ error: 'invalid_thumbnail_format', hint: 'thumbnail must be a PNG or WebP image' });
    return null;
  }
  const dims = extractImageDimensions(fileBuffer, format);
  if (dims === null) {
    reply.status(400).send({ error: 'invalid_thumbnail_dimensions' });
    return null;
  }

  return {
    payload,
    thumbnail: { bytes: Buffer.from(fileBuffer), format, width: dims.width, height: dims.height },
  };
}
