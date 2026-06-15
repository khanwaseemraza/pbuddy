// Hand-off: the QR/OTP flow that drives the escrow. The traveller confirms an
// open-box inspection (gate), scans the pickup code (captures the held funds),
// then scans the dropoff code (transfers the contribution to the traveller).
// This is what makes the escrow autonomous — no admin involvement.
import type { FastifyInstance } from 'fastify';
import { pool, withTransaction } from '../db.ts';
import { authenticate, requireKyc } from '../middleware/auth.ts';
import { writeAudit } from '../lib/audit.ts';
import { mirrorBookingStatus } from '../lib/mirror.ts';
import { verifyCode } from '../services/handoff.ts';
import { capturePaymentIntent, createTransfer } from '../lib/stripe.ts';

interface CodeBody { code: string; geo_lat?: number; geo_lng?: number }

async function loadBookingForTraveller(bookingId: string, travelerId: string) {
  const { rows } = await pool.query(
    `SELECT b.*, p.id AS payment_id, p.state AS payment_state, p.stripe_payment_intent_id,
            p.traveler_payout_pennies, u.stripe_connect_id
       FROM bookings b
       LEFT JOIN payments p ON p.booking_id = b.id
       JOIN users u ON u.id = b.traveler_id
      WHERE b.id = $1`,
    [bookingId],
  );
  const b = rows[0];
  if (!b) return { error: 'booking_not_found' as const };
  if (b.traveler_id !== travelerId) return { error: 'not_the_traveller' as const };
  return { booking: b };
}

export async function handoffRoutes(app: FastifyInstance): Promise<void> {
  // ---- Open-box inspection (the gate) ----
  app.post<{ Params: { id: string }; Body: { geo_lat?: number; geo_lng?: number } }>(
    '/bookings/:id/open-box',
    { preHandler: [authenticate, requireKyc] },
    async (req, reply) => {
      const r = await loadBookingForTraveller(req.params.id, req.user!.id);
      if ('error' in r) return reply.code(r.error === 'not_the_traveller' ? 403 : 404).send({ error: r.error });
      if (r.booking.status !== 'funded') {
        return reply.code(409).send({ error: 'not_inspectable', status: r.booking.status });
      }
      await pool.query(
        `INSERT INTO handoff_events (booking_id, type, actor_id, checklist_version, geo_lat, geo_lng)
         VALUES ($1, 'open_box_confirmed', $2, 1, $3, $4)`,
        [r.booking.id, req.user!.id, req.body?.geo_lat ?? null, req.body?.geo_lng ?? null],
      );
      await writeAudit({
        eventType: 'OPEN_BOX_CONFIRMED',
        userId: req.user!.id,
        bookingId: r.booking.id,
        parcelId: r.booking.parcel_id,
        payload: { checklist_version: 1 },
      });
      return reply.send({ booking_id: r.booking.id, open_box: 'confirmed' });
    },
  );

  // ---- Pickup scan: verify code -> capture escrow -> booking picked_up ----
  app.post<{ Params: { id: string }; Body: CodeBody }>(
    '/bookings/:id/pickup',
    { preHandler: [authenticate, requireKyc] },
    async (req, reply) => {
      const r = await loadBookingForTraveller(req.params.id, req.user!.id);
      if ('error' in r) return reply.code(r.error === 'not_the_traveller' ? 403 : 404).send({ error: r.error });
      const b = r.booking;
      if (b.status !== 'funded') return reply.code(409).send({ error: 'not_pickable', status: b.status });
      if (!verifyCode(req.body?.code, { qrToken: b.pickup_qr_token, otpHash: b.pickup_otp_hash }, b.id)) {
        return reply.code(401).send({ error: 'invalid_code' });
      }
      const inspected = await pool.query(
        `SELECT 1 FROM handoff_events WHERE booking_id = $1 AND type = 'open_box_confirmed' AND success`,
        [b.id],
      );
      if (!inspected.rowCount) return reply.code(409).send({ error: 'open_box_required' });
      if (b.payment_state !== 'authorized') {
        return reply.code(409).send({ error: 'payment_not_authorized', state: b.payment_state });
      }

      // Capture the held funds, then record the state change.
      await capturePaymentIntent(b.stripe_payment_intent_id);
      await withTransaction(async (tx) => {
        await tx.query(`UPDATE payments SET state = 'captured', captured_at = now() WHERE id = $1`, [b.payment_id]);
        await tx.query(`UPDATE bookings SET status = 'picked_up', picked_up_at = now() WHERE id = $1`, [b.id]);
        await tx.query(
          `INSERT INTO handoff_events (booking_id, type, actor_id, method, geo_lat, geo_lng)
           VALUES ($1, 'pickup_scan', $2, $3, $4, $5)`,
          [b.id, req.user!.id, req.body.code === b.pickup_qr_token ? 'qr' : 'otp',
           req.body?.geo_lat ?? null, req.body?.geo_lng ?? null],
        );
      });
      void mirrorBookingStatus(b.id);
      return reply.send({ booking_id: b.id, status: 'picked_up', payment_state: 'captured' });
    },
  );

  // ---- Dropoff scan: verify code -> transfer payout -> booking released ----
  app.post<{ Params: { id: string }; Body: CodeBody }>(
    '/bookings/:id/dropoff',
    { preHandler: [authenticate, requireKyc] },
    async (req, reply) => {
      const r = await loadBookingForTraveller(req.params.id, req.user!.id);
      if ('error' in r) return reply.code(r.error === 'not_the_traveller' ? 403 : 404).send({ error: r.error });
      const b = r.booking;
      if (b.status !== 'picked_up') return reply.code(409).send({ error: 'not_droppable', status: b.status });
      if (!verifyCode(req.body?.code, { qrToken: b.dropoff_qr_token, otpHash: b.dropoff_otp_hash }, b.id)) {
        return reply.code(401).send({ error: 'invalid_code' });
      }
      if (b.payment_state !== 'captured') {
        return reply.code(409).send({ error: 'payment_not_captured', state: b.payment_state });
      }
      if (!b.stripe_connect_id) return reply.code(409).send({ error: 'traveller_not_onboarded' });

      // Pay the traveller their contribution, then mark delivered + released.
      const transferId = await createTransfer({
        amountPennies: b.traveler_payout_pennies,
        destinationAccountId: b.stripe_connect_id,
        bookingId: b.id,
      });
      await withTransaction(async (tx) => {
        await tx.query(
          `UPDATE payments SET state = 'released', released_at = now(), stripe_transfer_id = $2 WHERE id = $1`,
          [b.payment_id, transferId],
        );
        await tx.query(
          `UPDATE bookings SET status = 'released', delivered_at = now(), released_at = now() WHERE id = $1`,
          [b.id],
        );
        await tx.query(
          `INSERT INTO handoff_events (booking_id, type, actor_id, method, geo_lat, geo_lng)
           VALUES ($1, 'dropoff_scan', $2, $3, $4, $5)`,
          [b.id, req.user!.id, req.body.code === b.dropoff_qr_token ? 'qr' : 'otp',
           req.body?.geo_lat ?? null, req.body?.geo_lng ?? null],
        );
      });
      void mirrorBookingStatus(b.id);
      return reply.send({ booking_id: b.id, status: 'released', transfer_id: transferId });
    },
  );

  // ---- Sender re-fetches the QR tokens to display ----
  app.get<{ Params: { id: string } }>(
    '/bookings/:id/codes',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT sender_id, pickup_qr_token, dropoff_qr_token FROM bookings WHERE id = $1`,
        [req.params.id],
      );
      const b = rows[0];
      if (!b) return reply.code(404).send({ error: 'booking_not_found' });
      if (b.sender_id !== req.user!.id) return reply.code(403).send({ error: 'sender_only' });
      return { pickup_qr: b.pickup_qr_token, dropoff_qr: b.dropoff_qr_token };
    },
  );
}
