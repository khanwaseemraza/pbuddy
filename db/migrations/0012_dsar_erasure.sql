-- GDPR data-subject rights (E16-S1). Records when a user exercised erasure so the
-- account is provably closed while the immutable compliance_audit_log is retained
-- under our legal-obligation basis (we anonymise PII on the user row but never
-- rewrite the audit trail).
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS erased_at timestamptz;

COMMIT;
