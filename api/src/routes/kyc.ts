// KYC via Stripe Identity. The user starts a verification session; Stripe runs
// the document/selfie check; the webhook (in payments.ts) flips users.kyc_status
// when it completes. Posting/claiming/funding are gated on kyc_status='verified'.
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.ts';
import { authenticate } from '../middleware/auth.ts';
import { createIdentitySession } from '../lib/stripe.ts';

export async function kycRoutes(app: FastifyInstance): Promise<void> {
  app.post('/kyc/start', { preHandler: [authenticate] }, async (req, reply) => {
    const user = req.user!;
    if (user.kyc_status === 'verified') {
      return reply.code(409).send({ error: 'already_verified' });
    }
    const session = await createIdentitySession(user.id);
    await pool.query(
      `UPDATE users SET kyc_session_id = $2, kyc_status = 'pending' WHERE id = $1`,
      [user.id, session.id],
    );
    return reply.send({
      kyc_status: 'pending',
      session_id: session.id,
      client_secret: session.clientSecret,
      verification_url: session.url,
    });
  });

  app.get('/kyc/status', { preHandler: [authenticate] }, async (req) => {
    return { kyc_status: req.user!.kyc_status };
  });
}
