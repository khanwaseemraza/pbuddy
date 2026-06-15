// Disputes. A participant opens a dispute on a booking; an admin resolves it,
// driving the existing escrow paths: 'release' pays the traveller, 'refund'
// returns the sender's money (and frees the cost-sharing capacity). Backed by the
// handoff_events evidence trail.
import type { FastifyInstance } from 'fastify';
import { pool, withTransaction } from '../db.ts';
import { authenticate, requireAdmin } from '../middleware/auth.ts';
import { mirrorBookingStatus } from '../lib/mirror.ts';
import { releaseCapacity } from '../services/caps.ts';
import { canTransition, type BookingStatus } from '../services/bookingLifecycle.ts';
import {
  capturePaymentIntent,
  cancelPaymentIntent,
  createTransfer,
  refundPaymentIntent,
} from '../lib/stripe.ts';

export async function disputeRoutes(app: FastifyInstance): Promise<void> {
  // ---- Participant opens a dispute ----
  app.post<{ Params: { id: string }; Body: { reason_code: string; description?: string } }>(
    '/bookings/:id/dispute',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const userId = req.user!.id;
      const { rows } = await pool.query(
        `SELECT id, sender_id, traveler_id, status FROM bookings WHERE id = $1`,
        [req.params.id],
      );
      const b = rows[0];
      if (!b) return reply.code(404).send({ error: 'booking_not_found' });
      if (b.sender_id !== userId && b.traveler_id !== userId) {
        return reply.code(403).send({ error: 'not_a_participant' });
      }
      if (!req.body?.reason_code) return reply.code(400).send({ error: 'reason_code_required' });
      if (!canTransition(b.status as BookingStatus, 'disputed')) {
        return reply.code(409).send({ error: 'not_disputable', status: b.status });
      }

      const dispute = await withTransaction(async (tx) => {
        const d = await tx.query(
          `INSERT INTO disputes (booking_id, opened_by, reason_code, description, status)
           VALUES ($1,$2,$3,$4,'open') RETURNING id`,
          [b.id, userId, req.body.reason_code, req.body.description ?? null],
        );
        await tx.query(`UPDATE bookings SET status = 'disputed' WHERE id = $1`, [b.id]);
        await tx.query(
          `INSERT INTO handoff_events (booking_id, type, actor_id) VALUES ($1, 'dispute_opened', $2)`,
          [b.id, userId],
        );
        return d.rows[0];
      });
      void mirrorBookingStatus(b.id);
      return reply.code(201).send({ dispute_id: dispute.id, status: 'open' });
    },
  );

  // ---- Admin lists open disputes ----
  app.get('/disputes', { preHandler: [authenticate, requireAdmin] }, async () => {
    const { rows } = await pool.query(
      `SELECT d.id, d.booking_id, d.reason_code, d.description, d.status, d.created_at,
              b.status AS booking_status
         FROM disputes d JOIN bookings b ON b.id = d.booking_id
        WHERE d.status IN ('open', 'investigating')
        ORDER BY d.created_at`,
    );
    return { disputes: rows };
  });

  // ---- Admin resolves: release (pay traveller) or refund (return to sender) ----
  app.post<{ Params: { id: string }; Body: { resolution: 'release' | 'refund'; notes?: string } }>(
    '/disputes/:id/resolve',
    { preHandler: [authenticate, requireAdmin] },
    async (req, reply) => {
      const adminId = req.user!.id;
      const resolution = req.body?.resolution;
      if (resolution !== 'release' && resolution !== 'refund') {
        return reply.code(400).send({ error: 'invalid_resolution' });
      }

      // Load dispute + booking + payment + traveller payout account (outside tx;
      // the Stripe call happens before we commit the DB state change).
      const ctx = (
        await pool.query(
          `SELECT d.id AS dispute_id, d.status AS dispute_status,
                  b.id AS booking_id, b.status AS booking_status, b.trip_id, b.contribution_pennies,
                  bd.bid_pieces,
                  p.id AS payment_id, p.state AS payment_state, p.stripe_payment_intent_id,
                  p.traveler_payout_pennies, u.stripe_connect_id
             FROM disputes d
             JOIN bookings b ON b.id = d.booking_id
             JOIN bids bd ON bd.id = b.bid_id
             LEFT JOIN payments p ON p.booking_id = b.id
             JOIN users u ON u.id = b.traveler_id
            WHERE d.id = $1`,
          [req.params.id],
        )
      ).rows[0];
      if (!ctx) return reply.code(404).send({ error: 'dispute_not_found' });
      if (ctx.dispute_status !== 'open' && ctx.dispute_status !== 'investigating') {
        return reply.code(409).send({ error: 'already_resolved', status: ctx.dispute_status });
      }

      let transferId: string | null = null;
      try {
        if (resolution === 'release') {
          if (ctx.payment_state === 'authorized') await capturePaymentIntent(ctx.stripe_payment_intent_id);
          if (ctx.payment_state !== 'released') {
            if (!ctx.stripe_connect_id) return reply.code(409).send({ error: 'traveller_not_onboarded' });
            transferId = await createTransfer({
              amountPennies: ctx.traveler_payout_pennies,
              destinationAccountId: ctx.stripe_connect_id,
              bookingId: ctx.booking_id,
            });
          }
        } else if (ctx.payment_id) {
          if (ctx.payment_state === 'authorized') await cancelPaymentIntent(ctx.stripe_payment_intent_id);
          else if (ctx.payment_state !== 'refunded') await refundPaymentIntent(ctx.stripe_payment_intent_id);
        }
      } catch {
        return reply.code(502).send({ error: 'stripe_failed' });
      }

      await withTransaction(async (tx) => {
        if (resolution === 'release') {
          if (ctx.payment_id) {
            await tx.query(
              `UPDATE payments SET state = 'released', released_at = now(),
                      stripe_transfer_id = COALESCE($2, stripe_transfer_id) WHERE id = $1`,
              [ctx.payment_id, transferId],
            );
          }
          await tx.query(`UPDATE bookings SET status = 'released', released_at = now() WHERE id = $1`, [ctx.booking_id]);
          await tx.query(
            `UPDATE disputes SET status = 'resolved_release', resolution_notes = $2, resolved_by = $3, resolved_at = now() WHERE id = $1`,
            [ctx.dispute_id, req.body?.notes ?? null, adminId],
          );
        } else {
          if (ctx.payment_id) await tx.query(`UPDATE payments SET state = 'refunded' WHERE id = $1`, [ctx.payment_id]);
          await tx.query(`UPDATE bookings SET status = 'refunded' WHERE id = $1`, [ctx.booking_id]);
          await releaseCapacity(tx, ctx.trip_id, ctx.contribution_pennies, ctx.bid_pieces);
          await tx.query(
            `UPDATE disputes SET status = 'resolved_refund', resolution_notes = $2, resolved_by = $3, resolved_at = now() WHERE id = $1`,
            [ctx.dispute_id, req.body?.notes ?? null, adminId],
          );
        }
      });
      void mirrorBookingStatus(ctx.booking_id);
      return reply.send({
        dispute_id: ctx.dispute_id,
        resolution: resolution === 'release' ? 'resolved_release' : 'resolved_refund',
        booking_status: resolution === 'release' ? 'released' : 'refunded',
      });
    },
  );
}
