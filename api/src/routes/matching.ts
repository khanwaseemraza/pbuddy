import type { FastifyInstance } from 'fastify';
import { authenticate } from '../middleware/auth.ts';
import { candidatesForTrip, rankForTraveler } from '../services/matching.ts';
import { pool } from '../db.ts';

export async function matchingRoutes(app: FastifyInstance): Promise<void> {
  // Travellers: parcels their trip could carry, ranked.
  app.get<{ Params: { tripId: string } }>(
    '/trips/:tripId/matches',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { tripId } = req.params;
      const { rows } = await pool.query('SELECT traveler_id FROM trips WHERE id = $1', [tripId]);
      if (!rows[0]) return reply.code(404).send({ error: 'trip_not_found' });
      if (rows[0].traveler_id !== req.user!.id) {
        return reply.code(403).send({ error: 'not_your_trip' });
      }
      const candidates = await candidatesForTrip(tripId);
      return { matches: rankForTraveler(candidates) };
    },
  );
}
