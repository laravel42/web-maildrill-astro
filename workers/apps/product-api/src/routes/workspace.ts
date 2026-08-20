import { z } from 'zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticate } from '@maildrill/authz';
import { ConflictError, NotFoundError, ValidationError } from '@maildrill/domain';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import {
  addMember,
  createApiKey,
  deleteEmailDomain,
  emailDomainsConfigured,
  getWorkspace,
  listApiKeys,
  listEmailDomains,
  listMembers,
  MEMBERSHIP_ROLES,
  registerEmailDomain,
  removeMember,
  revokeApiKey,
  updateMemberRole,
  updateWorkspace,
  verifyEmailDomain,
  type MembershipRole,
} from '@maildrill/services';

const TAG = ['Workspace'];

const roleSchema = z.enum(MEMBERSHIP_ROLES as [MembershipRole, ...MembershipRole[]]);

const settingsPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

function mapError(err: unknown, reply: FastifyReply) {
  if (err instanceof ValidationError) return reply.code(400).send({ error: err.message });
  if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
  if (err instanceof ConflictError) return reply.code(409).send({ error: err.message });
  throw err;
}

/** Mutations are for humans with standing — owner/admin sessions only. */
function requireManager(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.role === 'owner' || req.role === 'admin') return true;
  void reply.code(403).send({ error: 'owner_or_admin_required' });
  return false;
}

export async function workspaceRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.get(
    '/v1/workspace',
    { schema: { tags: TAG, summary: 'Workspace name and settings (branding, AI toggles)' } },
    async (req, reply) => {
      const ws = await getWorkspace(req.tenantId);
      if (!ws) return reply.code(404).send({ error: 'not_found' });
      return ws;
    },
  );

  app.patch(
    '/v1/workspace',
    {
      schema: {
        tags: TAG,
        summary: 'Update workspace name/settings (plain-object settings merge one level)',
        body: settingsPatchSchema,
      },
    },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      try {
        const ws = await updateWorkspace(req.tenantId, req.body);
        if (!ws) return reply.code(404).send({ error: 'not_found' });
        return ws;
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  /* ------------------------------ members ------------------------------- */

  app.get(
    '/v1/workspace/members',
    { schema: { tags: TAG, summary: 'Workspace members with roles' } },
    async (req) => ({ data: await listMembers(req.tenantId) }),
  );

  app.post(
    '/v1/workspace/members',
    {
      schema: {
        tags: TAG,
        summary: 'Add a member by email (account auto-created; passwordless sign-in)',
        body: z.object({ email: z.string().min(3), role: roleSchema }),
      },
    },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      try {
        return await addMember(req.tenantId, req.body);
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.patch(
    '/v1/workspace/members/:userId',
    {
      schema: {
        tags: TAG,
        summary: 'Change a member role (a workspace always keeps one owner)',
        params: z.object({ userId: z.string().uuid() }),
        body: z.object({ role: roleSchema }),
      },
    },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      try {
        return await updateMemberRole(req.tenantId, req.params.userId, req.body.role);
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.delete(
    '/v1/workspace/members/:userId',
    {
      schema: {
        tags: TAG,
        summary: 'Remove a member from the workspace',
        params: z.object({ userId: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      try {
        await removeMember(req.tenantId, req.params.userId);
        return reply.code(204).send();
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  /* ------------------------------ API keys ------------------------------ */

  app.get(
    '/v1/workspace/api-keys',
    { schema: { tags: TAG, summary: 'Workspace API keys (secrets are never returned)' } },
    async (req) => ({ data: await listApiKeys(req.tenantId) }),
  );

  app.post(
    '/v1/workspace/api-keys',
    {
      schema: {
        tags: TAG,
        summary: 'Create an API key — the secret is returned once, here only',
        body: z.object({ name: z.string().min(1).max(80), scope: z.string().optional() }),
      },
    },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      try {
        return await createApiKey(req.tenantId, req.body);
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.delete(
    '/v1/workspace/api-keys/:id',
    {
      schema: {
        tags: TAG,
        summary: 'Revoke an API key (takes effect immediately)',
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      try {
        return await revokeApiKey(req.tenantId, req.params.id);
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  /* ------------------------------- domains ------------------------------ */
  // Infobip domains are account-level; ownership is tenant-scoped in Postgres
  // (see email-domains.ts). Every handler passes req.tenantId.

  app.get(
    '/v1/workspace/domains',
    { schema: { tags: TAG, summary: 'Sending domains with DNS records and verification state' } },
    async (req, reply) => {
      if (!emailDomainsConfigured()) return { data: [], configured: false };
      try {
        return { data: await listEmailDomains(req.tenantId), configured: true };
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.post(
    '/v1/workspace/domains',
    {
      schema: {
        tags: TAG,
        summary: 'Register a sending domain; returns the DNS records to add',
        body: z.object({
          domainName: z.string().min(3),
          /** Expected daily volume — Infobip requires it; defaults in the service. */
          targetedDailyTraffic: z.number().int().positive().optional(),
        }),
      },
    },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      if (!emailDomainsConfigured()) {
        return reply.code(409).send({ error: 'email provider is not configured' });
      }
      try {
        return await registerEmailDomain(
          req.tenantId,
          req.body.domainName,
          req.body.targetedDailyTraffic,
        );
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.delete(
    '/v1/workspace/domains/:domainName',
    {
      schema: {
        tags: TAG,
        summary: 'Remove a sending domain (destroys its DKIM key at the provider)',
        params: z.object({ domainName: z.string().min(3) }),
      },
    },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      if (!emailDomainsConfigured()) {
        return reply.code(409).send({ error: 'email provider is not configured' });
      }
      try {
        await deleteEmailDomain(req.tenantId, req.params.domainName);
        return reply.code(204).send();
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.post(
    '/v1/workspace/domains/:domainName/verify',
    {
      schema: {
        tags: TAG,
        summary: 'Re-check the DNS records for a sending domain',
        params: z.object({ domainName: z.string().min(3) }),
      },
    },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      if (!emailDomainsConfigured()) {
        return reply.code(409).send({ error: 'email provider is not configured' });
      }
      try {
        return await verifyEmailDomain(req.tenantId, req.params.domainName);
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );
}
