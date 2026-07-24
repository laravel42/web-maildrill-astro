/**
 * L42-306 — Theme bundle gallery endpoints.
 *
 *   POST   /dev/save-theme               — save the current theme bundle
 *   GET    /dev/themes                   — list saved themes (metadata only)
 *   GET    /dev/themes/:id               — fetch a full theme bundle
 *   PUT    /dev/themes/:id               — partial update (name / description / payload)
 *   DELETE /dev/themes/:id               — remove a saved theme
 *
 * Themes are persisted as JSON files under
 *
 *   skills/email-builder/references/themes/{uuid}.json
 *
 * Identity is server-minted UUID v4. Clients never propose ids on POST
 * — they only receive the id back to use in subsequent calls. The
 * `name` is metadata only; two themes can share a name (the gallery
 * surfaces both and lets the user disambiguate via description).
 *
 * Endpoint gating mirrors `dev-save-section`: open in non-production,
 * closed in production unless `EB_ENABLE_SAVE_COMPONENTS=true`. The env
 * var name is intentionally shared across both libraries.
 *
 * Listing strategy: read-on-list (decision #7 in
 * `plan-theme-export-import.md`). The handler opens each file, parses
 * just the metadata fields, and returns a flat array. For ≤500 small
 * files on a local disk this is sub-millisecond. Migrate to a sidecar
 * `_index.json` manifest when scale warrants.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

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

/**
 * Cap on the JSON serialised bundle. A theme is small (≤a few KB
 * normally) — this guard catches accidentally-huge `blocks` payloads
 * before they hit disk.
 */
const MAX_THEME_JSON_BYTES = 64 * 1024;

const ColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'must be a #RRGGBB color')
  .nullable()
  .optional();

const GlobalsSchema = z
  .object({
    backdropColor: ColorSchema,
    borderColor: ColorSchema,
    borderRadius: z.number().nullable().optional(),
    canvasColor: ColorSchema,
    textColor: ColorSchema,
    fontFamily: z.string().nullable().optional(),
    linkGlobal: z
      .object({
        linkColor: ColorSchema,
        underline: z.boolean(),
      })
      .nullable()
      .optional(),
  })
  .partial();

const BundlePayloadSchema = z.object({
  globals: GlobalsSchema.optional(),
  blocks: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

const SaveThemeBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'name is required')
    .max(NAME_MAX_LENGTH, `name must be at most ${NAME_MAX_LENGTH} characters`),
  description: z
    .string()
    .max(DESCRIPTION_MAX_LENGTH, `description must be at most ${DESCRIPTION_MAX_LENGTH} characters`)
    .optional(),
  bundle: BundlePayloadSchema,
});

const UpdateThemeBodySchema = z
  .object({
    name: z.string().trim().min(1).max(NAME_MAX_LENGTH).optional(),
    description: z.string().max(DESCRIPTION_MAX_LENGTH).optional(),
    bundle: BundlePayloadSchema.optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined || v.bundle !== undefined, {
    message: 'at least one of name, description, bundle is required',
  });

/**
 * On-disk shape. Mirrors the client-side `themeBundleSchema` minus the
 * `version` field (decision #4: no bundle versioning).
 */
type ThemeBundleFile = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  description?: string;
  globals?: z.infer<typeof GlobalsSchema>;
  blocks?: Record<string, Record<string, unknown>>;
};

function themesDir(): string {
  return resolve(SKILLS_REFERENCES_DIR, 'themes');
}

function themeFilePath(id: string): string {
  return resolve(themesDir(), `${id}.json`);
}

function readThemeFile(id: string): ThemeBundleFile | null {
  const path = themeFilePath(id);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw) as ThemeBundleFile;
}

function writeThemeFile(file: ThemeBundleFile): { json: string; bytes: number } {
  const dir = themesDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const json = JSON.stringify(file, null, 2);
  const bytes = Buffer.byteLength(json, 'utf8');
  if (bytes > MAX_THEME_JSON_BYTES) {
    throw new PayloadTooLargeError(bytes);
  }
  writeFileSync(themeFilePath(file.id), json, 'utf8');
  return { json, bytes };
}

class PayloadTooLargeError extends Error {
  constructor(public readonly bytes: number) {
    super(`theme bundle exceeds ${MAX_THEME_JSON_BYTES} bytes (got ${bytes})`);
  }
}

/**
 * Filesystem-derived metadata for the listing endpoint. Now also
 * includes the actual `globals` and `blocks` payload so the frontend
 * can render a CSS swatch (primary/canvas/backdrop colors, fonts,
 * button sample) per card without a second fetch — and so the hover
 * Popper (Task 11) can apply the bundle to a working copy of the
 * document on demand. Theme bundles are capped at 64 KB; typical
 * bundles are 1–3 KB, so even 50 themes fit in well under a MB
 * over the wire.
 */
type ThemeListing = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  sizeBytes: number;
  globals?: z.infer<typeof GlobalsSchema>;
  blocks?: Record<string, Record<string, unknown>>;
};

function listThemes(): ThemeListing[] {
  const dir = themesDir();
  if (!existsSync(dir)) return [];

  const out: ThemeListing[] = [];
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }

  for (const file of files) {
    const id = file.replace(/\.json$/, '');
    if (!isValidUuid(id)) continue;
    const fullPath = resolve(dir, file);
    let stats;
    try {
      stats = statSync(fullPath);
    } catch {
      continue;
    }
    let parsed: ThemeBundleFile;
    try {
      const raw = readFileSync(fullPath, 'utf8');
      parsed = JSON.parse(raw) as ThemeBundleFile;
      if (typeof parsed.id !== 'string' || typeof parsed.name !== 'string') continue;
    } catch {
      continue;
    }
    out.push({
      id: parsed.id,
      name: parsed.name,
      description: parsed.description,
      createdAt: parsed.createdAt,
      updatedAt: parsed.updatedAt,
      sizeBytes: stats.size,
      globals: parsed.globals,
      blocks: parsed.blocks,
    });
  }

  out.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return out;
}

export const devSaveThemePlugin = async function devSaveThemePlugin(fastify: FastifyInstance) {
  fastify.post('/dev/save-theme', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);

    let body: z.infer<typeof SaveThemeBodySchema>;
    try {
      body = SaveThemeBodySchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
      }
      return reply.status(400).send({ error: 'invalid_json' });
    }

    const id = newId();
    const now = nowIso();
    const file: ThemeBundleFile = {
      id,
      createdAt: now,
      updatedAt: now,
      name: body.name.trim(),
      ...(body.description ? { description: body.description } : {}),
      ...(body.bundle.globals ? { globals: body.bundle.globals } : {}),
      ...(body.bundle.blocks ? { blocks: body.bundle.blocks } : {}),
    };

    try {
      const { bytes } = writeThemeFile(file);
      return reply.send({
        id,
        name: file.name,
        description: file.description,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        sizeBytes: bytes,
        saved: `themes/${id}.json`,
      });
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        return reply
          .status(413)
          .send({ error: 'payload_too_large', limitBytes: MAX_THEME_JSON_BYTES, actualBytes: err.bytes });
      }
      const message = err instanceof Error ? err.message : 'unknown write error';
      return reply.status(500).send({ error: 'write_failed', message });
    }
  });

  fastify.get('/dev/themes', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    return reply.send({ themes: listThemes() });
  });

  fastify.get<{ Params: { id: string } }>('/dev/themes/:id', async (request, reply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    const id = request.params.id;
    if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

    let file: ThemeBundleFile | null;
    try {
      file = readThemeFile(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown read error';
      return reply.status(500).send({ error: 'read_failed', message });
    }
    if (!file) return reply.status(404).send({ error: 'not_found', id });

    return reply.send(file);
  });

  fastify.put<{ Params: { id: string } }>('/dev/themes/:id', async (request, reply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    const id = request.params.id;
    if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

    let body: z.infer<typeof UpdateThemeBodySchema>;
    try {
      body = UpdateThemeBodySchema.parse(request.body);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
      }
      return reply.status(400).send({ error: 'invalid_json' });
    }

    let existing: ThemeBundleFile | null;
    try {
      existing = readThemeFile(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown read error';
      return reply.status(500).send({ error: 'read_failed', message });
    }
    if (!existing) return reply.status(404).send({ error: 'not_found', id });

    const next: ThemeBundleFile = {
      ...existing,
      updatedAt: nowIso(),
    };
    if (body.name !== undefined) next.name = body.name.trim();
    if (body.description !== undefined) {
      if (body.description === '') {
        delete next.description;
      } else {
        next.description = body.description;
      }
    }
    if (body.bundle !== undefined) {
      if (body.bundle.globals !== undefined) {
        if (Object.keys(body.bundle.globals).length === 0) {
          delete next.globals;
        } else {
          next.globals = body.bundle.globals;
        }
      }
      if (body.bundle.blocks !== undefined) {
        if (Object.keys(body.bundle.blocks).length === 0) {
          delete next.blocks;
        } else {
          next.blocks = body.bundle.blocks;
        }
      }
    }

    try {
      const { bytes } = writeThemeFile(next);
      return reply.send({
        id: next.id,
        name: next.name,
        description: next.description,
        createdAt: next.createdAt,
        updatedAt: next.updatedAt,
        sizeBytes: bytes,
      });
    } catch (err) {
      if (err instanceof PayloadTooLargeError) {
        return reply
          .status(413)
          .send({ error: 'payload_too_large', limitBytes: MAX_THEME_JSON_BYTES, actualBytes: err.bytes });
      }
      const message = err instanceof Error ? err.message : 'unknown write error';
      return reply.status(500).send({ error: 'write_failed', message });
    }
  });

  fastify.delete<{ Params: { id: string } }>('/dev/themes/:id', async (request, reply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    const id = request.params.id;
    if (!isValidUuid(id)) return reply.status(400).send({ error: 'invalid_id', id });

    const path = themeFilePath(id);
    if (!existsSync(path)) return reply.status(404).send({ error: 'not_found', id });

    try {
      unlinkSync(path);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown unlink error';
      return reply.status(500).send({ error: 'delete_failed', message });
    }

    return reply.send({ deleted: `themes/${id}.json`, id });
  });
};
