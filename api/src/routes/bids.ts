// Bids: the firewall in action. Travellers place cap-bounded bids; senders
// accept. Every attempt writes a CAP_CHECK to the compliance audit log.
import type { FastifyInstance } from 'fastify';
import { pool, withTransaction } from '../db.ts';
import { authenticate, requireKyc } from '../middleware/auth.ts';
import { writeAudit } from '../lib/audit.ts';
import { evaluateCap, proBypassAllowed, reserveCapacity, type ProGate } from '../services/caps.ts';

interface PlaceBidBody {
  trip_id: string;
  bid_contribution_pennies: number;
  bid_pieces?: number;
}

export async function bidRoutes(app: FastifyInstance): Promise<void> {
  // ---- Traveller places a bid on a parcel for one of their trips ----
  app.post<{ Params: { parcelId: string }; Body: PlaceBidBody }>(
    '/parcels/:parcelId/bids',
    { preHandler: [authenticate, requireKyc] },
    async (req, reply) => {
      const traveler = req.user!;
      const { parcelId } = req.params;
      const { trip_id, bid_contribution_pennies, bid_pieces = 1 } = req.body;

      if (!Number.isInteger(bid_contribution_pennies) || bid_contribution_pennies <= 0) {
        return reply.code(400).send({ error: 'invalid_contribution' });
      }

      const { rows: prows } = await pool.query(
        `SELECT p.id, p.corridor_id, p.direction, p.status, p.piece_count,
                p.max_contribution_pennies, p.sender_id
           FROM parcels p WHERE p.id = $1`,
        [parcelId],
      );
      const parcel = prows[0];
      if (!parcel || parcel.status !== 'listed') {
        return reply.code(404).send({ error: 'parcel_not_available' });
      }
      if (parcel.sender_id === traveler.id) {
        return reply.code(400).send({ error: 'cannot_bid_on_own_parcel' });
      }
      if (bid_contribution_pennies > parcel.max_contribution_pennies) {
        return reply.code(400).send({ error: 'bid_above_sender_max' });
      }

      const { rows: trows } = await pool.query(
        `SELECT t.id, t.traveler_id, t.corridor_id, t.direction, t.transport_mode,
                l.cap_pennies, l.committed_pennies, l.committed_pieces, t.capacity_pieces,
                u.tier, u.rtw_status, u.hire_reward_policy_id
           FROM trips t
           JOIN trip_capacity_ledger l ON l.trip_id = t.id
           JOIN users u ON u.id = t.traveler_id
          WHERE t.id = $1`,
        [trip_id],
      );
      const trip = trows[0];
      if (!trip || trip.traveler_id !== traveler.id) {
        return reply.code(403).send({ error: 'not_your_trip' });
      }
      if (trip.corridor_id !== parcel.corridor_id || trip.direction !== parcel.direction) {
        return reply.code(400).send({ error: 'corridor_or_direction_mismatch' });
      }
      if (bid_pieces > trip.capacity_pieces - trip.committed_pieces) {
        return reply.code(400).send({ error: 'insufficient_luggage_capacity' });
      }

      const gate: ProGate = {
        tier: trip.tier,
        rtwStatus: trip.rtw_status,
        hireRewardPolicyId: trip.hire_reward_policy_id,
        transportMode: trip.transport_mode,
      };
      const proBypass = proBypassAllowed(gate);

      // Cap check at creation (Casual). Pro with gates satisfied bypasses.
      const decision = evaluateCap(
        { capPennies: trip.cap_pennies, committedPennies: trip.committed_pennies },
        bid_contribution_pennies,
      );
      await writeAudit({
        eventType: 'CAP_CHECK',
        userId: traveler.id,
        tripId: trip_id,
        parcelId,
        payload: { stage: 'place_bid', proBypass, ...decision },
      });
      if (!proBypass && !decision.allowed) {
        return reply.code(409).send({
          error: 'cap_exceeded',
          message:
            'This bid would exceed the cost of your own journey. PBuddy is cost-sharing — you can only recover your travel costs.',
          remaining_pennies: decision.remainingBefore,
        });
      }

      const { rows: brows } = await pool.query(
        `INSERT INTO bids (parcel_id, trip_id, traveler_id, bid_contribution_pennies, bid_pieces, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + interval '48 hours')
         RETURNING id, status, bid_contribution_pennies, expires_at`,
        [parcelId, trip_id, traveler.id, bid_contribution_pennies, bid_pieces],
      );
      return reply.code(201).send(brows[0]);
    },
  );

  // ---- Sender accepts a bid: atomic cap reservation + booking creation ----
  app.post<{ Params: { bidId: string } }>(
    '/bids/:bidId/accept',
    { preHandler: [authenticate, requireKyc] },
    async (req, reply) => {
      const sender = req.user!;
      const { bidId } = req.params;

      try {
        const result = await withTransaction(async (tx) => {
          // Lock the bid and load context.
          const { rows } = await tx.query(
            `SELECT b.id, b.parcel_id, b.trip_id, b.traveler_id, b.bid_contribution_pennies,
                    b.bid_pieces, b.status,
                    p.sender_id, p.status AS parcel_status,
                    t.transport_mode, u.tier, u.rtw_status, u.hire_reward_policy_id
               FROM bids b
               JOIN parcels p ON p.id = b.parcel_id
               JOIN trips t ON t.id = b.trip_id
               JOIN users u ON u.id = b.traveler_id
              WHERE b.id = $1
              FOR UPDATE OF b`,
            [bidId],
          );
          const bid = rows[0];
          if (!bid) return { http: 404, body: { error: 'bid_not_found' } } as const;
          if (bid.sender_id !== sender.id) {
            return { http: 403, body: { error: 'not_your_parcel' } } as const;
          }
          if (bid.status !== 'pending') {
            return { http: 409, body: { error: 'bid_not_pending' } } as const;
          }
          if (bid.parcel_status !== 'listed') {
            return { http: 409, body: { error: 'parcel_no_longer_listed' } } as const;
          }

          const gate: ProGate = {
            tier: bid.tier,
            rtwStatus: bid.rtw_status,
            hireRewardPolicyId: bid.hire_reward_policy_id,
            transportMode: bid.transport_mode,
          };
          const proBypass = proBypassAllowed(gate);

          // Re-validate + reserve capacity atomically (cap may have been consumed
          // by another accept on the same trip since the bid was placed).
          let decision;
          if (proBypass) {
            decision = { allowed: true } as { allowed: boolean };
          } else {
            decision = await reserveCapacity(
              tx,
              bid.trip_id,
              bid.bid_contribution_pennies,
              bid.bid_pieces,
            );
            await writeAudit(
              {
                eventType: 'CAP_CHECK',
                userId: bid.traveler_id,
                tripId: bid.trip_id,
                parcelId: bid.parcel_id,
                payload: { stage: 'accept_bid', proBypass, ...decision },
              },
              tx,
            );
            if (!decision.allowed) {
              // Roll back by throwing; caller maps to 409.
              throw Object.assign(new Error('cap_exceeded'), { capExceeded: true });
            }
          }

          // Create the booking and accept the bid.
          const { rows: bk } = await tx.query(
            `INSERT INTO bookings (parcel_id, trip_id, bid_id, traveler_id, sender_id, contribution_pennies)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id`,
            [
              bid.parcel_id,
              bid.trip_id,
              bid.id,
              bid.traveler_id,
              sender.id,
              bid.bid_contribution_pennies,
            ],
          );
          const bookingId = bk[0].id as string;

          await tx.query(`UPDATE bids SET status = 'accepted' WHERE id = $1`, [bid.id]);
          // Expire all competing bids on this parcel.
          await tx.query(
            `UPDATE bids SET status = 'expired'
              WHERE parcel_id = $1 AND id <> $2 AND status = 'pending'`,
            [bid.parcel_id, bid.id],
          );
          await tx.query(
            `UPDATE parcels SET status = 'matched', contribution_amount_pennies = $2 WHERE id = $1`,
            [bid.parcel_id, bid.bid_contribution_pennies],
          );

          return {
            http: 201,
            body: { booking_id: bookingId, status: 'claimed' },
          } as const;
        });

        return reply.code(result.http).send(result.body);
      } catch (err) {
        if ((err as { capExceeded?: boolean }).capExceeded) {
          return reply.code(409).send({ error: 'cap_exceeded' });
        }
        throw err;
      }
    },
  );
}
