/**
 * L42-309 — Sections library endpoints (Fastify).
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
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

const ROLE_VALUES = [
  'hero',
  'features',
  'social_proof',
  'cta',
  'header',
  'footer',
  'nav',
  'logo',
  'pricing',
  'comparison',
  'testimonial',
  'stats',
  'steps',
  'faq',
  'team',
  'gallery',
  'banner',
] as const;

type Role = (typeof ROLE_VALUES)[number];

const ALLOWED_ROOT_TYPES = new Set(['Container', 'ColumnsContainer']);

const SaveSectionSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(NAME_MAX_LENGTH),
  description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
  role: z.enum(ROLE_VALUES),
  tags: tagsSchema,
  blocks: z
    .array(z.object({ id: z.string().min(1), block: z.unknown() }))
    .min(1)
    .max(MAX_BLOCKS),
});

const UpdateSectionSchema = z
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
    (v) =>
      v.name !== undefined ||
      v.description !== undefined ||
      v.tags !== undefined ||
      v.blocks !== undefined,
    {
      message: 'at least one of name, description, tags, blocks is required',
    },
  );

type BlockEntry = LibraryBlockEntry;
type SectionMetadata = LibraryMetadataBase & { role: Role };

function sectionsDir(): string {
  return resolve(SKILLS_REFERENCES_DIR, 'sections');
}
function roleDir(role: Role): string {
  return resolve(sectionsDir(), role);
}
function sectionFilePath(role: Role, id: string): string {
  return resolve(roleDir(role), `${id}.ndjson`);
}

function serialiseSection(meta: SectionMetadata, entries: BlockEntry[]): string {
  return serialiseLibraryFile(meta, entries);
}

function parseSectionFile(raw: string): { metadata: SectionMetadata; entries: BlockEntry[] } {
  const { metadata, entries } = parseLibraryFile<SectionMetadata>(raw);
  if (typeof metadata.role !== 'string') throw new Error('malformed metadata header: missing role');
  return { metadata, entries };
}

type SectionListing = {
  id: string;
  role: Role;
  name: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  blockCount: number;
  sizeBytes: number;
  hasThumbnail: boolean;
};

function listSections(): SectionListing[] {
  const dir = sectionsDir();
  if (!existsSync(dir)) return [];
  const out: SectionListing[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!ROLE_VALUES.includes(entry.name as Role)) continue;
    const role = entry.name as Role;
    const dirPath = roleDir(role);
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
      let parsed: { metadata: SectionMetadata; entries: BlockEntry[] };
      try {
        parsed = parseSectionFile(readFileSync(fullPath, 'utf8'));
      } catch {
        continue;
      }
      out.push({
        id: parsed.metadata.id,
        role,
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

export const devSaveSectionPlugin = async function devSaveSectionPlugin(fastify: FastifyInstance) {
  await fastify.register(multipart, { limits: { fileSize: MAX_THUMBNAIL_BYTES } });

  fastify.post('/dev/save-section', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);

    const parsed = await parseSaveRequestWithThumbnail(request, reply, SaveSectionSchema);
    if (parsed === null) return;
    const { payload: body, thumbnail } = parsed;

    const rootBlock = body.blocks[0]?.block as { type?: unknown } | undefined;
    const rootType = typeof rootBlock?.type === 'string' ? rootBlock.type : null;
    if (rootType === null || !ALLOWED_ROOT_TYPES.has(rootType)) {
      return reply.status(400).send({
        error: 'invalid_root_type',
        rootType,
        allowed: Array.from(ALLOWED_ROOT_TYPES),
        hint: 'The first block must be a Container or ColumnsContainer.',
      });
    }

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

    const metadata: SectionMetadata = {
      id,
      role: body.role,
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
      ndjson = serialiseSection(metadata, entries);
    } catch (err) {
      if (err instanceof PayloadTooLargeError)
        return reply.status(413).send({
          error: 'payload_too_large',
          limitBytes: MAX_NDJSON_BYTES,
          actualBytes: err.bytes,
        });
      throw err;
    }

    if (thumbnail) {
      try {
        writeThumbnailFile(
          getThumbnailPath('sections', body.role, id, thumbnail.format),
          thumbnail.bytes,
        );
      } catch (err) {
        if (err instanceof ThumbnailTooLargeError)
          return reply
            .status(413)
            .send({ error: 'thumbnail_too_large', limitBytes: err.limit, actualBytes: err.bytes });
        return reply.status(500).send({
          error: 'thumbnail_write_failed',
          message: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    try {
      const dir = roleDir(body.role);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(sectionFilePath(body.role, id), ndjson, 'utf8');
    } catch (err) {
      if (thumbnail)
        deleteThumbnailFile(getThumbnailPath('sections', body.role, id, thumbnail.format));
      return reply
        .status(500)
        .send({ error: 'write_failed', message: err instanceof Error ? err.message : 'unknown' });
    }

    return reply.send({
      id,
      name: metadata.name,
      description: metadata.description,
      role: metadata.role,
      tags: metadata.tags ?? [],
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      blockCount: entries.length,
      droppedRefs,
      saved: `sections/${body.role}/${id}.ndjson`,
      hasThumbnail: thumbnail !== null,
    });
  });

  fastify.get('/dev/sections', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    return reply.send({ sections: listSections() });
  });

  fastify.get<{ Params: { role: string; id: string } }>(
    '/dev/sections/:role/:id',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const { role, id } = request.params;
      if (!ROLE_VALUES.includes(role as Role))
        return reply.status(400).send({ error: 'invalid_role', role });
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

      const path = sectionFilePath(role as Role, id);
      if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', role, id });

      let parsed: { metadata: SectionMetadata; entries: BlockEntry[] };
      try {
        parsed = parseSectionFile(readFileSync(path, 'utf8'));
      } catch (err) {
        return reply
          .status(500)
          .send({ error: 'read_failed', message: err instanceof Error ? err.message : 'unknown' });
      }

      return reply.send({
        id: parsed.metadata.id,
        role: parsed.metadata.role,
        name: parsed.metadata.name,
        description: parsed.metadata.description,
        tags: parsed.metadata.tags ?? [],
        createdAt: parsed.metadata.createdAt,
        updatedAt: parsed.metadata.updatedAt,
        blocks: parsed.entries,
        hasThumbnail: parsed.metadata.thumbnail !== undefined,
      });
    },
  );

  fastify.put<{ Params: { role: string; id: string } }>(
    '/dev/sections/:role/:id',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const { role, id } = request.params;
      if (!ROLE_VALUES.includes(role as Role))
        return reply.status(400).send({ error: 'invalid_role', role });
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

      const parsedReq = await parseSaveRequestWithThumbnail(request, reply, UpdateSectionSchema);
      if (parsedReq === null) return;
      const { payload: body, thumbnail } = parsedReq;

      const path = sectionFilePath(role as Role, id);
      if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', role, id });

      let parsed: { metadata: SectionMetadata; entries: BlockEntry[] };
      try {
        parsed = parseSectionFile(readFileSync(path, 'utf8'));
      } catch (err) {
        return reply
          .status(500)
          .send({ error: 'read_failed', message: err instanceof Error ? err.message : 'unknown' });
      }

      const nextMetadata: SectionMetadata = { ...parsed.metadata, updatedAt: nowIso() };
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
        ndjson = serialiseSection(nextMetadata, nextEntries);
      } catch (err) {
        if (err instanceof PayloadTooLargeError)
          return reply.status(413).send({
            error: 'payload_too_large',
            limitBytes: MAX_NDJSON_BYTES,
            actualBytes: err.bytes,
          });
        throw err;
      }

      if (thumbnail) {
        try {
          writeThumbnailFile(
            getThumbnailPath('sections', role as Role, id, thumbnail.format),
            thumbnail.bytes,
          );
        } catch (err) {
          if (err instanceof ThumbnailTooLargeError)
            return reply.status(413).send({
              error: 'thumbnail_too_large',
              limitBytes: err.limit,
              actualBytes: err.bytes,
            });
          return reply.status(500).send({
            error: 'thumbnail_write_failed',
            message: err instanceof Error ? err.message : 'unknown',
          });
        }
        deleteThumbnailFile(
          getThumbnailPath(
            'sections',
            role as Role,
            id,
            thumbnail.format === 'webp' ? 'png' : 'webp',
          ),
        );
      }

      try {
        writeFileSync(path, ndjson, 'utf8');
      } catch (err) {
        return reply
          .status(500)
          .send({ error: 'write_failed', message: err instanceof Error ? err.message : 'unknown' });
      }

      return reply.send({
        id: nextMetadata.id,
        role: nextMetadata.role,
        name: nextMetadata.name,
        description: nextMetadata.description,
        tags: nextMetadata.tags ?? [],
        createdAt: nextMetadata.createdAt,
        updatedAt: nextMetadata.updatedAt,
        blockCount: nextEntries.length,
        droppedRefs,
        hasThumbnail: nextMetadata.thumbnail !== undefined,
      });
    },
  );

  fastify.delete<{ Params: { role: string; id: string } }>(
    '/dev/sections/:role/:id',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const { role, id } = request.params;
      if (!ROLE_VALUES.includes(role as Role))
        return reply.status(400).send({ error: 'invalid_role', role });
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

      const path = sectionFilePath(role as Role, id);
      if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', role, id });

      try {
        unlinkSync(path);
      } catch (err) {
        return reply.status(500).send({
          error: 'delete_failed',
          message: err instanceof Error ? err.message : 'unknown',
        });
      }

      deleteThumbnailFile(getThumbnailPath('sections', role as Role, id, 'webp'));
      deleteThumbnailFile(getThumbnailPath('sections', role as Role, id, 'png'));
      return reply.send({ deleted: `sections/${role}/${id}.ndjson`, role, id });
    },
  );

  fastify.get<{ Params: { role: string; id: string } }>(
    '/dev/sections/:role/:id/thumbnail',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const { role, id } = request.params;
      if (!ROLE_VALUES.includes(role as Role))
        return reply.status(400).send({ error: 'invalid_role', role });
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

      const candidates = [
        {
          filePath: getThumbnailPath('sections', role as Role, id, 'webp'),
          contentType: 'image/webp',
        },
        {
          filePath: getThumbnailPath('sections', role as Role, id, 'png'),
          contentType: 'image/png',
        },
      ];
      let chosen: {
        filePath: string;
        contentType: string;
        stats: { size: number; mtimeMs: number };
      } | null = null;
      for (const c of candidates) {
        const stats = statThumbnailFile(c.filePath);
        if (stats !== null) {
          chosen = { ...c, stats };
          break;
        }
      }
      if (chosen === null)
        return reply.status(404).send({ error: 'thumbnail_not_found', role, id });

      const etag = `W/"${chosen.stats.size}-${Math.floor(chosen.stats.mtimeMs)}"`;
      if (request.headers['if-none-match'] === etag) {
        return reply
          .status(304)
          .headers({ ETag: etag, 'Cache-Control': 'public, max-age=300' })
          .send();
      }

      const buffer = readThumbnailFile(chosen.filePath);
      if (buffer === null)
        return reply.status(404).send({ error: 'thumbnail_not_found', role, id });

      return reply
        .status(200)
        .headers({
          'Content-Type': chosen.contentType,
          'Content-Length': String(buffer.byteLength),
          'Cache-Control': 'public, max-age=300',
          ETag: etag,
        })
        .send(buffer);
    },
  );
};
