/**
 * L42-309 — Layouts library endpoints (Fastify).
 *
 *   POST   /dev/save-layout                  — save a structural-only Container/Columns subtree
 *   GET    /dev/layouts                      — list saved layouts across all shapes
 *   GET    /dev/layouts/:shape/:id           — fetch a full layout
 *   PUT    /dev/layouts/:shape/:id           — partial update (name / description / blocks)
 *   DELETE /dev/layouts/:shape/:id           — delete a saved layout
 *
 * Layouts are persisted as NDJSON files under
 *
 *   skills/email-builder/references/layouts/{shape}/{uuid}.ndjson
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

const LAYOUT_SHAPE_VALUES = ['container', 'columns-2', 'columns-3'] as const;
type LayoutShape = (typeof LAYOUT_SHAPE_VALUES)[number];

const LAYOUT_ALLOWED_BLOCK_TYPES = new Set(['Container', 'ColumnsContainer']);

const SaveLayoutSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(NAME_MAX_LENGTH, `name must be at most ${NAME_MAX_LENGTH} characters`),
  description: z
    .string()
    .max(DESCRIPTION_MAX_LENGTH, `description must be at most ${DESCRIPTION_MAX_LENGTH} characters`)
    .optional(),
  tags: tagsSchema,
  blocks: z
    .array(z.object({ id: z.string().min(1), block: z.unknown() }))
    .min(1, 'blocks array cannot be empty')
    .max(MAX_BLOCKS, `at most ${MAX_BLOCKS} blocks per layout`),
});

const UpdateLayoutSchema = z
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
    { message: 'at least one of name, description, tags, blocks is required' },
  );

type BlockEntry = LibraryBlockEntry;
type LayoutMetadata = LibraryMetadataBase & { shape: LayoutShape };

function layoutsDir(): string {
  return resolve(SKILLS_REFERENCES_DIR, 'layouts');
}
function shapeDir(shape: LayoutShape): string {
  return resolve(layoutsDir(), shape);
}
function layoutFilePath(shape: LayoutShape, id: string): string {
  return resolve(shapeDir(shape), `${id}.ndjson`);
}
function serialiseLayout(meta: LayoutMetadata, entries: BlockEntry[]): string {
  return serialiseLibraryFile(meta, entries);
}

function parseLayoutFile(raw: string): { metadata: LayoutMetadata; entries: BlockEntry[] } {
  const { metadata, entries } = parseLibraryFile<LayoutMetadata>(raw);
  if (typeof metadata.shape !== 'string')
    throw new Error('malformed metadata header: missing shape');
  return { metadata, entries };
}

function deriveLayoutShape(rootBlock: unknown): LayoutShape | null {
  if (typeof rootBlock !== 'object' || rootBlock === null) return null;
  const typed = rootBlock as { type?: unknown; data?: { props?: { columnsCount?: unknown } } };
  if (typed.type === 'Container') return 'container';
  if (typed.type === 'ColumnsContainer') {
    const count = typed.data?.props?.columnsCount;
    if (count === 2) return 'columns-2';
    if (count === 3) return 'columns-3';
  }
  return null;
}

function findFirstNonStructuralType(entries: BlockEntry[]): string | null {
  for (const entry of entries) {
    const block = entry.block as { type?: unknown } | undefined;
    const type = typeof block?.type === 'string' ? block.type : null;
    if (type === null || !LAYOUT_ALLOWED_BLOCK_TYPES.has(type)) return type;
  }
  return null;
}

type LayoutListing = {
  id: string;
  shape: LayoutShape;
  name: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  blockCount: number;
  sizeBytes: number;
  hasThumbnail: boolean;
};

function listLayouts(): LayoutListing[] {
  const dir = layoutsDir();
  if (!existsSync(dir)) return [];
  const out: LayoutListing[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!LAYOUT_SHAPE_VALUES.includes(entry.name as LayoutShape)) continue;
    const shape = entry.name as LayoutShape;
    const dirPath = shapeDir(shape);
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
      let parsed: { metadata: LayoutMetadata; entries: BlockEntry[] };
      try {
        parsed = parseLayoutFile(readFileSync(fullPath, 'utf8'));
      } catch {
        continue;
      }
      out.push({
        id: parsed.metadata.id,
        shape,
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

export const devSaveLayoutPlugin = async function devSaveLayoutPlugin(fastify: FastifyInstance) {
  await fastify.register(multipart, { limits: { fileSize: MAX_THUMBNAIL_BYTES } });

  fastify.post('/dev/save-layout', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    const parsed = await parseSaveRequestWithThumbnail(request, reply, SaveLayoutSchema);
    if (parsed === null) return;
    const { payload: body, thumbnail } = parsed;

    const rootBlock = body.blocks[0]?.block;
    const shape = deriveLayoutShape(rootBlock);
    if (shape === null) {
      return reply.status(400).send({
        error: 'invalid_root_type',
        rootType:
          typeof (rootBlock as { type?: unknown })?.type === 'string'
            ? (rootBlock as { type: string }).type
            : null,
        allowed: Array.from(LAYOUT_ALLOWED_BLOCK_TYPES),
        hint: 'A layout root must be a Container or a ColumnsContainer with columnsCount 2 or 3.',
      });
    }

    const offending = findFirstNonStructuralType(body.blocks as BlockEntry[]);
    if (offending !== null) {
      return reply.status(400).send({
        error: 'non_structural_descendant',
        blockType: offending,
        allowed: Array.from(LAYOUT_ALLOWED_BLOCK_TYPES),
        hint: 'Layouts may only contain Container and ColumnsContainer blocks. Save this subtree as a section instead.',
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

    const metadata: LayoutMetadata = {
      id,
      shape,
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
      ndjson = serialiseLayout(metadata, entries);
    } catch (err) {
      if (err instanceof PayloadTooLargeError)
        return reply
          .status(413)
          .send({
            error: 'payload_too_large',
            limitBytes: MAX_NDJSON_BYTES,
            actualBytes: err.bytes,
          });
      throw err;
    }

    if (thumbnail) {
      try {
        writeThumbnailFile(
          getThumbnailPath('layouts', shape, id, thumbnail.format),
          thumbnail.bytes,
        );
      } catch (err) {
        if (err instanceof ThumbnailTooLargeError)
          return reply
            .status(413)
            .send({ error: 'thumbnail_too_large', limitBytes: err.limit, actualBytes: err.bytes });
        return reply.status(500).send({
          error: 'write_failed',
          message: err instanceof Error ? err.message : 'unknown thumbnail write error',
        });
      }
    }

    try {
      const dir = shapeDir(shape);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(layoutFilePath(shape, id), ndjson, 'utf8');
    } catch (err) {
      if (thumbnail) deleteThumbnailFile(getThumbnailPath('layouts', shape, id, thumbnail.format));
      return reply
        .status(500)
        .send({
          error: 'write_failed',
          message: err instanceof Error ? err.message : 'unknown write error',
        });
    }

    return reply.send({
      id,
      name: metadata.name,
      description: metadata.description,
      shape: metadata.shape,
      tags: metadata.tags ?? [],
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      blockCount: entries.length,
      droppedRefs,
      hasThumbnail: thumbnail !== null,
      saved: `layouts/${shape}/${id}.ndjson`,
    });
  });

  fastify.get('/dev/layouts', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    return reply.send({ layouts: listLayouts() });
  });

  fastify.get<{ Params: { shape: string; id: string } }>(
    '/dev/layouts/:shape/:id',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const { shape, id } = request.params;
      if (!LAYOUT_SHAPE_VALUES.includes(shape as LayoutShape))
        return reply.status(400).send({ error: 'invalid_shape', shape });
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });
      const path = layoutFilePath(shape as LayoutShape, id);
      if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', shape, id });
      let raw: string;
      try {
        raw = readFileSync(path, 'utf8');
      } catch (err) {
        return reply
          .status(500)
          .send({
            error: 'read_failed',
            message: err instanceof Error ? err.message : 'unknown read error',
          });
      }
      let parsed: { metadata: LayoutMetadata; entries: BlockEntry[] };
      try {
        parsed = parseLayoutFile(raw);
      } catch (err) {
        return reply
          .status(500)
          .send({
            error: 'malformed_file',
            message: err instanceof Error ? err.message : 'malformed file',
          });
      }
      return reply.send({
        id: parsed.metadata.id,
        shape: parsed.metadata.shape,
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

  fastify.put<{ Params: { shape: string; id: string } }>(
    '/dev/layouts/:shape/:id',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const { shape, id } = request.params;
      if (!LAYOUT_SHAPE_VALUES.includes(shape as LayoutShape))
        return reply.status(400).send({ error: 'invalid_shape', shape });
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

      let body: z.infer<typeof UpdateLayoutSchema>;
      try {
        body = UpdateLayoutSchema.parse(request.body);
      } catch (err) {
        if (err instanceof z.ZodError)
          return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
        return reply.status(400).send({ error: 'invalid_json' });
      }

      const path = layoutFilePath(shape as LayoutShape, id);
      if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', shape, id });
      let raw: string;
      try {
        raw = readFileSync(path, 'utf8');
      } catch (err) {
        return reply
          .status(500)
          .send({
            error: 'read_failed',
            message: err instanceof Error ? err.message : 'unknown read error',
          });
      }
      let parsed: { metadata: LayoutMetadata; entries: BlockEntry[] };
      try {
        parsed = parseLayoutFile(raw);
      } catch (err) {
        return reply
          .status(500)
          .send({
            error: 'malformed_file',
            message: err instanceof Error ? err.message : 'malformed file',
          });
      }

      if (body.blocks !== undefined) {
        const newRoot = body.blocks[0]?.block;
        const newShape = deriveLayoutShape(newRoot);
        if (newShape === null) {
          return reply.status(400).send({
            error: 'invalid_root_type',
            rootType:
              typeof (newRoot as { type?: unknown })?.type === 'string'
                ? (newRoot as { type: string }).type
                : null,
            allowed: Array.from(LAYOUT_ALLOWED_BLOCK_TYPES),
          });
        }
        if (newShape !== shape) {
          return reply.status(400).send({
            error: 'shape_change_not_allowed',
            currentShape: shape,
            newShape,
            hint: 'Delete the layout and create a new one to change its shape.',
          });
        }
        const offending = findFirstNonStructuralType(body.blocks as BlockEntry[]);
        if (offending !== null) {
          return reply.status(400).send({
            error: 'non_structural_descendant',
            blockType: offending,
            allowed: Array.from(LAYOUT_ALLOWED_BLOCK_TYPES),
            hint: 'Layouts may only contain Container and ColumnsContainer blocks.',
          });
        }
      }

      const nextMetadata: LayoutMetadata = { ...parsed.metadata, updatedAt: nowIso() };
      if (body.name !== undefined) nextMetadata.name = body.name.trim();
      if (body.description !== undefined) {
        if (body.description === '') delete nextMetadata.description;
        else nextMetadata.description = body.description;
      }
      if (body.tags !== undefined) {
        const normalized = normalizeTags(body.tags);
        if (normalized) nextMetadata.tags = normalized;
        else delete nextMetadata.tags;
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
        ndjson = serialiseLayout(nextMetadata, nextEntries);
      } catch (err) {
        if (err instanceof PayloadTooLargeError)
          return reply
            .status(413)
            .send({
              error: 'payload_too_large',
              limitBytes: MAX_NDJSON_BYTES,
              actualBytes: err.bytes,
            });
        throw err;
      }

      try {
        writeFileSync(path, ndjson, 'utf8');
      } catch (err) {
        return reply
          .status(500)
          .send({
            error: 'write_failed',
            message: err instanceof Error ? err.message : 'unknown write error',
          });
      }

      return reply.send({
        id: nextMetadata.id,
        shape: nextMetadata.shape,
        name: nextMetadata.name,
        description: nextMetadata.description,
        tags: nextMetadata.tags ?? [],
        createdAt: nextMetadata.createdAt,
        updatedAt: nextMetadata.updatedAt,
        blockCount: nextEntries.length,
        droppedRefs,
      });
    },
  );

  fastify.delete<{ Params: { shape: string; id: string } }>(
    '/dev/layouts/:shape/:id',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const { shape, id } = request.params;
      if (!LAYOUT_SHAPE_VALUES.includes(shape as LayoutShape))
        return reply.status(400).send({ error: 'invalid_shape', shape });
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });
      const path = layoutFilePath(shape as LayoutShape, id);
      if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', shape, id });
      try {
        unlinkSync(path);
      } catch (err) {
        return reply
          .status(500)
          .send({
            error: 'delete_failed',
            message: err instanceof Error ? err.message : 'unknown unlink error',
          });
      }
      deleteThumbnailFile(getThumbnailPath('layouts', shape as LayoutShape, id, 'webp'));
      deleteThumbnailFile(getThumbnailPath('layouts', shape as LayoutShape, id, 'png'));
      return reply.send({ deleted: `layouts/${shape}/${id}.ndjson`, shape, id });
    },
  );

  fastify.get<{ Params: { shape: string; id: string } }>(
    '/dev/layouts/:shape/:id/thumbnail',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const { shape, id } = request.params;
      if (!LAYOUT_SHAPE_VALUES.includes(shape as LayoutShape))
        return reply.status(400).send({ error: 'invalid_shape', shape });
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });
      const candidates: Array<{ filePath: string; contentType: string }> = [
        {
          filePath: getThumbnailPath('layouts', shape as LayoutShape, id, 'webp'),
          contentType: 'image/webp',
        },
        {
          filePath: getThumbnailPath('layouts', shape as LayoutShape, id, 'png'),
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
        return reply.status(404).send({ error: 'thumbnail_not_found', shape, id });
      const etag = `W/"${chosen.stats.size}-${Math.floor(chosen.stats.mtimeMs)}"`;
      if (request.headers['if-none-match'] === etag)
        return reply
          .status(304)
          .headers({ ETag: etag, 'Cache-Control': 'public, max-age=300' })
          .send();
      const buffer = readThumbnailFile(chosen.filePath);
      if (buffer === null)
        return reply.status(404).send({ error: 'thumbnail_not_found', shape, id });
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
