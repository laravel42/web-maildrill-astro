/**
 * Dev-only seed feed for the one-off template importer.
 *
 *   GET /dev/template-seeds
 *
 * Reads the repo-root `email-builder-templates.json`, keeps only the
 * `enhanced` entries (their `design` is already a builder
 * `TReaderDocument` rooted at an `EmailLayout`; `legacy` Unlayer rows
 * are not renderable here), and returns the minimum the browser-side
 * runner needs: `{ name, tags, design }`.
 *
 * `tags` merges the raw `tags` array (JSON-encoded string in the
 * source) plus `industry`, each trimmed/capped to the save route's
 * `TAG_MAX_LENGTH` and limited to `MAX_TAGS` so a downstream
 * `/dev/save-template` never 400s on tag validation. `usage` is
 * returned as its OWN field (the template axis), not folded into tags.
 *
 * Same gate as the other dev library routes: open in non-production.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { MAX_TAGS, TAG_MAX_LENGTH } from './dev-library-ndjson.js';
import { SKILLS_REFERENCES_DIR } from './dev-library-paths.js';
import { DISABLED_RESPONSE_BODY, isLibraryEndpointEnabled } from './dev-library-shared.js';

const ROOT_TEMPLATES_FILE = resolve(
  SKILLS_REFERENCES_DIR,
  '../../..',
  'email-builder-templates.json',
);

/** Max length of the `usage` axis, mirrors USAGE_MAX_LENGTH in dev-save-template. */
const USAGE_MAX_LENGTH = 48;

function buildTags(entry: Record<string, unknown>): string[] {
  const raw: string[] = [];
  if (typeof entry.tags === 'string') {
    try {
      const parsed: unknown = JSON.parse(entry.tags);
      if (Array.isArray(parsed)) for (const t of parsed) if (typeof t === 'string') raw.push(t);
    } catch {
      /* ignore malformed tags string */
    }
  }
  if (typeof entry.industry === 'string') raw.push(entry.industry);

  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const v = t.trim().slice(0, TAG_MAX_LENGTH);
    const key = v.toLowerCase();
    if (v.length === 0 || seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

/** Extract the template `usage` axis (the email's purpose) from a seed entry. */
function buildUsage(entry: Record<string, unknown>): string | undefined {
  if (typeof entry.usage !== 'string') return undefined;
  const v = entry.usage.trim().slice(0, USAGE_MAX_LENGTH);
  return v.length > 0 ? v : undefined;
}

export const devTemplateSeedsPlugin = async function devTemplateSeedsPlugin(
  fastify: FastifyInstance,
) {
  fastify.get('/dev/template-seeds', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!isLibraryEndpointEnabled()) return reply.status(403).send(DISABLED_RESPONSE_BODY);
    if (!existsSync(ROOT_TEMPLATES_FILE)) {
      return reply.status(404).send({ error: 'not_found', file: 'email-builder-templates.json' });
    }

    let arr: unknown;
    try {
      arr = JSON.parse(readFileSync(ROOT_TEMPLATES_FILE, 'utf8'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown read/parse error';
      return reply.status(500).send({ error: 'read_failed', message });
    }
    if (!Array.isArray(arr)) return reply.status(500).send({ error: 'malformed_file' });

    const seeds: Array<{ name: string; tags: string[]; usage?: string; design: string }> = [];
    for (const item of arr as Array<Record<string, unknown>>) {
      if (!item || item.type !== 'enhanced') continue;
      if (typeof item.design !== 'string' || typeof item.name !== 'string') continue;
      seeds.push({
        name: item.name,
        tags: buildTags(item),
        usage: buildUsage(item),
        design: item.design,
      });
    }

    return reply.send({ count: seeds.length, seeds });
  });
};
