import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { authenticate } from '@maildrill/authz';
import { ValidationError } from '@maildrill/domain';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import {
  getMe,
  getSessionsRevokedAt,
  listRecentSignIns,
  revokeAllSessions,
  updateMe,
} from '@maildrill/identity';
import {
  avatarPrefixFor,
  createAvatarUploadTicket,
  mediaConfigured,
  publicUrlFor,
} from '@maildrill/product';

const TAG = ['Auth'];

const avatarTicketSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
});

const patchSchema = z.object({
  name: z.string().nullable().optional(),
  phone: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v == null || v === '' || /^\+\d{7,16}$/.test(v), {
      message: 'phone must be E.164 (+ and 7–16 digits)',
    }),
  preferences: z.record(z.string(), z.unknown()).optional(),
});

function serializeUser(user: {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  createdAt: Date;
  preferences: Record<string, unknown>;
  sessionsRevokedAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
    preferences: user.preferences ?? {},
    sessionsRevokedAt: user.sessionsRevokedAt?.toISOString() ?? null,
  };
}

export async function meRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.get(
    '/v1/me',
    {
      schema: { tags: TAG, summary: 'Current user, workspaces, preferences, and recent sign-ins' },
    },
    async (req, reply) => {
      if (!req.userId) {
        return reply.code(400).send({ error: 'user_session_required' });
      }
      const me = await getMe(req.userId);
      if (!me) return reply.code(404).send({ error: 'not_found' });
      const recentSignIns = await listRecentSignIns(me.user.email, 10);
      return {
        user: serializeUser(me.user),
        workspaces: me.workspaces,
        activeTenantId: req.tenantId,
        role: req.role,
        recentSignIns,
      };
    },
  );

  app.patch(
    '/v1/me',
    {
      schema: {
        tags: TAG,
        summary: 'Update current user profile and preferences',
        body: patchSchema,
      },
    },
    async (req, reply) => {
      if (!req.userId) {
        return reply.code(400).send({ error: 'user_session_required' });
      }
      try {
        const user = await updateMe(req.userId, req.body);
        if (!user) return reply.code(404).send({ error: 'not_found' });
        return { user: serializeUser(user) };
      } catch (err) {
        if (err instanceof Error && err.message === 'invalid_phone') {
          return reply.code(400).send({ error: 'invalid_phone' });
        }
        throw err;
      }
    },
  );

  app.post(
    '/v1/me/avatar/upload-ticket',
    {
      schema: {
        tags: TAG,
        summary: 'Presigned PUT for a profile photo (own avatars/ prefix, not a media asset)',
        body: avatarTicketSchema,
      },
    },
    async (req, reply) => {
      if (!req.userId) {
        return reply.code(400).send({ error: 'user_session_required' });
      }
      if (!mediaConfigured()) {
        return reply.code(409).send({ error: 'media_not_configured' });
      }
      try {
        return await createAvatarUploadTicket(req.userId, req.body);
      } catch (err) {
        if (err instanceof ValidationError) {
          return reply.code(400).send({ error: err.message });
        }
        throw err;
      }
    },
  );

  app.post(
    '/v1/me/avatar',
    {
      schema: {
        tags: TAG,
        summary: 'Set the profile photo after a ticketed upload completes',
        body: z.object({ storageKey: z.string().min(1) }),
      },
    },
    async (req, reply) => {
      if (!req.userId) {
        return reply.code(400).send({ error: 'user_session_required' });
      }
      // Only keys this user's own ticket could have produced; the URL is
      // derived server-side so a client can never point the avatar elsewhere.
      if (!req.body.storageKey.startsWith(avatarPrefixFor(req.userId))) {
        return reply.code(400).send({ error: 'invalid_storage_key' });
      }
      const user = await updateMe(req.userId, {
        preferences: { avatarUrl: publicUrlFor(req.body.storageKey) },
      });
      if (!user) return reply.code(404).send({ error: 'not_found' });
      return { user: serializeUser(user) };
    },
  );

  app.delete(
    '/v1/me/avatar',
    { schema: { tags: TAG, summary: 'Remove the profile photo' } },
    async (req, reply) => {
      if (!req.userId) {
        return reply.code(400).send({ error: 'user_session_required' });
      }
      const user = await updateMe(req.userId, { preferences: { avatarUrl: null } });
      if (!user) return reply.code(404).send({ error: 'not_found' });
      return { user: serializeUser(user) };
    },
  );

  app.post(
    '/v1/me/sessions/revoke-all',
    {
      schema: {
        tags: TAG,
        summary: 'Revoke all sessions and pending login codes for the current user',
      },
    },
    async (req, reply) => {
      if (!req.userId) {
        return reply.code(400).send({ error: 'user_session_required' });
      }
      const result = await revokeAllSessions(req.userId);
      if (!result) return reply.code(404).send({ error: 'not_found' });
      return { ok: true, sessionsRevokedAt: result.sessionsRevokedAt.toISOString() };
    },
  );

  /** Lightweight revoke check for Astro middleware (cached client-side). */
  app.get(
    '/v1/me/session-status',
    { schema: { tags: TAG, summary: 'Session revocation timestamp for the current user' } },
    async (req, reply) => {
      if (!req.userId) {
        return reply.code(400).send({ error: 'user_session_required' });
      }
      const at = await getSessionsRevokedAt(req.userId);
      return { sessionsRevokedAt: at?.toISOString() ?? null };
    },
  );
}
