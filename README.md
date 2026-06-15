# PBuddy

Cost-sharing peer-to-peer parcel delivery marketplace (UK). Senders post lightweight
parcels on intercity corridors; travellers already making that journey carry them in
spare luggage space; a QR/OTP hand-off unlocks an escrow payment.

> **The legal model is the architecture.** PBuddy stays a *cost-sharing /
> expense-reimbursement* platform (like BlaBlaCar), never *hire & reward* courier work.
> The compliance rules are **hardcoded as enforced invariants**, not buried in T&Cs.
> See [`docs/`](docs/) for the source pitch deck and the founder research conversation,
> and the build plan for the full rationale.

## The Cost-Sharing Invariant

> A traveller's cumulative accepted contributions on a given trip **≤ their own verified
> journey cost**, AND the user stays within "incidental traveller" frequency bounds.

Computed server-side, blocking at booking time, logged immutably. This is the firewall —
see [`api/src/services/caps.ts`](api/src/services/caps.ts) and
[`api/src/routes/bids.ts`](api/src/routes/bids.ts).

## Repo layout

| Path | What |
|---|---|
| `api/` | Cloud Run backend (Node + TypeScript + Fastify). All money-moving + cap enforcement. |
| `app/` | Expo (React Native + web) client — iOS, Android, web from one codebase. *(scaffolded next)* |
| `db/`  | SQL migrations. `0001_init.sql` is the schema incl. the firewall + audit log. |
| `infra/` | GCP / Cloud Build deploy config. |
| `docs/` | Source material: `pbuddy.txt` (deck), `conversation.json` (founder research). |

## Tiers

- **Casual Buddy** (default, the safe harbour) — capped + frequency-throttled, no
  Right-to-Work check, contributions framed as expense reimbursement. **Students locked here.**
- **Pro Buddy** (no limits) — uncapped earning, but gated behind Right-to-Work
  verification + hire&reward insurance + self-employed acknowledgment. Students cannot enter.

## Local dev

```bash
npm install
cp api/.env.example api/.env        # fill in DATABASE_URL + Firebase project id
npm run db:migrate                  # apply db/migrations/*.sql (needs DATABASE_URL)
npm run api:dev                     # start the API on :8080
npm run api:test                   # unit tests (DB-gated tests skip without DATABASE_URL)
```

## Stack

GCP + Firebase. Cloud Run (API) · Cloud SQL for PostgreSQL · Firebase Auth (phone OTP) ·
Firestore (live status mirror) + FCM (push) · Cloud Storage · Stripe Connect (escrow) ·
Stripe Identity (KYC) · Anansi (embedded insurance) · postcodes.io + MapLibre + OSM (free maps).
