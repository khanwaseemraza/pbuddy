// Trips: a traveller publishes a journey. The journey cost is captured and
// LOCKED here (it becomes the cap ceiling, ledger auto-created by trigger). The
// frequency throttle keeps Casual Buddy users looking like incidental
// travellers; Pro Buddy (gates satisfied) is exempt.
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.ts';
import { authenticate, requireKyc } from '../middleware/auth.ts';
import { writeAudit } from '../lib/audit.ts';
import { proBypassAllowed, type ProGate } from '../services/caps.ts';
import { evaluateFrequency, type FrequencyLimits } from '../services/frequency.ts';

interface CreateTripBody {
  corridor_id: string;
  direction: 'outbound' | 'return';
  transport_mode: 'train' | 'bus' | 'coach' | 'car';
  depart_at: string;
  capacity_pieces?: number;
  journey_cost_pennies: number;
  journey_cost_source: 'api_estimate' | 'receipt_upload' | 'self_declared';
  journey_cost_evidence_url?: string;
}

export async function tripRoutes(app: FastifyInstance): Promise<void> {
  // Public: the corridor allowlist is non-sensitive reference data, so visitors
  // can browse routes before signing up (auth is required only to transact).
  app.get('/corridors', async () => {
    const { rows } = await pool.query(
      `SELECT id, origin_city, dest_city, display_name
         FROM corridors WHERE is_active = true ORDER BY display_name`,
    );
    return { corridors: rows };
  });

  // ---- Traveller: list my trips (with remaining cost-sharing headroom) ----
  app.get('/trips', { preHandler: [authenticate] }, async (req) => {
    const { rows } = await pool.query(
      `SELECT t.id, t.direction, t.transport_mode, t.depart_at, t.status,
              t.journey_cost_pennies, l.committed_pennies, l.remaining_pennies,
              c.display_name AS corridor
         FROM trips t
         JOIN corridors c ON c.id = t.corridor_id
         JOIN trip_capacity_ledger l ON l.trip_id = t.id
        WHERE t.traveler_id = $1
        ORDER BY t.depart_at DESC`,
      [req.user!.id],
    );
    return { trips: rows };
  });

  app.post<{ Body: CreateTripBody }>(
    '/trips',
    { preHandler: [authenticate, requireKyc] },
    async (req, reply) => {
      const user = req.user!;
      const b = req.body;
      if (!Number.isInteger(b.journey_cost_pennies) || b.journey_cost_pennies < 0) {
        return reply.code(400).send({ error: 'invalid_journey_cost' });
      }

      // Corridor must be on the allowlist (domestic-only guardrail).
      const { rows: crows } = await pool.query(
        `SELECT id FROM corridors WHERE id = $1 AND is_active = true`,
        [b.corridor_id],
      );
      if (!crows[0]) return reply.code(400).send({ error: 'unknown_or_inactive_corridor' });

      // Pro Buddy gate check.
      const gate: ProGate = {
        tier: user.tier,
        rtwStatus: user.rtw_status,
        hireRewardPolicyId: null, // not needed to publish; enforced at bid time for car
        transportMode: b.transport_mode,
      };
      const proExempt = user.tier === 'pro_buddy' && proBypassAllowed({ ...gate, hireRewardPolicyId: 'n/a' });

      // Frequency throttle (Casual only).
      const cfg = (await pool.query(
        `SELECT max_trips_per_week_global, max_trips_per_route_week, max_trips_per_month
           FROM compliance_config WHERE id = 1`,
      )).rows[0];
      const limits: FrequencyLimits = {
        maxPerWeekGlobal: cfg.max_trips_per_week_global,
        maxPerRouteWeek: cfg.max_trips_per_route_week,
        maxPerMonth: cfg.max_trips_per_month,
      };
      const counts = (await pool.query(
        `SELECT
           count(*) FILTER (WHERE created_at > now() - interval '7 days')                       AS week_global,
           count(*) FILTER (WHERE created_at > now() - interval '7 days' AND corridor_id = $2)   AS week_route,
           count(*) FILTER (WHERE created_at > now() - interval '30 days')                       AS month
         FROM trips WHERE traveler_id = $1 AND status <> 'cancelled'`,
        [user.id, b.corridor_id],
      )).rows[0];
      const freq = evaluateFrequency(
        {
          tripsThisWeekGlobal: Number(counts.week_global),
          tripsThisWeekRoute: Number(counts.week_route),
          tripsThisMonth: Number(counts.month),
        },
        limits,
      );
      await writeAudit({
        eventType: 'FREQUENCY_CHECK',
        userId: user.id,
        payload: { proExempt, decision: freq, counts },
      });
      if (!proExempt && !freq.allowed) {
        return reply.code(429).send({
          error: 'frequency_limit',
          reason: freq.reason,
          message: "You've reached your travel limit for this period. PBuddy is for trips you're already taking.",
          upgrade_to_pro_buddy: freq.upgradeSignal && user.immigration_class !== 'student_visa',
        });
      }

      const { rows } = await pool.query(
        `INSERT INTO trips (traveler_id, corridor_id, direction, transport_mode, depart_at,
                            capacity_pieces, journey_cost_pennies, journey_cost_source, journey_cost_evidence_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING id, journey_cost_pennies, cost_locked_at, status`,
        [user.id, b.corridor_id, b.direction, b.transport_mode, b.depart_at,
         b.capacity_pieces ?? 3, b.journey_cost_pennies, b.journey_cost_source,
         b.journey_cost_evidence_url ?? null],
      );
      const trip = rows[0];
      if (!user.is_traveler) {
        await pool.query(`UPDATE users SET is_traveler = true WHERE id = $1`, [user.id]);
      }
      await writeAudit({
        eventType: 'CAP_COMPUTED',
        userId: user.id,
        tripId: trip.id,
        payload: { capPennies: trip.journey_cost_pennies, source: b.journey_cost_source },
      });
      return reply.code(201).send(trip);
    },
  );
}
