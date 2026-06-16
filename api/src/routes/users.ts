// User provisioning. After Firebase sign-in the client calls POST /users/me to
// create (or fetch) its PBuddy user row from the verified token — this is what
// lets every other authenticated endpoint resolve req.user. Idempotent.
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.ts';
import { authenticate, verifyToken } from '../middleware/auth.ts';
import { writeAudit } from '../lib/audit.ts';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // Provision-or-fetch the current user. Runs on just a verified token.
  // Signing in implies accepting the current legal bundle; when the client sends
  // accept_legal we resolve and store the active "terms" version + timestamp and
  // record an immutable CONSENT_RECORDED audit entry on first sign-up.
  app.post<{ Body: { full_name?: string; phone?: string; accept_legal?: boolean } }>(
    '/users/me',
    { preHandler: [verifyToken] },
    async (req, reply) => {
      const auth = req.auth!;
      const phone = auth.phoneNumber ?? req.body?.phone;
      if (!phone) return reply.code(400).send({ error: 'phone_required' });

      let legalVersion: number | null = null;
      if (req.body?.accept_legal) {
        const v = await pool.query(
          `SELECT max(version) AS version FROM legal_copy WHERE key = 'terms' AND is_active`,
        );
        legalVersion = v.rows[0]?.version ?? null;
      }

      const { rows } = await pool.query(
        `INSERT INTO users (firebase_uid, phone, full_name, legal_version, legal_accepted_at)
         VALUES ($1, $2, $3, $4::int, CASE WHEN $4::int IS NULL THEN NULL ELSE now() END)
         ON CONFLICT (firebase_uid)
           DO UPDATE SET phone = EXCLUDED.phone,
                         full_name = COALESCE(EXCLUDED.full_name, users.full_name),
                         legal_version = COALESCE(EXCLUDED.legal_version, users.legal_version),
                         legal_accepted_at = CASE
                           WHEN EXCLUDED.legal_version IS NOT NULL
                            AND EXCLUDED.legal_version IS DISTINCT FROM users.legal_version
                           THEN now() ELSE users.legal_accepted_at END
         RETURNING id, firebase_uid, phone, full_name, kyc_status, tier,
                   is_sender, is_traveler, legal_version, legal_accepted_at,
                   (xmax = 0) AS inserted`,
        [auth.uid, phone, req.body?.full_name ?? null, legalVersion],
      );
      const { inserted, ...user } = rows[0];
      // Record consent on first sign-up so the evidence trail captures it once.
      if (legalVersion != null && inserted) {
        await writeAudit({
          eventType: 'CONSENT_RECORDED',
          userId: user.id,
          payload: { legal_version: legalVersion },
        });
      }
      return reply.code(200).send(user);
    },
  );

  // Current user profile (requires a provisioned user).
  app.get('/users/me', { preHandler: [authenticate] }, async (req) => req.user);
}
