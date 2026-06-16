# PBuddy — Disaster Recovery Runbook (Cloud SQL)

Scope: recovering the PBuddy Postgres database (`pbuddy-db`, `pbuddy-mvp:europe-west2:pbuddy-db`).
Postgres is the source of truth for all money-moving and compliance data, so its
recoverability is the backstop for the whole system.

## Protection in place (PBD-67)

- **Automated daily backups** — `02:00` UTC, **7** retained. (`settings.backupConfiguration.enabled=true`)
- **Point-in-time recovery (PITR)** — enabled; **7 days** of transaction logs, so we
  can recover to any second within the window. (`pointInTimeRecoveryEnabled=true`)
- **On-demand backups** — taken before risky migrations/ops (see below).

Verify current config:

```bash
gcloud sql instances describe pbuddy-db \
  --format="yaml(settings.backupConfiguration)"
gcloud sql backups list --instance=pbuddy-db --limit=5
```

## Objectives

- **RPO** (max data loss): ≤ 5 minutes, via PITR transaction logs.
- **RTO** (max time to recover): ≤ 60 minutes (clone + repoint Cloud Run).

## Before any risky change (migration, bulk update)

Take a labelled on-demand backup first:

```bash
gcloud sql backups create --instance=pbuddy-db --description="pre <change> $(git rev-parse --short HEAD)"
```

## Recovery procedures

### A. Point-in-time clone (preferred — data corruption / bad migration)

Recovers to a brand-new instance at a chosen timestamp; the original is untouched
until you repoint to the clone.

```bash
# 1. Clone to a timestamp just BEFORE the incident (RFC3339 UTC).
gcloud sql instances clone pbuddy-db pbuddy-db-restore \
  --point-in-time="2026-06-16T08:10:00Z"

# 2. Smoke-test the clone (row counts, latest compliance_audit_log entry, schema_migrations).
#    Use the Cloud SQL Auth Proxy against pbuddy-mvp:europe-west2:pbuddy-db-restore.

# 3. Repoint Cloud Run at the clone (update the DATABASE_URL secret's host/conn, then redeploy):
#    --add-cloudsql-instances=pbuddy-mvp:europe-west2:pbuddy-db-restore  (see infra/cloudbuild.yaml)

# 4. Once verified healthy, promote the clone (rename / make it the canonical instance) and
#    delete the corrupted original when safe:
gcloud sql instances delete pbuddy-db        # ONLY after the clone is confirmed canonical
```

### B. Restore from a backup (full instance loss)

```bash
gcloud sql backups list --instance=pbuddy-db
gcloud sql backups restore <BACKUP_ID> --restore-instance=pbuddy-db   # in place, OR
gcloud sql instances clone pbuddy-db pbuddy-db-restore --backup-id=<BACKUP_ID>  # to a new instance
```

## Post-recovery checklist

- [ ] `schema_migrations` shows all expected migrations applied.
- [ ] `compliance_audit_log` hash-chain intact (latest `row_hash` present); append-only trigger active.
- [ ] `/readyz` returns 200; a sample authenticated read works.
- [ ] Stripe reconciliation (`GET /payments/reconciliation`) reports `healthy: true`.
- [ ] Re-point monitoring/uptime if the instance name changed.

## Drill cadence

Run procedure **A** (clone to a scratch instance, smoke-test, then `gcloud sql instances delete pbuddy-db-restore`)
once per quarter. A clone spins a billable instance, so delete it as soon as the smoke test passes.
