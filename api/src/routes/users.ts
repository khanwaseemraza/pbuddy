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

  // ---- GDPR DSAR: self-serve data export (E16-S1) ----
  // Returns everything we hold that is personal to this user, in one JSON
  // bundle. Records a DSAR_EXPORT audit entry so the right is auditable.
  app.get('/users/me/export', { preHandler: [authenticate] }, async (req) => {
    const id = req.user!.id;
    const [profile, parcels, trips, bids, bookings, payments, consent] = await Promise.all([
      pool.query(
        `SELECT id, phone, email, full_name, kyc_status, tier, immigration_class,
                rtw_status, is_sender, is_traveler, trust_score, rating_count,
                legal_version, legal_accepted_at, created_at, erased_at
           FROM users WHERE id = $1`, [id]),
      pool.query(`SELECT id, title, description, category, status, pickup_postcode,
                         dropoff_postcode, declared_value_pennies, created_at
                    FROM parcels WHERE sender_id = $1 ORDER BY created_at`, [id]),
      pool.query(`SELECT id, corridor_id, direction, transport_mode, depart_at,
                         journey_cost_pennies, status, created_at
                    FROM trips WHERE traveler_id = $1 ORDER BY created_at`, [id]),
      pool.query(`SELECT id, parcel_id, trip_id, bid_contribution_pennies, status, created_at
                    FROM bids WHERE traveler_id = $1 ORDER BY created_at`, [id]),
      pool.query(`SELECT id, parcel_id, trip_id, contribution_pennies, status,
                         claimed_at, delivered_at,
                         (sender_id = $1) AS as_sender, (traveler_id = $1) AS as_traveller
                    FROM bookings WHERE sender_id = $1 OR traveler_id = $1
                   ORDER BY claimed_at`, [id]),
      pool.query(`SELECT p.id, p.gross_pennies, p.platform_fee_pennies, p.state, p.created_at
                    FROM payments p JOIN bookings b ON b.id = p.booking_id
                   WHERE b.sender_id = $1 OR b.traveler_id = $1 ORDER BY p.created_at`, [id]),
      pool.query(`SELECT event_type, payload, created_at FROM compliance_audit_log
                   WHERE user_id = $1 AND event_type = 'CONSENT_RECORDED'
                   ORDER BY created_at`, [id]),
    ]);
    await writeAudit({ eventType: 'DSAR_EXPORT', userId: id });
    return {
      generated_at: new Date().toISOString(),
      profile: profile.rows[0] ?? null,
      parcels: parcels.rows,
      trips: trips.rows,
      bids: bids.rows,
      bookings: bookings.rows,
      payments: payments.rows,
      consent: consent.rows,
      note: 'Card numbers are never stored; payments are handled by Stripe. The '
        + 'immutable compliance audit trail is retained under our legal-obligation basis.',
    };
  });

  // ---- GDPR DSAR: account erasure (E16-S1) ----
  // Anonymises PII on the user row and closes the account. The immutable
  // compliance_audit_log is retained (legal-obligation basis) but no longer
  // points at identifying data. Refused while money is in flight so escrow can't
  // be stranded.
  app.post('/users/me/erasure', { preHandler: [authenticate] }, async (req, reply) => {
    const id = req.user!.id;
    const { rows: active } = await pool.query(
      `SELECT count(*)::int AS n FROM bookings
        WHERE (sender_id = $1 OR traveler_id = $1)
          AND status IN ('claimed','funded','picked_up')`, [id]);
    if (active[0].n > 0) {
      return reply.code(409).send({ error: 'active_bookings_block_erasure', active: active[0].n });
    }
    await pool.query(
      `UPDATE users
          SET full_name = NULL, email = NULL,
              phone = 'erased:' || id,
              firebase_uid = 'erased:' || id,
              erased_at = now()
        WHERE id = $1 AND erased_at IS NULL`, [id]);
    await writeAudit({ eventType: 'DSAR_ERASURE', userId: id });
    return reply.code(200).send({ erased: true });
  });
}
