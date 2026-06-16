// Payments / escrow. Implements the marketplace money flow with Stripe Connect
// using separate charges and transfers + manual capture:
//   fund    -> authorize the sender (manual capture)  [payment: authorized]
//   capture -> hold funds on the platform (on pickup)  [payment: captured]
//   payout  -> transfer the contribution to the traveller (on dropoff) [released]
//   refund  -> cancel/refund + release the reserved capacity            [refunded]
// capture/payout are admin-gated here; the hand-off epic (E5) will trigger them
// from QR scans. Money logic is server-side only.
import type { FastifyInstance } from 'fastify';
import { pool, withTransaction } from '../db.ts';
import { config } from '../config.ts';
import { authenticate, requireKyc, requireAdmin } from '../middleware/auth.ts';
import { computeBookingCharges } from '../services/payments.ts';
import { canTransition, type BookingStatus } from '../services/bookingLifecycle.ts';
import { releaseCapacity } from '../services/caps.ts';
import { mirrorBookingStatus } from '../lib/mirror.ts';
import { writeAudit } from '../lib/audit.ts';
import { generateLegCode } from '../services/handoff.ts';
import { bindPolicy } from '../lib/insurance.ts';
import {
  createConnectAccount,
  createOnboardingLink,
  createEscrowPaymentIntent,
  capturePaymentIntent,
  cancelPaymentIntent,
  createTransfer,
  refundPaymentIntent,
  constructWebhookEvent,
} from '../lib/stripe.ts';

export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  // ---- Traveller: onboard as a payee (Connect Express) ----
  app.post('/connect/onboard', { preHandler: [authenticate, requireKyc] }, async (req, reply) => {
    const user = req.user!;
    let connectId = (
      await pool.query('SELECT stripe_connect_id, email FROM users WHERE id = $1', [user.id])
    ).rows[0]?.stripe_connect_id as string | null;
    const email = (await pool.query('SELECT email FROM users WHERE id = $1', [user.id])).rows[0]?.email;

    if (!connectId) {
      connectId = await createConnectAccount(email ?? undefined);
      await pool.query('UPDATE users SET stripe_connect_id = $2 WHERE id = $1', [user.id, connectId]);
    }
    const url = await createOnboardingLink(connectId);
    return reply.send({ stripe_connect_id: connectId, onboarding_url: url });
  });

  // ---- Sender: fund the escrow (authorize, manual capture) ----
  app.post<{ Params: { id: string }; Body: { with_insurance?: boolean } }>(
    '/bookings/:id/fund',
    { preHandler: [authenticate, requireKyc] },
    async (req, reply) => {
      const user = req.user!;
      const { rows } = await pool.query(
        `SELECT b.id, b.sender_id, b.status, b.contribution_pennies, b.parcel_id,
                p.declared_value_pennies
           FROM bookings b JOIN parcels p ON p.id = b.parcel_id
          WHERE b.id = $1`,
        [req.params.id],
      );
      const booking = rows[0];
      if (!booking) return reply.code(404).send({ error: 'booking_not_found' });
      if (booking.sender_id !== user.id) return reply.code(403).send({ error: 'not_your_booking' });
      if (booking.status !== 'claimed') {
        return reply.code(409).send({ error: 'not_fundable', status: booking.status });
      }
      const existing = await pool.query('SELECT 1 FROM payments WHERE booking_id = $1', [booking.id]);
      if (existing.rowCount) return reply.code(409).send({ error: 'already_funded' });

      const charges = computeBookingCharges(booking.contribution_pennies, {
        withInsurance: req.body?.with_insurance ?? true,
      });
      const pi = await createEscrowPaymentIntent({
        amountPennies: charges.grossPennies,
        bookingId: booking.id,
      });

      await pool.query(
        `INSERT INTO payments (booking_id, stripe_payment_intent_id, gross_pennies,
            platform_fee_pennies, escrow_fee_pennies, insurance_cost_pennies,
            traveler_payout_pennies, state)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'authorized')`,
        [booking.id, pi.id, charges.grossPennies, charges.platformFeePennies,
         charges.escrowFeePennies, charges.insuranceCostPennies, charges.travelerPayoutPennies],
      );
      // Generate the hand-off codes for this booking (shown by the sender/recipient,
      // scanned/entered by the traveller). Stored: QR tokens + hashed OTPs.
      const pickup = generateLegCode(booking.id);
      const dropoff = generateLegCode(booking.id);
      await pool.query(
        `UPDATE bookings
            SET status = 'funded', funded_at = now(),
                pickup_qr_token = $2, pickup_otp_hash = $3,
                dropoff_qr_token = $4, dropoff_otp_hash = $5
          WHERE id = $1`,
        [booking.id, pickup.qrToken, pickup.otpHash, dropoff.qrToken, dropoff.otpHash],
      );
      void mirrorBookingStatus(booking.id);

      // Bind embedded parcel cover (the sender already paid the premium above).
      if (charges.insuranceCostPennies > 0) {
        const policy = bindPolicy({ bookingId: booking.id, coverPennies: booking.declared_value_pennies });
        await pool.query(
          `INSERT INTO insurance_policies
             (booking_id, provider, policy_ref, cover_pennies, premium_cost_pennies,
              premium_charged_pennies, terms_version, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'active')`,
          [booking.id, policy.provider, policy.policyRef, policy.coverPennies,
           policy.premiumCostPennies, policy.premiumChargedPennies, policy.termsVersion],
        );
        await writeAudit({
          eventType: 'INSURANCE_BOUND',
          userId: user.id,
          bookingId: booking.id,
          parcelId: booking.parcel_id,
          payload: { provider: policy.provider, policy_ref: policy.policyRef, cover_pennies: policy.coverPennies },
        });
      }

      return reply.code(201).send({
        booking_id: booking.id,
        client_secret: pi.clientSecret,
        payment_intent_id: pi.id,
        charges,
        // The sender shows the pickup code and shares the dropoff code with the recipient.
        handoff_codes: {
          pickup_qr: pickup.qrToken, pickup_otp: pickup.otp,
          dropoff_qr: dropoff.qrToken, dropoff_otp: dropoff.otp,
        },
      });
    },
  );

  // ---- Capture the held funds (pickup; admin-gated for now) ----
  app.post<{ Params: { id: string } }>(
    '/bookings/:id/capture',
    { preHandler: [authenticate, requireAdmin] },
    async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT id, stripe_payment_intent_id, state FROM payments WHERE booking_id = $1`,
        [req.params.id],
      );
      const payment = rows[0];
      if (!payment) return reply.code(404).send({ error: 'no_payment' });
      if (payment.state !== 'authorized') {
        return reply.code(409).send({ error: 'not_capturable', state: payment.state });
      }
      const status = await capturePaymentIntent(payment.stripe_payment_intent_id);
      await pool.query(
        `UPDATE payments SET state = 'captured', captured_at = now() WHERE id = $1`,
        [payment.id],
      );
      return reply.send({ booking_id: req.params.id, payment_state: 'captured', stripe_status: status });
    },
  );

  // ---- Pay out the contribution to the traveller (dropoff; admin-gated) ----
  app.post<{ Params: { id: string } }>(
    '/bookings/:id/payout',
    { preHandler: [authenticate, requireAdmin] },
    async (req, reply) => {
      const { rows } = await pool.query(
        `SELECT p.id, p.state, p.traveler_payout_pennies, b.id AS booking_id,
                u.stripe_connect_id
           FROM payments p
           JOIN bookings b ON b.id = p.booking_id
           JOIN users u ON u.id = b.traveler_id
          WHERE p.booking_id = $1`,
        [req.params.id],
      );
      const row = rows[0];
      if (!row) return reply.code(404).send({ error: 'no_payment' });
      if (row.state !== 'captured') return reply.code(409).send({ error: 'not_payable', state: row.state });
      if (!row.stripe_connect_id) return reply.code(409).send({ error: 'traveller_not_onboarded' });

      const transferId = await createTransfer({
        amountPennies: row.traveler_payout_pennies,
        destinationAccountId: row.stripe_connect_id,
        bookingId: row.booking_id,
      });
      await pool.query(
        `UPDATE payments SET state = 'released', released_at = now(), stripe_transfer_id = $2 WHERE id = $1`,
        [row.id, transferId],
      );
      return reply.send({ booking_id: req.params.id, payment_state: 'released', transfer_id: transferId });
    },
  );

  // ---- Refund + release the reserved capacity (admin-gated) ----
  app.post<{ Params: { id: string } }>(
    '/bookings/:id/refund',
    { preHandler: [authenticate, requireAdmin] },
    async (req, reply) => {
      const result = await withTransaction(async (tx) => {
        const { rows } = await tx.query(
          `SELECT p.id, p.state, p.stripe_payment_intent_id,
                  b.id AS booking_id, b.status AS booking_status, b.trip_id,
                  b.contribution_pennies, bd.bid_pieces
             FROM payments p
             JOIN bookings b ON b.id = p.booking_id
             JOIN bids bd ON bd.id = b.bid_id
            WHERE p.booking_id = $1 FOR UPDATE OF p`,
          [req.params.id],
        );
        const row = rows[0];
        if (!row) return { http: 404, body: { error: 'no_payment' } } as const;
        if (row.state === 'refunded') return { http: 409, body: { error: 'already_refunded' } } as const;

        // authorized -> cancel the uncaptured hold; captured -> refund.
        if (row.state === 'authorized') await cancelPaymentIntent(row.stripe_payment_intent_id);
        else await refundPaymentIntent(row.stripe_payment_intent_id);

        await tx.query(`UPDATE payments SET state = 'refunded' WHERE id = $1`, [row.id]);
        if (canTransition(row.booking_status as BookingStatus, 'refunded')) {
          await tx.query(`UPDATE bookings SET status = 'refunded' WHERE id = $1`, [row.booking_id]);
        }
        await releaseCapacity(tx, row.trip_id, row.contribution_pennies, row.bid_pieces);
        return { http: 200, body: { booking_id: row.booking_id, payment_state: 'refunded' } } as const;
      });
      if (result.http === 200) void mirrorBookingStatus(req.params.id);
      return reply.code(result.http).send(result.body);
    },
  );

  // ---- Reconciliation report (admin) ----
  app.get('/payments/reconciliation', { preHandler: [authenticate, requireAdmin] }, async () => {
    const byState = await pool.query(
      `SELECT state,
              count(*)                                                          AS count,
              COALESCE(sum(gross_pennies), 0)::int                              AS gross_pennies,
              COALESCE(sum(traveler_payout_pennies), 0)::int                    AS traveler_payout_pennies,
              COALESCE(sum(platform_fee_pennies + escrow_fee_pennies), 0)::int  AS platform_fees_pennies
         FROM payments GROUP BY state ORDER BY state`,
    );
    // Platform take on released bookings: fees + insurance margin.
    const revenue = await pool.query(
      `SELECT COALESCE(sum(platform_fee_pennies + escrow_fee_pennies
              + GREATEST(0, insurance_cost_pennies - $1)), 0)::int AS platform_revenue_pennies,
              COALESCE(sum(traveler_payout_pennies), 0)::int       AS travellers_paid_pennies
         FROM payments WHERE state = 'released'`,
      [config.insuranceCostPennies],
    );
    // Ledger/booking consistency checks.
    const inconsistencies = await pool.query(
      `SELECT b.id AS booking_id, b.status AS booking_status, p.state AS payment_state, reason FROM (
         SELECT b.id, 'booking_released_payment_not' AS reason
           FROM bookings b JOIN payments p ON p.booking_id = b.id
          WHERE b.status = 'released' AND p.state <> 'released'
         UNION ALL
         SELECT b.id, 'payment_released_booking_not'
           FROM bookings b JOIN payments p ON p.booking_id = b.id
          WHERE p.state = 'released' AND b.status <> 'released'
         UNION ALL
         SELECT b.id, 'captured_but_booking_pre_pickup'
           FROM bookings b JOIN payments p ON p.booking_id = b.id
          WHERE p.state = 'captured' AND b.status NOT IN ('picked_up','delivered','disputed','released')
       ) AS issues
       JOIN bookings b ON b.id = issues.id
       JOIN payments p ON p.booking_id = b.id
       LIMIT 100`,
    );
    return {
      report: 'payments_reconciliation',
      by_state: byState.rows,
      revenue: revenue.rows[0],
      inconsistencies: inconsistencies.rows,
      healthy: inconsistencies.rowCount === 0,
    };
  });

  // ---- Stripe webhook (encapsulated so it gets the raw body for signing) ----
  app.register(async (web) => {
    web.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) =>
      done(null, body),
    );
    web.post('/stripe/webhook', async (req, reply) => {
      const sig = req.headers['stripe-signature'] as string | undefined;
      let event: { id: string; type: string; data: { object: { id: string; status?: string } } };
      // Webhooks move money and flip KYC, so an unsigned/forged event must never
      // be processed in production. If a signing secret is configured we ALWAYS
      // verify (and reject a missing/invalid signature). The unsigned JSON path
      // exists only for local dev/tests (AUTH_DEV_BYPASS); a prod deploy without
      // a secret refuses to process rather than trusting the body.
      if (config.stripeWebhookSecret) {
        if (!sig) return reply.code(400).send({ error: 'missing_signature' });
        try {
          event = constructWebhookEvent(req.body as Buffer, sig) as never;
        } catch {
          return reply.code(400).send({ error: 'invalid_signature' });
        }
      } else if (config.authDevBypass) {
        try {
          event = JSON.parse((req.body as Buffer).toString());
        } catch {
          return reply.code(400).send({ error: 'invalid_payload' });
        }
      } else {
        req.log.error('stripe webhook received but STRIPE_WEBHOOK_SECRET is not set');
        return reply.code(500).send({ error: 'webhook_not_configured' });
      }

      // Idempotency: record the event id first; a repeat delivery (Stripe retries,
      // or a replayed event within the signature tolerance) is a no-op so no side
      // effect ever runs twice.
      if (event.id) {
        const seen = await pool.query(
          `INSERT INTO processed_webhook_events (event_id, event_type)
           VALUES ($1, $2) ON CONFLICT (event_id) DO NOTHING`,
          [event.id, event.type],
        );
        if (seen.rowCount === 0) return reply.send({ received: true, duplicate: true });
      }

      // Keep the payment row loosely in sync with Stripe's view.
      if (event.type.startsWith('payment_intent.')) {
        const pi = event.data.object;
        await pool.query(
          `UPDATE payments SET stripe_status = $2 WHERE stripe_payment_intent_id = $1`,
          [pi.id, pi.status ?? null],
        );
      }
      // Identity verification result -> flip the user's KYC status.
      if (event.type.startsWith('identity.verification_session.')) {
        const vs = event.data.object;
        const kyc = event.type.endsWith('.verified')
          ? 'verified'
          : event.type.endsWith('.requires_input')
            ? 'rejected'
            : event.type.endsWith('.canceled')
              ? 'unverified'
              : null;
        if (kyc) {
          await pool.query(`UPDATE users SET kyc_status = $2 WHERE kyc_session_id = $1`, [vs.id, kyc]);
        }
      }
      return reply.send({ received: true });
    });
  });
}
