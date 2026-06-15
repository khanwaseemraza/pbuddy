-- Track the Stripe Identity verification session per user so the webhook can
-- flip kyc_status when verification completes.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS kyc_session_id text;
COMMIT;
