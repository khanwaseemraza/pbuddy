// User provisioning. After Firebase sign-in the client calls POST /users/me to
// create (or fetch) its PBuddy user row from the verified token — this is what
// lets every other authenticated endpoint resolve req.user. Idempotent.
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.ts';
import { authenticate, verifyToken } from '../middleware/auth.ts';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // Provision-or-fetch the current user. Runs on just a verified token.
  app.post<{ Body: { full_name?: string; phone?: string } }>(
    '/users/me',
    { preHandler: [verifyToken] },
    async (req, reply) => {
      const auth = req.auth!;
      const phone = auth.phoneNumber ?? req.body?.phone;
      if (!phone) return reply.code(400).send({ error: 'phone_required' });

      const { rows } = await pool.query(
        `INSERT INTO users (firebase_uid, phone, full_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (firebase_uid)
           DO UPDATE SET phone = EXCLUDED.phone,
                         full_name = COALESCE(EXCLUDED.full_name, users.full_name)
         RETURNING id, firebase_uid, phone, full_name, kyc_status, tier, is_sender, is_traveler`,
        [auth.uid, phone, req.body?.full_name ?? null],
      );
      return reply.code(200).send(rows[0]);
    },
  );

  // Current user profile (requires a provisioned user).
  app.get('/users/me', { preHandler: [authenticate] }, async (req) => req.user);
}
