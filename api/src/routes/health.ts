import type { FastifyInstance } from 'fastify';
import { pool } from '../db.ts';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/healthz', async () => ({ status: 'ok' }));

  app.get('/readyz', async (_req, reply) => {
    try {
      await pool.query('SELECT 1');
      return { status: 'ready' };
    } catch {
      reply.code(503);
      return { status: 'db_unavailable' };
    }
  });
}
