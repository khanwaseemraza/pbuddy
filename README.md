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
cp api/.env.example api/.env        # already points at the local Docker DB
npm run db:up                       # start local Postgres (Docker) — the dev DB
npm run db:migrate                  # apply db/migrations/*.sql
npm run api:dev                     # start the API on :8080 against the local DB
npm run api:test                   # tests boot their OWN throwaway Postgres — no setup needed
```

### Client app (Expo — iOS / Android / web)

```bash
cd app
npm install
cp .env.example .env                 # EXPO_PUBLIC_API_BASE_URL -> your API
npm run web                          # open the web app (phone-OTP sign-in)
npm run export:web                   # static web build -> app/dist
```

Phone-OTP sign-in uses Firebase. On **web** it works today (invisible reCAPTCHA);
add a **test phone number** in Firebase Console → Authentication → Sign-in method →
Phone to sign in without real SMS. **Native** (iOS/Android) phone auth needs a dev
build with `@react-native-firebase` (follow-up). After sign-in the app calls the
API with the Firebase ID token (see `app/app/home.tsx` loading `/corridors`).

**Environments.** Local dev runs the API on your machine against the local Docker
Postgres (free, offline). GCP is a separate environment: the API runs on **Cloud
Run** against **Cloud SQL** — same code and migrations, different `DATABASE_URL`.
A cloud API never points at a laptop DB. Container images are built by **Cloud
Build** (`gcloud builds submit --config infra/cloudbuild.yaml`), so no local
Docker is needed to deploy — only to run the local dev DB.

## Stack

GCP + Firebase. Cloud Run (API) · Cloud SQL for PostgreSQL · Firebase Auth (phone OTP) ·
Firestore (live status mirror) + FCM (push) · Cloud Storage · Stripe Connect (escrow) ·
Stripe Identity (KYC) · Anansi (embedded insurance) · postcodes.io + MapLibre + OSM (free maps).

## Live deployment (GCP — project pbuddy-mvp)

- **Web app:** https://pbuddy-mvp.web.app (Firebase Hosting; Expo web build)
- **API:** https://pbuddy-api-413412903611.europe-west2.run.app (Cloud Run, europe-west2)
- **DB:** Cloud SQL Postgres `pbuddy-db` (smallest, single-zone). Billed to the
  free-trial credit. Cloud Run scales to zero; Hosting is free — so the only idle
  cost is the DB. Pause it when not demoing:

```bash
infra/cloudsql.sh stop      # ~$2/mo storage only while stopped
infra/cloudsql.sh start
```

### Redeploy

```bash
# API (build + push + deploy)
gcloud builds submit --config infra/cloudbuild.yaml --region=europe-west2 .

# Migrations (via the Cloud SQL Auth Proxy, since Cloud Build has no socket)
cloud-sql-proxy --token "$(gcloud auth print-access-token)" --port 6543 \
  pbuddy-mvp:europe-west2:pbuddy-db &
DATABASE_URL='postgres://pbuddy:<pw>@127.0.0.1:6543/pbuddy' node db/migrate.mjs

# Web (build with the API URL, then deploy hosting)
cd app && EXPO_PUBLIC_API_BASE_URL=https://pbuddy-api-413412903611.europe-west2.run.app \
  npx expo export --platform web --clear && cd ..
firebase deploy --only hosting --project pbuddy-mvp
```

Runtime config: API runs with `AUTH_DEV_BYPASS=0` (real Firebase token verification),
`DATABASE_URL` + `STRIPE_SECRET_KEY` from Secret Manager, Cloud SQL via the connector,
and the runtime service account `pbuddy-run@` (Cloud SQL client + Firestore + secret access).
