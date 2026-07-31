/**
 * Agent API: audit, full quality report (with optional LLM critique), refine brief.
 *
 * Mounted under `/api` alongside generate. All handlers validate with zod
 * inside the route (same pattern as the rest of email-builder-api).
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { buildQualityReport } from '../agent/report.js';
import { compileRefineBrief } from '../agent/refine.js';
import { analyzeTemplate, isSendReady, type EditorDocument } from '../audit/index.js';
import { getProvider as defaultGetProvider, PROVIDER_NAMES, type ProviderName } from '../providers/index.js';
import { RefineBriefSchema } from '../wizard/brief-schema.js';

const DocumentBodySchema = z.object({
  document: z.record(z.string(), z.unknown()),
  subject: z.string().max(200).optional(),
  preheader: z.string().max(300).optional(),
  renderedHtmlBytes: z.number().int().nonnegative().optional(),
  suppress: z.array(z.string()).max(40).optional(),
  provider: z.enum(PROVIDER_NAMES as unknown as [ProviderName, ...ProviderName[]]).optional(),
  model: z.string().min(1).optional(),
  /** When true, skip the LLM design pass (deterministic only). */
  skipLlm: z.boolean().optional(),
  brief: z.string().max(1200).optional(),
  locale: z.string().max(16).optional(),
});

const RefineBodySchema = z.object({
  brief: RefineBriefSchema,
  provider: z.enum(PROVIDER_NAMES as unknown as [ProviderName, ...ProviderName[]]).optional(),
  model: z.string().min(1).optional(),
});

export interface CreateAgentRouteOptions {
  getProvider?: typeof defaultGetProvider;
}

export function createAgentRoute(options: CreateAgentRouteOptions = {}) {
  return async function agentPlugin(fastify: FastifyInstance) {
    /**
     * Deterministic quality audit only — free, fast, no LLM.
     * POST /api/audit
     */
    fastify.post('/audit', async (request: FastifyRequest, reply: FastifyReply) => {
      let body: z.infer<typeof DocumentBodySchema>;
      try {
        body = DocumentBodySchema.parse(request.body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
        }
        return reply.status(400).send({ error: 'invalid_json' });
      }

      try {
        const { report } = analyzeTemplate(body.document as EditorDocument, {
          subject: body.subject,
          preheader: body.preheader,
          renderedHtmlBytes: body.renderedHtmlBytes,
          suppress: body.suppress,
        });
        return reply.send({
          report,
          sendReady: isSendReady(report),
          clientWeaknesses: report.findings
            .filter((f) => f.dimension === 'clientCompatibility' || (f.clients && f.clients.length > 0))
            .slice(0, 10)
            .map((f) => ({
              title: f.title,
              clients: f.clients ?? [],
              fix: f.fix,
              severity: f.severity,
            })),
          designWeaknesses: report.findings
            .filter((f) =>
              [
                'hierarchy',
                'typography',
                'color',
                'spacing',
                'imagery',
                'ctaClarity',
                'content',
                'scanability',
                'consistency',
                'brandSpecificity',
              ].includes(f.dimension),
            )
            .slice(0, 10)
            .map((f) => ({
              title: f.title,
              dimension: f.dimension,
              fix: f.fix,
              severity: f.severity,
            })),
        });
      } catch (err) {
        console.error('[agent/audit] unexpected error', err);
        return reply.status(500).send({ error: 'internal_error' });
      }
    });

    /**
     * Full quality report: deterministic audit + LLM design critique.
     * POST /api/critique
     */
    fastify.post('/critique', async (request: FastifyRequest, reply: FastifyReply) => {
      let body: z.infer<typeof DocumentBodySchema>;
      try {
        body = DocumentBodySchema.parse(request.body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
        }
        return reply.status(400).send({ error: 'invalid_json' });
      }

      try {
        const report = await buildQualityReport(body.document as EditorDocument, {
          subject: body.subject,
          preheader: body.preheader,
          renderedHtmlBytes: body.renderedHtmlBytes,
          suppress: body.suppress,
          skipLlm: body.skipLlm ?? false,
          brief: body.brief,
          locale: body.locale,
          provider: body.provider,
          model: body.model,
          getProvider: options.getProvider ?? defaultGetProvider,
        });
        return reply.send({ report });
      } catch (err) {
        console.error('[agent/critique] unexpected error', err);
        return reply.status(500).send({ error: 'internal_error' });
      }
    });

    /**
     * Compile a refine brief into a generation prompt.
     * POST /api/visual-brief/refine
     */
    fastify.post('/visual-brief/refine', async (request: FastifyRequest, reply: FastifyReply) => {
      let body: z.infer<typeof RefineBodySchema>;
      try {
        body = RefineBodySchema.parse(request.body);
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({ error: 'invalid_request', issues: err.issues });
        }
        return reply.status(400).send({ error: 'invalid_json' });
      }

      try {
        const result = await compileRefineBrief(body.brief, {
          provider: body.provider,
          model: body.model,
          getProvider: options.getProvider ?? defaultGetProvider,
        });
        return reply.send(result);
      } catch (err) {
        console.error('[agent/refine] unexpected error', err);
        return reply.status(500).send({ error: 'internal_error' });
      }
    });
  };
}

export const agentPlugin = createAgentRoute();
