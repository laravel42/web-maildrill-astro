/**
 * L42-309 — Templates library endpoints (Fastify).
 *
 *   POST   /dev/save-template               — save a full email design as a template
 *   GET    /dev/templates                   — list saved templates
 *   GET    /dev/templates/:usage/:id        — fetch a full template
 *   PUT    /dev/templates/:usage/:id        — partial update
 *   DELETE /dev/templates/:usage/:id        — delete a template
 *
 * Persisted as NDJSON under
 *   skills/email-builder/references/templates/{usage}/{uuid}.ndjson
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

import multipart from '@fastify/multipart';

import { parseSaveRequestWithThumbnail } from './dev-library-multipart.js';
import {
  buildThumbnailMetadata,
  type LibraryBlockEntry,
  type LibraryMetadataBase,
  MAX_BLOCKS,
  MAX_NDJSON_BYTES,
  normalizeTags,
  parseLibraryFile,
  PayloadTooLargeError,
  renumberBlocks,
  serialiseLibraryFile,
  tagsSchema,
  type ThumbnailMetadata,
} from './dev-library-ndjson.js';
import { SKILLS_REFERENCES_DIR } from './dev-library-paths.js';
import {
  DESCRIPTION_MAX_LENGTH,
  DISABLED_RESPONSE_BODY,
  isLibraryEndpointEnabled,
  isValidUuid,
  NAME_MAX_LENGTH,
  newId,
  nowIso,
} from './dev-library-shared.js';
import {
  deleteThumbnailFile,
  getThumbnailPath,
  MAX_THUMBNAIL_BYTES,
  readThumbnailFile,
  statThumbnailFile,
  ThumbnailTooLargeError,
  writeThumbnailFile,
} from './dev-library-thumbnails.js';

const USAGE_MAX_LENGTH = 48;

const SaveTemplateSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(NAME_MAX_LENGTH),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
  usage: z.string().trim().min(1, 'usage is required').max(USAGE_MAX_LENGTH),
  tags: tagsSchema,
  blocks: z
    .array(z.object({ id: z.string().min(1), block: z.unknown() }))
    .min(1)
    .max(MAX_BLOCKS),
});

const UpdateTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(NAME_MAX_LENGTH).optional(),
    description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
    tags: tagsSchema,
    blocks: z
      .array(z.object({ id: z.string().min(1), block: z.unknown() }))
      .min(1)
      .max(MAX_BLOCKS)
      .optional(),
  })
  .refine(
    (v) => v.name !== undefined || v.description !== undefined || v.tags !== undefined || v.blocks !== undefined,
    { message: 'at least one of name, description, tags, blocks is required' }
  );

type BlockEntry = LibraryBlockEntry;
type TemplateMetadata = LibraryMetadataBase & { usage: string };

function templatesDir(): string {
  return resolve(SKILLS_REFERENCES_DIR, 'templates');
}
function usageDir(usage: string): string {
  return resolve(templatesDir(), usage);
}
function templateFilePath(usage: string, id: string): string {
  return resolve(usageDir(usage), `${id}.ndjson`);
}

function serialiseTemplate(meta: TemplateMetadata, entries: BlockEntry[]): string {
  return serialiseLibraryFile(meta, entries);
}

function parseTemplateFile(raw: string): { metadata: TemplateMetadata; entries: BlockEntry[] } {
  const { metadata, entries } = parseLibraryFile<TemplateMetadata>(raw);
  if (typeof metadata.usage !== 'string') throw new Error('malformed metadata header: missing usage');
  return { metadata, entries };
}

type TemplateListing = {
  id: string;
  usage: string;
  name: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  blockCount: number;
  sizeBytes: number;
  hasThumbnail: boolean;
};

function listTemplates(): TemplateListing[] {
  const dir = templatesDir();
  if (!existsSync(dir)) return [];
  const out: TemplateListing[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const usage = entry.name;
    const dirPath = usageDir(usage);
    let files: string[];
    try {
      files = readdirSync(dirPath).filter((f) => f.endsWith('.ndjson'));
    } catch {
      continue;
    }
    for (const file of files) {
      const id = file.replace(/\.ndjson$/, '');
      if (!isValidUuid(id)) continue;
      const fullPath = resolve(dirPath, file);
      let stats;
      try {
        stats = statSync(fullPath);
      } catch {
        continue;
      }
      let parsed: { metadata: TemplateMetadata; entries: BlockEntry[] };
      try {
        parsed = parseTemplateFile(readFileSync(fullPath, 'utf8'));
      } catch {
        continue;
      }
      out.push({
        id: parsed.metadata.id,
        usage,
        name: parsed.metadata.name,
        description: parsed.metadata.description,
        tags: parsed.metadata.tags ?? [],
        createdAt: parsed.metadata.createdAt,
        updatedAt: parsed.metadata.updatedAt,
        blockCount: parsed.entries.length,
        sizeBytes: stats.size,
        hasThumbnail: parsed.metadata.thumbnail !== undefined,
      });
    }
  }
  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return out;
}

export const devSaveTemplatePlugin = async function devSaveTemplatePlugin(fastify: FastifyInstance) {
  await fastify.register(multipart, { limits: { fileSize: MAX_THUMBNAIL_BYTES } });

  fastify.post('/dev/save-template', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    const parsed = await parseSaveRequestWithThumbnail(request, reply, SaveTemplateSchema);
    if (parsed === null) return;
    const { payload: body, thumbnail } = parsed;

    const id = newId();
    const now = nowIso();
    const thumbnailMetadata: ThumbnailMetadata | undefined = thumbnail
      ? buildThumbnailMetadata({
          format: thumbnail.format,
          width: thumbnail.width,
          height: thumbnail.height,
          sizeBytes: thumbnail.bytes.byteLength,
          capturedAt: now,
        })
      : undefined;

    const metadata: TemplateMetadata = {
      id,
      usage: body.usage.trim(),
      name: body.name.trim(),
      ...(body.description ? { description: body.description } : {}),
      ...(normalizeTags(body.tags) ? { tags: normalizeTags(body.tags) } : {}),
      createdAt: now,
      updatedAt: now,
      ...(thumbnailMetadata ? { thumbnail: thumbnailMetadata } : {}),
    };

    const { entries, droppedRefs } = renumberBlocks(body.blocks as BlockEntry[], id);
    let ndjson: string;
    try {
      ndjson = serialiseTemplate(metadata, entries);
    } catch (err) {
      if (err instanceof PayloadTooLargeError)
        return reply
          .status(413)
          .send({ error: 'payload_too_large', limitBytes: MAX_NDJSON_BYTES, actualBytes: err.bytes });
      throw err;
    }

    if (thumbnail) {
      try {
        writeThumbnailFile(getThumbnailPath('templates', body.usage.trim(), id, thumbnail.format), thumbnail.bytes);
      } catch (err) {
        if (err instanceof ThumbnailTooLargeError)
          return reply
            .status(413)
            .send({ error: 'thumbnail_too_large', limitBytes: err.limit, actualBytes: err.bytes });
        return reply
          .status(500)
          .send({ error: 'thumbnail_write_failed', message: err instanceof Error ? err.message : 'unknown' });
      }
    }

    try {
      const dir = usageDir(body.usage.trim());
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(templateFilePath(body.usage.trim(), id), ndjson, 'utf8');
    } catch (err) {
      if (thumbnail) deleteThumbnailFile(getThumbnailPath('templates', body.usage.trim(), id, thumbnail.format));
      return reply.status(500).send({ error: 'write_failed', message: err instanceof Error ? err.message : 'unknown' });
    }

    return reply.send({
      id,
      name: metadata.name,
      description: metadata.description,
      usage: metadata.usage,
      tags: metadata.tags ?? [],
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      blockCount: entries.length,
      droppedRefs,
      hasThumbnail: thumbnail !== null,
      saved: `templates/${metadata.usage}/${id}.ndjson`,
    });
  });

  fastify.get('/dev/templates', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    return reply.send({ templates: listTemplates() });
  });

  fastify.get<{ Params: { usage: string; id: string } }>('/dev/templates/:usage/:id', async (request, reply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    const { usage, id } = request.params;
    if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });
    const path = templateFilePath(usage, id);
    if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', usage, id });
    let parsed: { metadata: TemplateMetadata; entries: BlockEntry[] };
    try {
      parsed = parseTemplateFile(readFileSync(path, 'utf8'));
    } catch (err) {
      return reply.status(500).send({ error: 'read_failed', message: err instanceof Error ? err.message : 'unknown' });
    }
    return reply.send({
      id: parsed.metadata.id,
      usage: parsed.metadata.usage,
      name: parsed.metadata.name,
      description: parsed.metadata.description,
      tags: parsed.metadata.tags ?? [],
      createdAt: parsed.metadata.createdAt,
      updatedAt: parsed.metadata.updatedAt,
      blocks: parsed.entries,
      hasThumbnail: parsed.metadata.thumbnail !== undefined,
    });
  });

  fastify.put<{ Params: { usage: string; id: string } }>('/dev/templates/:usage/:id', async (request, reply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    const { usage, id } = request.params;
    if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

    const parsedReq = await parseSaveRequestWithThumbnail(request, reply, UpdateTemplateSchema);
    if (parsedReq === null) return;
    const { payload: body, thumbnail } = parsedReq;

    const path = templateFilePath(usage, id);
    if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', usage, id });
    let parsed: { metadata: TemplateMetadata; entries: BlockEntry[] };
    try {
      parsed = parseTemplateFile(readFileSync(path, 'utf8'));
    } catch (err) {
      return reply.status(500).send({ error: 'read_failed', message: err instanceof Error ? err.message : 'unknown' });
    }

    const nextMetadata: TemplateMetadata = { ...parsed.metadata, updatedAt: nowIso() };
    if (body.name !== undefined) nextMetadata.name = body.name.trim();
    if (body.description !== undefined) {
      if (body.description === '') delete nextMetadata.description;
      else nextMetadata.description = body.description;
    }
    if (body.tags !== undefined) {
      const n = normalizeTags(body.tags);
      if (n) nextMetadata.tags = n;
      else delete nextMetadata.tags;
    }
    if (thumbnail) {
      nextMetadata.thumbnail = buildThumbnailMetadata({
        format: thumbnail.format,
        width: thumbnail.width,
        height: thumbnail.height,
        sizeBytes: thumbnail.bytes.byteLength,
        capturedAt: nextMetadata.updatedAt,
      });
    }

    let nextEntries = parsed.entries;
    let droppedRefs: string[] = [];
    if (body.blocks !== undefined) {
      const renumbered = renumberBlocks(body.blocks as BlockEntry[], id);
      nextEntries = renumbered.entries;
      droppedRefs = renumbered.droppedRefs;
    }

    let ndjson: string;
    try {
      ndjson = serialiseTemplate(nextMetadata, nextEntries);
    } catch (err) {
      if (err instanceof PayloadTooLargeError)
        return reply
          .status(413)
          .send({ error: 'payload_too_large', limitBytes: MAX_NDJSON_BYTES, actualBytes: err.bytes });
      throw err;
    }

    if (thumbnail) {
      try {
        writeThumbnailFile(getThumbnailPath('templates', usage, id, thumbnail.format), thumbnail.bytes);
      } catch (err) {
        if (err instanceof ThumbnailTooLargeError)
          return reply
            .status(413)
            .send({ error: 'thumbnail_too_large', limitBytes: err.limit, actualBytes: err.bytes });
        return reply
          .status(500)
          .send({ error: 'thumbnail_write_failed', message: err instanceof Error ? err.message : 'unknown' });
      }
      deleteThumbnailFile(getThumbnailPath('templates', usage, id, thumbnail.format === 'webp' ? 'png' : 'webp'));
    }

    try {
      writeFileSync(path, ndjson, 'utf8');
    } catch (err) {
      return reply.status(500).send({ error: 'write_failed', message: err instanceof Error ? err.message : 'unknown' });
    }

    return reply.send({
      id: nextMetadata.id,
      usage: nextMetadata.usage,
      name: nextMetadata.name,
      description: nextMetadata.description,
      tags: nextMetadata.tags ?? [],
      createdAt: nextMetadata.createdAt,
      updatedAt: nextMetadata.updatedAt,
      blockCount: nextEntries.length,
      droppedRefs,
      hasThumbnail: nextMetadata.thumbnail !== undefined,
    });
  });

  fastify.delete<{ Params: { usage: string; id: string } }>('/dev/templates/:usage/:id', async (request, reply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    const { usage, id } = request.params;
    if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });
    const path = templateFilePath(usage, id);
    if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', usage, id });
    try {
      unlinkSync(path);
    } catch (err) {
      return reply
        .status(500)
        .send({ error: 'delete_failed', message: err instanceof Error ? err.message : 'unknown' });
    }
    deleteThumbnailFile(getThumbnailPath('templates', usage, id, 'webp'));
    deleteThumbnailFile(getThumbnailPath('templates', usage, id, 'png'));
    return reply.send({ deleted: `templates/${usage}/${id}.ndjson`, usage, id });
  });

  fastify.get<{ Params: { usage: string; id: string } }>(
    '/dev/templates/:usage/:id/thumbnail',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const { usage, id } = request.params;
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });
      const candidates = [
        { filePath: getThumbnailPath('templates', usage, id, 'webp'), contentType: 'image/webp' },
        { filePath: getThumbnailPath('templates', usage, id, 'png'), contentType: 'image/png' },
      ];
      let chosen: { filePath: string; contentType: string; stats: { size: number; mtimeMs: number } } | null = null;
      for (const c of candidates) {
        const stats = statThumbnailFile(c.filePath);
        if (stats !== null) {
          chosen = { ...c, stats };
          break;
        }
      }
      if (chosen === null) return reply.status(404).send({ error: 'thumbnail_not_found', usage, id });
      const etag = `W/"${chosen.stats.size}-${Math.floor(chosen.stats.mtimeMs)}"`;
      if (request.headers['if-none-match'] === etag)
        return reply.status(304).headers({ ETag: etag, 'Cache-Control': 'public, max-age=300' }).send();
      const buffer = readThumbnailFile(chosen.filePath);
      if (buffer === null) return reply.status(404).send({ error: 'thumbnail_not_found', usage, id });
      return reply
        .status(200)
        .headers({
          'Content-Type': chosen.contentType,
          'Content-Length': String(buffer.byteLength),
          'Cache-Control': 'public, max-age=300',
          ETag: etag,
        })
        .send(buffer);
    }
  );
};
