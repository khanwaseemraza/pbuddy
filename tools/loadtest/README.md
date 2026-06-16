# PBuddy Load & Resilience Test (PBD-69)

In-process load harness that boots the API against an embedded Postgres and drives
the hot paths at concurrency. It measures handler + DB + cap-logic latency (the
real capacity driver), independent of network, and fails if an SLO is missed.

```bash
node --experimental-strip-types tools/loadtest/pilot-load.mjs
# tune:
VUS=100 DURATION_MS=30000 SLO_P95_MS=300 SLO_ERROR_RATE=0.01 \
  node --experimental-strip-types tools/loadtest/pilot-load.mjs
```

## Load profile

Weighted mix of the highest-frequency endpoints:

| weight | endpoint | type |
|---|---|---|
| 70% | `GET /corridors` | authenticated DB read |
| 20% | `GET /legal` | public read |
| 10% | `POST /users/me` | provisioning upsert (write) |

The full sender/traveller/escrow flow (post → bid → accept → fund → capture →
transfer) is exercised functionally by the integration suite (78 tests incl.
concurrent cap-reservation); this harness targets sustained throughput on the
hottest paths.

## SLOs

- **p95 app latency < 300 ms** (in-process)
- **error rate < 1%**
- **availability ≥ 99.5%** (uptime check + alert, PBD-66)

## Results (50 VUs × 15s, db-f1-micro)

| metric | value |
|---|---|
| throughput | ~13,000 req/s |
| errors | 0 (0.00%) |
| p50 / p95 / p99 | 3.8 / 5.9 / 7.6 ms |
| SLO | **PASS** |

Live network latency (warm, my machine → europe-west2, incl. TLS + DB): ~0.22–0.43 s
round-trip; lower for UK users closer to the region. App processing is a tiny
fraction of that — pilot latency is network/geo-bound, not CPU/DB-bound.

## Sizing recommendation (pilot)

- **Cloud Run:** `min-instances=0` (scale to zero — cost), default concurrency (80).
  **Cap `max-instances`** to protect Cloud SQL connections (see below).
- **Connection ceiling (the real constraint):** the pg pool is `max=10` per Cloud
  Run instance. `db-f1-micro` allows ~25–50 connections. So keep
  `Cloud Run max-instances × 10 ≤ Cloud SQL max_connections`. For the pilot set
  **`--max-instances=2`** (≤20 connections) or lower the pool to `max=5`. Revisit
  when scaling past the pilot.
- **Cloud SQL:** `db-f1-micro` is comfortable for pilot read/write volume; the
  capacity limit is connections, not CPU. Bump the tier (and pool) together when
  growth needs more concurrent instances.
- Re-run this harness (and a real-network k6 run against a staging deploy) before a
  public launch to validate against the chosen instance sizes.
