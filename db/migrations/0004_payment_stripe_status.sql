-- Track Stripe's own view of the PaymentIntent (synced from webhooks), separate
-- from PBuddy's escrow state machine in payments.state.
BEGIN;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS stripe_status text;
COMMIT;
