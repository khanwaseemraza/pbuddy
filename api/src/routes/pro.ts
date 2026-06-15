// Pro Buddy enablement. The default Casual Buddy tier is the cost-sharing safe
// harbour (capped, throttled). Pro Buddy removes those limits, so it is gated
// behind the full legal apparatus: Right-to-Work verification (PBD-51), hire &
// reward insurance for car drivers (PBD-52), and an explicit taxable
// self-employment acknowledgment (PBD-53). The upgrade (PBD-54) enforces all of
// it and is impossible for student-visa users (DB constraint + check here).
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { pool } from '../db.ts';
import { authenticate } from '../middleware/auth.ts';
import { writeAudit } from '../lib/audit.ts';

export async function proRoutes(app: FastifyInstance): Promise<void> {
  // RTW verification (stub provider; a real async provider e.g. Amiqus/Yoti
  // goes behind a flag). Students cannot pass RTW for self-employment.
  app.post('/pro/rtw/start', { preHandler: [authenticate] }, async (req, reply) => {
    const user = req.user!;
    if (user.immigration_class === 'student_visa') {
      return reply.code(403).send({ error: 'students_cannot_work', message: 'Student visas prohibit self-employment.' });
    }
    const checkId = `rtw_${crypto.randomBytes(8).toString('hex')}`;
    await pool.query(`UPDATE users SET rtw_check_id = $2, rtw_status = 'verified' WHERE id = $1`, [user.id, checkId]);
    return reply.send({ rtw_status: 'verified', rtw_check_id: checkId });
  });

  // Hire & reward insurance for car drivers (Zego-class; stub for now).
  app.post('/pro/hire-reward', { preHandler: [authenticate] }, async (req, reply) => {
    const policyId = `zego_${crypto.randomBytes(8).toString('hex')}`;
    await pool.query(`UPDATE users SET hire_reward_policy_id = $2 WHERE id = $1`, [req.user!.id, policyId]);
    return reply.send({ hire_reward_policy_id: policyId });
  });

  // Upgrade Casual -> Pro. Enforces: not a student, RTW verified, explicit
  // self-employment acknowledgment. The DB constraints are the final backstop.
  app.post<{ Body: { self_employed_ack?: boolean } }>(
    '/pro/upgrade',
    { preHandler: [authenticate] },
    async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT id, immigration_class, tier, rtw_status, rtw_check_id, hire_reward_policy_id
           FROM users WHERE id = $1`,
        [req.user!.id],
      );
      const u = rows[0];
      if (u.tier === 'pro_buddy') return reply.code(409).send({ error: 'already_pro' });
      if (u.immigration_class === 'student_visa') {
        return reply.code(403).send({ error: 'students_cannot_be_pro' });
      }
      if (u.rtw_status !== 'verified') return reply.code(409).send({ error: 'rtw_required' });
      if (!req.body?.self_employed_ack) {
        return reply.code(400).send({
          error: 'self_employed_ack_required',
          message: 'Pro Buddy is taxable self-employment. You must acknowledge this — it is not cost-sharing.',
        });
      }

      try {
        await pool.query(
          `UPDATE users SET tier = 'pro_buddy', self_employed_ack_at = now() WHERE id = $1`,
          [u.id],
        );
      } catch {
        return reply.code(409).send({ error: 'upgrade_blocked' }); // DB constraint backstop
      }
      await writeAudit({
        eventType: 'TIER_TRANSITION',
        userId: u.id,
        payload: {
          from: 'casual_buddy',
          to: 'pro_buddy',
          rtw_check_id: u.rtw_check_id,
          hire_reward_policy_id: u.hire_reward_policy_id,
        },
      });
      return reply.send({ tier: 'pro_buddy' });
    },
  );
}
