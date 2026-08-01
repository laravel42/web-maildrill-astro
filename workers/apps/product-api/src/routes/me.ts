import type { FastifyInstance } from 'fastify';
import { authenticate } from '@maildrill/authz';
import { getMe } from '@maildrill/identity';

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get(
    '/v1/me',
    { schema: { tags: ['Auth'], summary: 'Current user, workspaces, and active tenant/role' } },
    async (req, reply) => {
      if (!req.userId) {
        return reply.code(400).send({ error: 'user_session_required' });
      }
      const me = await getMe(req.userId);
      if (!me) return reply.code(404).send({ error: 'not_found' });
      return {
        user: { id: me.user.id, email: me.user.email, name: me.user.name, phone: me.user.phone },
        workspaces: me.workspaces,
        activeTenantId: req.tenantId,
        role: req.role,
      };
    },
  );
}
