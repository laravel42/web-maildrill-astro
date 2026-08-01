/**
 * L42-309 — Primitives library endpoints.
 *
 *   POST   /dev/save-primitive               — save a single non-container block as a primitive
 *   GET    /dev/primitives                   — list saved primitives across all types
 *   GET    /dev/primitives/:type/:id         — fetch a full primitive
 *   PUT    /dev/primitives/:type/:id         — partial update (name / description / block)
 *   DELETE /dev/primitives/:type/:id         — delete a saved primitive
 *
 * Primitives are persisted as NDJSON files under
 *
 *   skills/email-builder/references/primitives/{type}/{uuid}.ndjson
 *
 * Identical wire format as sections (metadata header on line 1, block
 * entries on subsequent lines). The axis is `type` (kebab-cased block
 * type — `button`, `notion-text`, `image`, …). The backend derives
 * `type` from `blocks[0].block.type` so the client just sends the
 * block itself.
 *
 * A primitive is a SINGLE block whose runtime `type` is NOT one of
 * `{Container, ColumnsContainer, EmailLayout}` — those structural
 * types belong to Layouts / Sections / Templates instead.
 *
 * Endpoint gating mirrors `dev-save-section`: open in non-production,
 * closed in production unless `EB_ENABLE_SAVE_COMPONENTS=true`.
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

import {
  type LibraryBlockEntry,
  type LibraryMetadataBase,
  MAX_NDJSON_BYTES,
  normalizeTags,
  parseLibraryFile,
  PayloadTooLargeError,
  renumberBlocks,
  serialiseLibraryFile,
  tagsSchema,
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

const PRIMITIVE_TYPE_VALUES = [
  'button',
  'divider',
  'image',
  'notion-text',
  'social-media',
  'spacer',
] as const;

type PrimitiveType = (typeof PRIMITIVE_TYPE_VALUES)[number];

const BLOCK_TYPE_TO_PRIMITIVE_TYPE: Record<string, PrimitiveType> = {
  Button: 'button',
  Divider: 'divider',
  Image: 'image',
  NotionText: 'notion-text',
  SocialMedia: 'social-media',
  Spacer: 'spacer',
};

const SavePrimitiveSchema = z.object({
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
    .length(1, 'a primitive must contain exactly one block'),
});

const UpdatePrimitiveSchema = z
  .object({
    name: z.string().trim().min(1).max(NAME_MAX_LENGTH).optional(),
    description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
    tags: tagsSchema,
    blocks: z
      .array(z.object({ id: z.string().min(1), block: z.unknown() }))
      .length(1)
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

type PrimitiveMetadata = LibraryMetadataBase & {
  type: PrimitiveType;
};

function primitivesDir(): string {
  return resolve(SKILLS_REFERENCES_DIR, 'primitives');
}

function typeDir(type: PrimitiveType): string {
  return resolve(primitivesDir(), type);
}

function primitiveFilePath(type: PrimitiveType, id: string): string {
  return resolve(typeDir(type), `${id}.ndjson`);
}

function serialisePrimitive(meta: PrimitiveMetadata, entries: BlockEntry[]): string {
  return serialiseLibraryFile(meta, entries);
}

function parsePrimitiveFile(raw: string): { metadata: PrimitiveMetadata; entries: BlockEntry[] } {
  const { metadata, entries } = parseLibraryFile<PrimitiveMetadata>(raw);
  if (typeof metadata.type !== 'string') {
    throw new Error('malformed metadata header: missing type');
  }
  return { metadata, entries };
}

function resolvePrimitiveType(blockType: unknown): PrimitiveType | null {
  if (typeof blockType !== 'string') return null;
  return BLOCK_TYPE_TO_PRIMITIVE_TYPE[blockType] ?? null;
}

type PrimitiveListing = {
  id: string;
  type: PrimitiveType;
  name: string;
  description?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  blockCount: number;
  sizeBytes: number;
  block: unknown;
};

function listPrimitives(): PrimitiveListing[] {
  const dir = primitivesDir();
  if (!existsSync(dir)) return [];

  const out: PrimitiveListing[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!PRIMITIVE_TYPE_VALUES.includes(entry.name as PrimitiveType)) continue;
    const type = entry.name as PrimitiveType;
    const dirPath = typeDir(type);
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
      let parsed: { metadata: PrimitiveMetadata; entries: BlockEntry[] };
      try {
        const raw = readFileSync(fullPath, 'utf8');
        parsed = parsePrimitiveFile(raw);
      } catch {
        continue;
      }
      out.push({
        id: parsed.metadata.id,
        type,
        name: parsed.metadata.name,
        description: parsed.metadata.description,
        tags: parsed.metadata.tags ?? [],
        createdAt: parsed.metadata.createdAt,
        updatedAt: parsed.metadata.updatedAt,
        blockCount: parsed.entries.length,
        sizeBytes: stats.size,
        block: parsed.entries[0]?.block ?? null,
      });
    }
  }

  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return out;
}

export const devSavePrimitivePlugin = async function devSavePrimitivePlugin(
  fastify: FastifyInstance,
) {
  fastify.post('/dev/save-primitive', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);

    let body: z.infer<typeof SavePrimitiveSchema>;
    try {
      body = SavePrimitiveSchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
      }
      return reply.status(400).send({ error: 'invalid_json' });
    }

    const rootBlock = body.blocks[0]?.block as { type?: unknown } | undefined;
    const primitiveType = resolvePrimitiveType(rootBlock?.type);
    if (primitiveType === null) {
      return reply.status(400).send({
        error: 'invalid_root_type',
        rootType: typeof rootBlock?.type === 'string' ? rootBlock.type : null,
        allowed: Object.keys(BLOCK_TYPE_TO_PRIMITIVE_TYPE),
        hint: 'Primitives must be a single non-container block (Button, Divider, Image, NotionText, SocialMedia, Spacer).',
      });
    }

    const id = newId();
    const now = nowIso();
    const metadata: PrimitiveMetadata = {
      id,
      type: primitiveType,
      name: body.name.trim(),
      ...(body.description ? { description: body.description } : {}),
      ...(normalizeTags(body.tags) ? { tags: normalizeTags(body.tags) } : {}),
      createdAt: now,
      updatedAt: now,
    };

    const { entries, droppedRefs } = renumberBlocks(body.blocks as BlockEntry[], id);

    let ndjson: string;
    try {
      ndjson = serialisePrimitive(metadata, entries);
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        return reply.status(413).send({
          error: 'payload_too_large',
          limitBytes: MAX_NDJSON_BYTES,
          actualBytes: err.bytes,
        });
      }
      throw err;
    }

    try {
      const dir = typeDir(primitiveType);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(primitiveFilePath(primitiveType, id), ndjson, 'utf8');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown write error';
      return reply.status(500).send({ error: 'write_failed', message });
    }

    return reply.send({
      id,
      name: metadata.name,
      description: metadata.description,
      type: metadata.type,
      tags: metadata.tags ?? [],
      createdAt: metadata.createdAt,
      updatedAt: metadata.updatedAt,
      blockCount: entries.length,
      droppedRefs,
      saved: `primitives/${primitiveType}/${id}.ndjson`,
    });
  });

  fastify.get('/dev/primitives', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    return reply.send({ primitives: listPrimitives() });
  });

  fastify.get<{ Params: { type: string; id: string } }>(
    '/dev/primitives/:type/:id',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const type = request.params.type;
      const id = request.params.id;

      if (!PRIMITIVE_TYPE_VALUES.includes(type as PrimitiveType)) {
        return reply.status(400).send({ error: 'invalid_type', type });
      }
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

      const path = primitiveFilePath(type as PrimitiveType, id);
      if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', type, id });

      let raw: string;
      try {
        raw = readFileSync(path, 'utf8');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown read error';
        return reply.status(500).send({ error: 'read_failed', message });
      }

      let parsed: { metadata: PrimitiveMetadata; entries: BlockEntry[] };
      try {
        parsed = parsePrimitiveFile(raw);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'malformed file';
        return reply.status(500).send({ error: 'malformed_file', message });
      }

      return reply.send({
        id: parsed.metadata.id,
        type: parsed.metadata.type,
        name: parsed.metadata.name,
        description: parsed.metadata.description,
        tags: parsed.metadata.tags ?? [],
        createdAt: parsed.metadata.createdAt,
        updatedAt: parsed.metadata.updatedAt,
        blocks: parsed.entries,
      });
    },
  );

  fastify.put<{ Params: { type: string; id: string } }>(
    '/dev/primitives/:type/:id',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const type = request.params.type;
      const id = request.params.id;

      if (!PRIMITIVE_TYPE_VALUES.includes(type as PrimitiveType)) {
        return reply.status(400).send({ error: 'invalid_type', type });
      }
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

      let body: z.infer<typeof UpdatePrimitiveSchema>;
      try {
        body = UpdatePrimitiveSchema.parse(request.body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
        }
        return reply.status(400).send({ error: 'invalid_json' });
      }

      const path = primitiveFilePath(type as PrimitiveType, id);
      if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', type, id });

      let raw: string;
      try {
        raw = readFileSync(path, 'utf8');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown read error';
        return reply.status(500).send({ error: 'read_failed', message });
      }

      let parsed: { metadata: PrimitiveMetadata; entries: BlockEntry[] };
      try {
        parsed = parsePrimitiveFile(raw);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'malformed file';
        return reply.status(500).send({ error: 'malformed_file', message });
      }

      if (body.blocks !== undefined) {
        const newRoot = body.blocks[0]?.block as { type?: unknown } | undefined;
        const newType = resolvePrimitiveType(newRoot?.type);
        if (newType === null) {
          return reply.status(400).send({
            error: 'invalid_root_type',
            rootType: typeof newRoot?.type === 'string' ? newRoot.type : null,
            allowed: Object.keys(BLOCK_TYPE_TO_PRIMITIVE_TYPE),
          });
        }
        if (newType !== type) {
          return reply.status(400).send({
            error: 'type_change_not_allowed',
            currentType: type,
            newType,
            hint: 'Delete the primitive and create a new one to change its type.',
          });
        }
      }

      const nextMetadata: PrimitiveMetadata = {
        ...parsed.metadata,
        updatedAt: nowIso(),
      };
      if (body.name !== undefined) nextMetadata.name = body.name.trim();
      if (body.description !== undefined) {
        if (body.description === '') {
          delete nextMetadata.description;
        } else {
          nextMetadata.description = body.description;
        }
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
        ndjson = serialisePrimitive(nextMetadata, nextEntries);
      } catch (err) {
        if (err instanceof PayloadTooLargeError) {
          return reply.status(413).send({
            error: 'payload_too_large',
            limitBytes: MAX_NDJSON_BYTES,
            actualBytes: err.bytes,
          });
        }
        throw err;
      }

      try {
        writeFileSync(path, ndjson, 'utf8');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown write error';
        return reply.status(500).send({ error: 'write_failed', message });
      }

      return reply.send({
        id: nextMetadata.id,
        type: nextMetadata.type,
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

  fastify.delete<{ Params: { type: string; id: string } }>(
    '/dev/primitives/:type/:id',
    async (request, reply) => {
      if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
      const type = request.params.type;
      const id = request.params.id;

      if (!PRIMITIVE_TYPE_VALUES.includes(type as PrimitiveType)) {
        return reply.status(400).send({ error: 'invalid_type', type });
      }
      if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

      const path = primitiveFilePath(type as PrimitiveType, id);
      if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', type, id });

      try {
        unlinkSync(path);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown unlink error';
        return reply.status(500).send({ error: 'delete_failed', message });
      }

      return reply.send({ deleted: `primitives/${type}/${id}.ndjson`, type, id });
    },
  );
};
