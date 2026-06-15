// Admin / ops API. Backs the founder's console (Retool, or any client) so they
// can see the state of the marketplace and act on it WITHOUT direct DB access.
// All admin-gated. Action endpoints already exist elsewhere (disputes resolve,
// bookings capture/payout/refund, compliance exports, reconciliation); this adds
// the read surfaces the console needs.
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.ts';
import { authenticate, requireAdmin } from '../middleware/auth.ts';
import { config } from '../config.ts';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: [authenticate, requireAdmin] };

  // Dashboard summary: counts + headline money figures + work queues.
  app.get('/admin/overview', guard, async () => {
    const bookings = await pool.query(
      `SELECT status, count(*)::int AS n FROM bookings GROUP BY status`,
    );
    const payments = await pool.query(
      `SELECT state, count(*)::int AS n FROM payments GROUP BY state`,
    );
    const queues = await pool.query(
      `SELECT
         (SELECT count(*) FROM disputes WHERE status IN ('open','investigating'))::int AS open_disputes,
         (SELECT count(*) FROM users WHERE kyc_status = 'pending')::int               AS pending_kyc,
         (SELECT count(*) FROM payments WHERE state = 'captured')::int                AS captured_awaiting_payout`,
    );
    const money = await pool.query(
      `SELECT
         COALESCE(sum(platform_fee_pennies + escrow_fee_pennies
           + GREATEST(0, insurance_cost_pennies - $1)) FILTER (WHERE state = 'released'), 0)::int
             AS platform_revenue_pennies,
         COALESCE(sum(traveler_payout_pennies) FILTER (WHERE state = 'released'), 0)::int
             AS travellers_paid_pennies,
         COALESCE(sum(gross_pennies) FILTER (WHERE state IN ('authorized','captured')), 0)::int
             AS escrow_held_pennies
         FROM payments`,
      [config.insuranceCostPennies],
    );
    const toObj = (rows: { status?: string; state?: string; n: number }[], key: 'status' | 'state') =>
      Object.fromEntries(rows.map((r) => [r[key], r.n]));
    return {
      bookings_by_status: toObj(bookings.rows, 'status'),
      payments_by_state: toObj(payments.rows, 'state'),
      queues: queues.rows[0],
      money: money.rows[0],
    };
  });

  // Ops table: recent bookings with parties + payment state for triage.
  app.get<{ Querystring: { status?: string; limit?: string } }>(
    '/admin/bookings',
    guard,
    async (req) => {
      const limit = Math.min(Number(req.query.limit ?? 50), 200);
      const params: unknown[] = [];
      let where = '';
      if (req.query.status) {
        params.push(req.query.status);
        where = `WHERE b.status = $${params.length}`;
      }
      params.push(limit);
      const { rows } = await pool.query(
        `SELECT b.id, b.status, b.contribution_pennies, b.claimed_at,
                s.phone AS sender_phone, tv.phone AS traveller_phone,
                p.title, c.display_name AS corridor,
                pay.state AS payment_state, pay.gross_pennies
           FROM bookings b
           JOIN users s ON s.id = b.sender_id
           JOIN users tv ON tv.id = b.traveler_id
           JOIN parcels p ON p.id = b.parcel_id
           JOIN trips t ON t.id = b.trip_id
           JOIN corridors c ON c.id = t.corridor_id
           LEFT JOIN payments pay ON pay.booking_id = b.id
           ${where}
          ORDER BY b.claimed_at DESC
          LIMIT $${params.length}`,
        params,
      );
      return { bookings: rows };
    },
  );
}
