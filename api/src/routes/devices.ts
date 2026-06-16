// Device registration (PBD-72). The app registers its push token after sign-in
// so booking-transition notifications can reach it.
import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.ts';
import { registerDeviceToken } from '../lib/push.ts';

export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { token?: string; platform?: 'ios' | 'android' | 'web' } }>(
    '/devices/register',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { token, platform } = req.body ?? {};
      if (!token || !platform || !['ios', 'android', 'web'].includes(platform)) {
        return reply.code(400).send({ error: 'token_and_platform_required' });
      }
      await registerDeviceToken(req.user!.id, token, platform);
      return reply.code(201).send({ registered: true });
    },
  );
}
