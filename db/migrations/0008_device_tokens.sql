-- Device push tokens (PBD-72). One row per registered device (FCM/Expo token);
-- a user can have several. Push on booking transitions targets these tokens.
CREATE TABLE IF NOT EXISTS device_tokens (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      text PRIMARY KEY,
  platform   text NOT NULL CHECK (platform IN ('ios','android','web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS device_tokens_user_idx ON device_tokens (user_id);
