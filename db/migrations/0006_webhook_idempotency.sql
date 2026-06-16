-- Webhook idempotency (PBD-64). Stripe delivers each event at-least-once and
-- retries on non-2xx, so the same event id can arrive multiple times. We record
-- every processed event id and treat a repeat as a no-op, so a replayed (or
-- maliciously re-sent) event can never re-run a money/identity side effect.
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id     text PRIMARY KEY,
  event_type   text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
