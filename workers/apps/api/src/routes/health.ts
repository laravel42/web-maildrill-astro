import type { FastifyInstance } from 'fastify';
import { pool } from '@maildrill/database';
import { sharedConnection } from '@maildrill/queues';
import { metrics } from '@maildrill/observability';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health/live', async () => ({ status: 'ok' }));

  app.get('/health/ready', async (_req, reply) => {
    try {
      await pool.query('select 1');
      await sharedConnection().ping();
      return { status: 'ready' };
    } catch (err) {
      return reply.code(503).send({
        status: 'unready',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  app.get('/metrics', async (_req, reply) => {
    void reply.header('content-type', 'text/plain; version=0.0.4');
    return metrics.render();
  });
}
