-- Greener scope (PBD-145): add bicycle + on-foot journeys to the transport modes.
-- ('car' stays in the enum for historical rows but is no longer offered in the
-- UI — motor vehicles are out of scope.) Enum values are additive; ADD VALUE IF
-- NOT EXISTS is idempotent and safe to re-run.
ALTER TYPE transport_mode ADD VALUE IF NOT EXISTS 'bike';
ALTER TYPE transport_mode ADD VALUE IF NOT EXISTS 'foot';
