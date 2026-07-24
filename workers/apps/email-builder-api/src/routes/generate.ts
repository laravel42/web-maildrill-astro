import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { OutgoingHttpHeaders } from 'node:http';
import { z } from 'zod';

import { buildSystemPrompt } from '../context/system-prompt.js';
import { getProvider as defaultGetProvider, PROVIDER_NAMES, type ProviderName } from '../providers/index.js';
import { buildImagePool, type PoolItem } from '../unsplash/build-image-pool.js';
import { type DailyQuota, dailyQuota as defaultDailyQuota } from '../unsplash/daily-quota.js';

import { expandImageTokens, type ExpandState } from './expand-image-tokens.js';
import { tryRepairJsonLine } from './json-repair.js';
import { normalizeBlockPayload } from './normalize-block.js';

const GenerateBodySchema = z.object({
  prompt: z.string().min(1, 'prompt is required'),
  provider: z.enum(PROVIDER_NAMES as unknown as [ProviderName, ...ProviderName[]]).optional(),
  model: z.string().min(1).optional(),
  maxTokens: z.number().int().positive().optional(),
  currentDocument: z.unknown().optional(),
  variationSeed: z.number().int().min(0).max(999).optional(),
});

export type GenerateBody = z.infer<typeof GenerateBodySchema>;

function resolveProvider(explicit: ProviderName | undefined): ProviderName {
  if (explicit) return explicit;
  const fromEnv = process.env.DEFAULT_PROVIDER;
  if (fromEnv && (PROVIDER_NAMES as readonly string[]).includes(fromEnv)) {
    return fromEnv as ProviderName;
  }
  return 'openai';
}

function isValidJsonLine(line: string): boolean {
  try {
    JSON.parse(line);
    return true;
  } catch {
    return false;
  }
}

const VALID_BLOCK_TYPES = new Set([
  'EmailLayout',
  'Container',
  'ColumnsContainer',
  'NotionText',
  'Button',
  'Image',
  'Divider',
  'Spacer',
  'SocialMedia',
]);

function extractBlockType(parsed: Record<string, unknown> | null): string | undefined {
  if (!parsed) return undefined;
  const block = parsed.block;
  if (block === null || typeof block !== 'object') return undefined;
  const type = (block as Record<string, unknown>).type;
  return typeof type === 'string' ? type : undefined;
}

const TOKEN_FALLBACKS: Record<string, string> = {
  '{{ACCENT}}': '#0254FB',
  '{{ACCENT_TEXT}}': '#FFFFFF',
  '{{TEXT}}': '#1A1A1A',
  '{{MUTED_TEXT}}': '#6B7280',
  '{{CANVAS}}': '#FFFFFF',
  '{{BORDER}}': '#E5E7EB',
};
const TOKEN_RE = /\{\{[A-Z_]+\}\}/g;
const SLUG_RE = /REPLACE-WITH-SEMANTIC-SLUG/g;

function applyRecipeSafetyNet(line: string): string {
  let patched = line;
  let warned = false;
  if (TOKEN_RE.test(patched)) {
    console.warn('[safety-net] Unsubstituted recipe token(s) detected in NDJSON output');
    warned = true;
    patched = patched.replace(TOKEN_RE, (m) => TOKEN_FALLBACKS[m] ?? '#0254FB');
  }
  if (SLUG_RE.test(patched)) {
    if (!warned) console.warn('[safety-net] Unsubstituted REPLACE-WITH-SEMANTIC-SLUG in NDJSON output');
    patched = patched.replace(SLUG_RE, 'generic-email-content');
  }
  return patched;
}

export interface CreateGenerateRouteOptions {
  getProvider?: typeof defaultGetProvider;
  buildImagePool?: typeof buildImagePool;
  quota?: DailyQuota;
  aiQuotaCost?: number;
}

/**
 * Write a single SSE frame to the raw Node response.
 * Fastify's `reply.raw` gives us the underlying `http.ServerResponse`.
 */
function writeSSE(raw: import('node:http').ServerResponse, event: string | undefined, data: string): void {
  if (event) raw.write(`event: ${event}\n`);
  raw.write(`data: ${data}\n\n`);
}

export function createGenerateRoute(options: CreateGenerateRouteOptions = {}) {
  const getProvider = options.getProvider ?? defaultGetProvider;
  const resolvePool = options.buildImagePool ?? buildImagePool;
  const quota = options.quota ?? defaultDailyQuota;
  const aiQuotaCost = options.aiQuotaCost ?? 5;

  return async function generatePlugin(fastify: FastifyInstance) {
    fastify.post('/generate', async (request: FastifyRequest, reply: FastifyReply) => {
      let body: GenerateBody;
      try {
        body = GenerateBodySchema.parse(request.body);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ error: 'invalid_request', issues: error.issues });
        }
        return reply.status(400).send({ error: 'invalid_json' });
      }

      const providerName = resolveProvider(body.provider);
      const model = body.model ?? undefined;
      const provider = getProvider(providerName);
      const variationSeed =
        body.currentDocument !== undefined ? undefined : (body.variationSeed ?? Math.floor(Math.random() * 1000));

      let imagePool: PoolItem[] = [];
      let poolSkipReason: 'refinement' | 'quota' | 'no-prompt' | null = null;
      if (body.currentDocument !== undefined && body.currentDocument !== null) {
        poolSkipReason = 'refinement';
      } else if (!body.prompt.trim()) {
        poolSkipReason = 'no-prompt';
      } else if (aiQuotaCost > 0 && !quota.tryConsume('ai', aiQuotaCost)) {
        poolSkipReason = 'quota';
      } else {
        try {
          const result = await resolvePool(body.prompt);
          imagePool = result.items;
        } catch (error) {
          console.warn('[generate] buildImagePool threw; falling back to picsum', error);
        }
      }

      const systemPrompt = buildSystemPrompt({
        currentDocument: body.currentDocument,
        userPrompt: body.prompt,
        variationSeed,
        imagePool,
      });

      const llmStream = provider.stream({
        system: systemPrompt,
        prompt: body.prompt,
        model,
        maxTokens: body.maxTokens,
      });

      // Hijack the response so Fastify doesn't try to serialize/end it.
      // We'll write SSE frames manually via `reply.raw`.
      reply.hijack();

      const raw = reply.raw;
      // hijack() bypasses Fastify's header flushing, so headers set by plugins
      // (CORS, security headers) never reach the client unless merged in by
      // hand. They spread FIRST and the SSE headers last: spreading them last
      // would let a `content-type` already on the reply override
      // `text/event-stream` and break the stream outright.
      // Cast: Fastify's header map allows numeric values, which Node's
      // narrowed well-known header keys reject at the type level even though
      // writeHead accepts them at runtime.
      const sseHeaders = {
        ...reply.getHeaders(),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      } as OutgoingHttpHeaders;
      raw.writeHead(200, sseHeaders);

      const reader = llmStream.getReader();
      let aborted = false;
      request.raw.on('close', () => {
        if (!raw.writableEnded) {
          aborted = true;
          reader.cancel().catch(() => {});
        }
      });

      // Emit info event
      writeSSE(
        raw,
        'info',
        JSON.stringify({
          type: 'image_pool',
          status: poolSkipReason ?? (imagePool.length > 0 ? 'ready' : 'unavailable'),
          itemCount: imagePool.length,
          quotaRemaining: quota.remaining('ai'),
        })
      );

      let streamBuffer = '';
      const seenIds = new Set<string>();
      const expandState: ExpandState = { usedIds: new Set<string>() };
      let firstJsonEmitted = false;

      const emitLine = (rawLine: string): void => {
        const line = rawLine.trim();
        if (!line) return;

        if (line === '```' || line.startsWith('```') || line.endsWith('```')) return;

        let workingLine = line;
        if (!isValidJsonLine(workingLine)) {
          if (!firstJsonEmitted) return;
          const repaired = tryRepairJsonLine(workingLine);
          if (repaired !== null) {
            workingLine = repaired;
            writeSSE(
              raw,
              'warning',
              JSON.stringify({
                type: 'json_repaired',
                action: 'balanced_closing_braces',
                originalLength: line.length,
                repairedLength: repaired.length,
              })
            );
          } else {
            writeSSE(raw, 'warning', JSON.stringify({ type: 'malformed_line', line }));
            return;
          }
        }

        let parsed: Record<string, unknown> | null = null;
        try {
          const obj = JSON.parse(workingLine);
          if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
            parsed = obj as Record<string, unknown>;
          }
        } catch {
          /* ignore */
        }

        const parsedId = parsed && typeof parsed.id === 'string' ? (parsed.id as string) : undefined;

        const blockType = extractBlockType(parsed);
        if (blockType !== undefined && !VALID_BLOCK_TYPES.has(blockType)) {
          writeSSE(
            raw,
            'warning',
            JSON.stringify({
              type: 'invalid_block_type',
              id: parsedId,
              blockType,
              action: 'dropped',
            })
          );
          return;
        }

        if (parsedId !== undefined && parsed !== null) {
          if (seenIds.has(parsedId)) {
            writeSSE(raw, 'warning', JSON.stringify({ type: 'duplicate_id', id: parsedId, action: 'dropped' }));
            return;
          }
          seenIds.add(parsedId);
        }

        let outboundLine = workingLine;
        if (parsed !== null) {
          const { block: normalized, changes } = normalizeBlockPayload(parsed);
          if (changes.length > 0) {
            parsed = normalized as Record<string, unknown>;
            outboundLine = JSON.stringify(normalized);
            writeSSE(raw, 'warning', JSON.stringify({ type: 'coerced_fields', id: parsedId, changes }));
          }
        }

        if (parsed !== null && imagePool.length > 0) {
          const expand = expandImageTokens(parsed, imagePool, expandState);
          if (expand.changed) outboundLine = JSON.stringify(parsed);
        }

        firstJsonEmitted = true;
        writeSSE(raw, undefined, applyRecipeSafetyNet(outboundLine));
      };

      try {
        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          streamBuffer += value;

          let nl: number;
          while ((nl = streamBuffer.indexOf('\n')) !== -1) {
            const line = streamBuffer.slice(0, nl);
            streamBuffer = streamBuffer.slice(nl + 1);
            emitLine(line);
          }
        }

        if (!aborted && streamBuffer.length > 0) {
          emitLine(streamBuffer);
          streamBuffer = '';
        }

        if (!aborted) {
          writeSSE(raw, 'done', '{"status":"complete"}');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown stream error';
        writeSSE(raw, 'error', JSON.stringify({ error: message }));
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* already released */
        }
        raw.end();
      }
    });
  };
}

/** Default plugin instance mounted by `src/index.ts`. */
export const generatePlugin = createGenerateRoute();
