// Ratings -> trust score. After a delivered/released booking, each participant
// may rate the other once. The ratee's trust_score is recomputed as their mean
// star rating, which feeds matching ranking.
import type { FastifyInstance } from 'fastify';
import { pool, withTransaction } from '../db.ts';
import { authenticate } from '../middleware/auth.ts';

interface ReviewBody { stars: number; comment?: string }

export async function reviewRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { id: string }; Body: ReviewBody }>(
    '/bookings/:id/reviews',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const rater = req.user!;
      const stars = Number(req.body?.stars);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
        return reply.code(400).send({ error: 'invalid_stars' });
      }
      const { rows } = await pool.query(
        `SELECT id, sender_id, traveler_id, status FROM bookings WHERE id = $1`,
        [req.params.id],
      );
      const b = rows[0];
      if (!b) return reply.code(404).send({ error: 'booking_not_found' });
      if (b.sender_id !== rater.id && b.traveler_id !== rater.id) {
        return reply.code(403).send({ error: 'not_a_participant' });
      }
      if (!['delivered', 'released'].includes(b.status)) {
        return reply.code(409).send({ error: 'not_rateable_yet', status: b.status });
      }
      const rateeId = b.sender_id === rater.id ? b.traveler_id : b.sender_id;
      const roleRated = b.sender_id === rater.id ? 'traveler' : 'sender';

      try {
        await withTransaction(async (tx) => {
          await tx.query(
            `INSERT INTO reviews (booking_id, rater_id, ratee_id, role_rated, stars, comment)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [b.id, rater.id, rateeId, roleRated, stars, req.body?.comment ?? null],
          );
          // Recompute the ratee's mean rating -> trust score.
          await tx.query(
            `UPDATE users u
                SET rating_count = agg.cnt,
                    rating_avg = agg.avg,
                    trust_score = agg.avg
               FROM (SELECT count(*) cnt, round(avg(stars), 2) avg
                       FROM reviews WHERE ratee_id = $1) agg
              WHERE u.id = $1`,
            [rateeId],
          );
        });
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.code(409).send({ error: 'already_reviewed' });
        }
        throw err;
      }
      return reply.code(201).send({ booking_id: b.id, ratee_id: rateeId, stars });
    },
  );
}
