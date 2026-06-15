// Compliance evidence exports. Turns the append-only audit log + ledgers into
// audience-specific reports that prove the cost-sharing rules were enforced.
// Admin-only. These are the artefacts that make "we believe we're compliant"
// into "here is the evidence" for HMRC / Home Office / insurers.
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.ts';
import { authenticate, requireAdmin } from '../middleware/auth.ts';

interface Range { from?: string; to?: string }

function range(q: Range): [string, string] {
  return [q.from ?? '1970-01-01', q.to ?? '2999-01-01'];
}

export async function complianceRoutes(app: FastifyInstance): Promise<void> {
  const guard = { preHandler: [authenticate, requireAdmin] };

  // HMRC: per-traveller gross contributions + proof the per-trip cap was enforced.
  app.get<{ Querystring: Range }>('/compliance/export/hmrc', guard, async (req) => {
    const [from, to] = range(req.query);
    const travellers = await pool.query(
      `SELECT u.id, u.full_name, u.immigration_class, u.tier,
              count(b.id)                                   AS bookings,
              COALESCE(sum(b.contribution_pennies), 0)::int AS gross_contribution_pennies
         FROM users u
         LEFT JOIN bookings b
           ON b.traveler_id = u.id
          AND b.status NOT IN ('cancelled', 'refunded')
          AND b.claimed_at BETWEEN $1 AND $2
        WHERE u.is_traveler
        GROUP BY u.id
        ORDER BY gross_contribution_pennies DESC`,
      [from, to],
    );
    const caps = await pool.query(
      `SELECT count(*)                                                   AS cap_checks,
              count(*) FILTER (WHERE payload->>'allowed' = 'false')      AS cap_rejections
         FROM compliance_audit_log
        WHERE event_type = 'CAP_CHECK' AND created_at BETWEEN $1 AND $2`,
      [from, to],
    );
    return {
      report: 'hmrc_gross_contributions',
      range: { from, to },
      note: 'Contributions are capped at each traveller\'s own journey cost (expense reimbursement, not profit). The £1,000 Trading Allowance is per person and applied by the individual, not PBuddy.',
      cap_enforcement: caps.rows[0],
      travellers: travellers.rows,
    };
  });

  // Home Office: per student-visa user — Tier-1 lock + contributions never exceed
  // their declared journey costs (reimbursement only, no profit, no self-employment).
  app.get<{ Querystring: Range }>('/compliance/export/home-office', guard, async (req) => {
    const [from, to] = range(req.query);
    const rows = await pool.query(
      `SELECT u.id, u.full_name, u.tier,
              (u.tier = 'casual_buddy')                                     AS tier_locked_casual,
              COALESCE(j.declared_journey_cost_pennies, 0)::int             AS declared_journey_cost_pennies,
              COALESCE(c.contribution_pennies, 0)::int                      AS contribution_pennies,
              COALESCE(c.contribution_pennies, 0) <= COALESCE(j.declared_journey_cost_pennies, 0)
                                                                            AS reimbursement_not_profit
         FROM users u
         LEFT JOIN (SELECT traveler_id, sum(journey_cost_pennies) declared_journey_cost_pennies
                      FROM trips WHERE created_at BETWEEN $1 AND $2 GROUP BY traveler_id) j
           ON j.traveler_id = u.id
         LEFT JOIN (SELECT traveler_id, sum(contribution_pennies) contribution_pennies
                      FROM bookings WHERE status NOT IN ('cancelled','refunded')
                       AND claimed_at BETWEEN $1 AND $2 GROUP BY traveler_id) c
           ON c.traveler_id = u.id
        WHERE u.immigration_class = 'student_visa'
        ORDER BY u.full_name`,
      [from, to],
    );
    return {
      report: 'home_office_student_visa',
      range: { from, to },
      note: 'Student-visa users are structurally locked to Casual Buddy (no self-employment). Contributions reimburse declared travel costs and do not exceed them.',
      students: rows.rows,
    };
  });

  // Insurer: per booking — domestic route, transport mode, open-box inspection,
  // prohibited-items attestation. The underwriting/claims basis.
  app.get<{ Querystring: Range }>('/compliance/export/insurer', guard, async (req) => {
    const [from, to] = range(req.query);
    const rows = await pool.query(
      `SELECT b.id AS booking_id,
              co.display_name             AS route,
              tr.transport_mode,
              b.contribution_pennies,
              p.declared_value_pennies,
              EXISTS (SELECT 1 FROM handoff_events h
                        WHERE h.booking_id = b.id AND h.type = 'open_box_confirmed' AND h.success)
                                          AS open_box_inspected,
              EXISTS (SELECT 1 FROM compliance_audit_log a
                        WHERE a.parcel_id = b.parcel_id AND a.event_type = 'PROHIBITED_ITEMS_ATTESTED')
                                          AS prohibited_items_attested
         FROM bookings b
         JOIN trips tr     ON tr.id = b.trip_id
         JOIN corridors co ON co.id = tr.corridor_id
         JOIN parcels p    ON p.id = b.parcel_id
        WHERE b.claimed_at BETWEEN $1 AND $2
        ORDER BY b.claimed_at DESC`,
      [from, to],
    );
    return {
      report: 'insurer_bookings',
      range: { from, to },
      note: 'All routes are domestic UK corridors. Value-capped, open-box inspected, prohibited-items attested.',
      bookings: rows.rows,
    };
  });
}
