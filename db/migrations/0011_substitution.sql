-- Right of substitution (epic E21-S5 / PBD-139). A genuine, exercisable right for
-- a Buddy to appoint another verified Buddy to fulfil an accepted booking before
-- pickup. Personal service is the irreducible core of "worker" status; a real
-- substitution right is the strongest structural signal that a Buddy is an
-- independent contractor, not a worker of PBuddy. We record the chain for audit.
BEGIN;

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS substituted_from_user_id uuid REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS substituted_at timestamptz;

COMMIT;
