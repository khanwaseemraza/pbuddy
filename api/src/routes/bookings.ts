// Bookings: participant-only read + cancel. Cancelling a pre-hand-off booking
// releases the reserved trip capacity (back into the cost-sharing ledger),
// withdraws the accepted bid, and marks the parcel cancelled. Each state change
// is mirrored to Firestore for live client updates.
import type { FastifyInstance } from 'fastify';
import { pool, withTransaction } from '../db.ts';
import { authenticate } from '../middleware/auth.ts';
import { releaseCapacity } from '../services/caps.ts';
import { canTransition, type BookingStatus } from '../services/bookingLifecycle.ts';
import { mirrorBookingStatus } from '../lib/mirror.ts';

export async function bookingRoutes(app: FastifyInstance): Promise<void> {
  // List the current user's bookings (as traveller and/or sender), with the
  // parcel route + whether the open-box inspection has been done.
  app.get('/bookings', { preHandler: [authenticate] }, async (req) => {
    const uid = req.user!.id;
    const { rows } = await pool.query(
      `SELECT b.id, b.status, b.contribution_pennies,
              (b.sender_id = $1)   AS is_sender,
              (b.traveler_id = $1) AS is_traveler,
              p.title, p.pickup_postcode, p.dropoff_postcode,
              c.display_name AS corridor, t.depart_at, t.transport_mode,
              EXISTS (SELECT 1 FROM handoff_events h
                        WHERE h.booking_id = b.id AND h.type = 'open_box_confirmed' AND h.success)
                                   AS open_box_done
         FROM bookings b
         JOIN parcels p   ON p.id = b.parcel_id
         JOIN trips t     ON t.id = b.trip_id
         JOIN corridors c ON c.id = t.corridor_id
        WHERE b.sender_id = $1 OR b.traveler_id = $1
        ORDER BY b.claimed_at DESC`,
      [uid],
    );
    return { bookings: rows };
  });

  // Participant-only read.
  app.get<{ Params: { id: string } }>(
    '/bookings/:id',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT id, parcel_id, trip_id, traveler_id, sender_id, contribution_pennies,
                status, claimed_at, funded_at, picked_up_at, delivered_at, released_at
           FROM bookings WHERE id = $1`,
        [req.params.id],
      );
      const booking = rows[0];
      if (!booking) return reply.code(404).send({ error: 'booking_not_found' });
      if (booking.sender_id !== req.user!.id && booking.traveler_id !== req.user!.id) {
        return reply.code(403).send({ error: 'not_a_participant' });
      }
      return booking;
    },
  );

  // Cancel a booking before hand-off (claimed/funded). Either participant may.
  app.post<{ Params: { id: string } }>(
    '/bookings/:id/cancel',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const userId = req.user!.id;
      const result = await withTransaction(async (tx) => {
        const { rows } = await tx.query(
          `SELECT b.id, b.status, b.trip_id, b.parcel_id, b.bid_id,
                  b.contribution_pennies, b.sender_id, b.traveler_id, bd.bid_pieces
             FROM bookings b JOIN bids bd ON bd.id = b.bid_id
            WHERE b.id = $1 FOR UPDATE OF b`,
          [req.params.id],
        );
        const booking = rows[0];
        if (!booking) return { http: 404, body: { error: 'booking_not_found' } } as const;
        if (booking.sender_id !== userId && booking.traveler_id !== userId) {
          return { http: 403, body: { error: 'not_a_participant' } } as const;
        }
        if (!canTransition(booking.status as BookingStatus, 'cancelled')) {
          return { http: 409, body: { error: 'not_cancellable', status: booking.status } } as const;
        }

        // Release the reserved capacity back into the ledger.
        await releaseCapacity(tx, booking.trip_id, booking.contribution_pennies, booking.bid_pieces);
        await tx.query(`UPDATE bookings SET status = 'cancelled' WHERE id = $1`, [booking.id]);
        await tx.query(`UPDATE bids SET status = 'withdrawn' WHERE id = $1`, [booking.bid_id]);
        await tx.query(`UPDATE parcels SET status = 'cancelled' WHERE id = $1`, [booking.parcel_id]);
        return { http: 200, body: { booking_id: booking.id, status: 'cancelled' } } as const;
      });

      if (result.http === 200) {
        void mirrorBookingStatus(req.params.id); // best-effort, non-blocking
      }
      return reply.code(result.http).send(result.body);
    },
  );
}
