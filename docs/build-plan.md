# PBuddy — MVP Build Plan

## Context

PBuddy is a pre-seed, founder-built UK peer-to-peer parcel delivery marketplace. Senders post lightweight parcels on intercity routes (e.g. London–Manchester); travelers already making that journey carry them in spare luggage space; a QR/OTP handoff at pickup and dropoff unlocks an escrow payment. Revenue = 10–15% platform fee on the sender + a flat £1.50 escrow fee + embedded parcel-insurance margin (buy micro-policy ~£0.50, sell ~£1.99).

Today the project is **just a pitch deck (`pbuddy.txt`) and a founder↔AI conversation (`conversation.json`)** — there is no code. This plan turns that into a build-ready MVP whose goal is to **prove unit economics + two-sided liquidity on 2–3 corridors** so the next raise is defensible.

**The central design constraint** (established in depth in `conversation.json`): PBuddy's legal survival depends on staying a **"cost-sharing / expense-reimbursement"** platform (like BlaBlaCar) and never crossing into **"hire & reward" / gig-economy** courier work. If it crosses that line: car drivers need Hire&Reward insurance, everyone needs Right-to-Work checks, international students (a core demographic) become *illegal to use it*, and contributions become taxable. Therefore the compliance rules must be **hardcoded as enforced invariants**, not written in terms of service. The legal model is the architecture.

This plan was chosen over alternatives (improved deck, investor pack) because the user wants to **build the MVP** with the cost-sharing rules baked in, plus GTM sequencing.

---

## Guiding principle: the Cost-Sharing Invariant

> A traveler's cumulative accepted contributions on a given trip **≤ their own verified journey cost**, AND the user stays within "incidental traveler" frequency bounds.

This is computed **server-side, blocking at booking time, and logged immutably**. Treat it like a financial-ledger invariant, not a UX nudge. Build it *before* any matching UI.

---

## Recommended stack (GCP + Firebase)

All-Google infrastructure as requested, with **one Expo codebase targeting iOS, Android AND web** (so there *is* a web app — same code, via react-native-web). Domain: **pbuddy.co.uk**.

| Layer | Pick | Why |
|---|---|---|
| Client (iOS + Android + **web**) | **Expo (React Native + react-native-web), TypeScript, Expo Router** | One codebase → all three platforms. Native camera/QR + push on mobile; the same routes render as a responsive web app for senders/SEO. EAS OTA updates hot-patch the live handoff flow without store review. |
| Auth | **Firebase Authentication (phone OTP)** | As requested. Phone-number sign-in across mobile + web; well-supported in Expo via `@react-native-firebase` (native) and Firebase JS SDK (web). Issues an ID token the backend verifies on every call. |
| Backend / API | **Cloud Run** (containerized Node/TS — Fastify/Express) | All money-moving + cap-enforcement + webhooks live here, server-side only; client never holds privileged keys. Scales to zero (cheap at pilot volume), deploys via Cloud Build. |
| Relational DB | **Cloud SQL for PostgreSQL** | Relational is required for the marketplace + escrow ledger + cap invariant + audit log (NOT Firestore for money). Reached *only* through the Cloud Run API. |
| Realtime status + push | **Firestore** (live booking-status mirror) + **Firebase Cloud Messaging** (push) | Client subscribes to a per-booking status doc Firestore for live updates; FCM for handoff alerts. Source of truth stays in Postgres; Firestore is a read mirror written by the API. |
| File storage | **Google Cloud Storage** | ID + parcel photos; signed URLs issued by the API. |
| Maps + UK addresses (free) | **MapLibre GL** + **OpenStreetMap** tiles + **postcodes.io** | All free. See "Maps & real addresses" below. |
| Payments + escrow | **Stripe Connect** (Express payees, separate charges & transfers, manual capture) | Cloud-agnostic; UK-native, marketplace-built; Stripe runs payee KYC/AML. |
| KYC (both sides) | **Stripe Identity** | One vendor, one dashboard. Defer Onfido unless pass rate disappoints. |
| Insurance | **Anansi** (UK embedded parcel cover) | Stub in v1, wire real API once volume justifies the contract. |
| Secrets / CI / DNS / hosting | **Secret Manager**, **Cloud Build**, **Cloud DNS**, **Firebase Hosting** (web build at pbuddy.co.uk) | One cloud, one bill. |
| Admin / ops | **Retool** (or a small internal web console on Cloud Run) | Founder is the ops/dispute team in pilot. |

**Authz note (replaces Supabase RLS):** clients never touch the DB directly. Every request hits the Cloud Run API, which verifies the Firebase ID token and scopes all queries by `user_id`. Postgres row-level security can be added as defense-in-depth, but the API is the gate.

Custody nodes, in-app chat, wallet, free-text routes, car mode — **deferred**. Corridors stay a curated allowlist (city pairs) for the compliance/domestic-only guardrail, but pickup/dropoff points within them are **real postcodes/addresses on a map** (below).

## Maps & real addresses (free, real UK postcodes)

The compliance guardrail (domestic-only, curated corridors) and the "real pins" requirement coexist: the **corridor** = an allowlisted city pair; the **pickup/dropoff point** = a real, validated UK address shown on a map.

- **Postcode/address validation & geocoding — [postcodes.io](https://postcodes.io)** (free, open, no key): validate any UK postcode, get lat/lng, autocomplete, reverse-geocode, and confirm both ends are GB (reinforces the domestic-only rule). Self-hostable on GCP if rate limits bite.
- **Map display & pins — MapLibre GL JS/Native + OpenStreetMap raster tiles** (free, no per-call billing, no Google Maps key). Renders identically on web + mobile.
- **Address entry:** postcode field → postcodes.io lookup → user confirms/edits street address → store `postcode`, `address_line`, `lat`, `lng`. Pins on the map reflect these real coordinates.
- Avoids Google Maps Platform billing entirely; if richer address autocomplete is later needed, OS Places API (OS Data Hub free tier) is the UK-native upgrade.

---

## Data model (Postgres, money in pence)

Core entities — full field lists in build notes; the legally-critical ones are starred:

- **users** — roles additive (`is_sender`, `is_traveler`), `kyc_status`, `stripe_connect_id`, `trust_score`, `accepted_terms_at`, **★`immigration_class`** (`uk_citizen_settled`/`student_visa`/`other_visa`/`undeclared`), **★`tier`** (`casual_buddy`/`pro_buddy`, default `casual_buddy`), plus Pro-only: `rtw_check_id`, `rtw_status`, `hire_reward_policy_id`, `self_employed_ack_at`.
- **★routes / corridors** — **allowlist only**, domestic UK city pairs; no international/Eurostar/airport nodes exist in the table at all; both ends GB-postcode validated.
- **trips** — traveler's journey: `route_id`, `transport_mode` (train/bus/coach/car), **★`journey_cost_pennies`**, `journey_cost_source` (`api_estimate`/`receipt_upload`/`self_declared`), `journey_cost_evidence_url`, **★`cost_locked_at`**.
- **★trip_capacity_ledger** — `trip_id`, `cap_pennies`, `committed_contributions_pennies`, `remaining_pennies` (the firewall).
- **parcels** — `route_id`, **pickup + dropoff real address** (`pickup_postcode`/`pickup_address_line`/`pickup_lat`/`pickup_lng`, same for dropoff; both GB-validated via postcodes.io), size/weight bands, `length/width/height_cm`, `piece_count`, **★`declared_value_pennies`** (check-constrained ≤ cap), `category` (excludes prohibited), `pricing_mode` (`fixed`/`auction`), `suggested_contribution_pennies` (platform estimate, ≤ cap), `max_contribution_pennies` (sender ceiling), `contribution_amount_pennies` (NEVER named "fee"/"price").
- **★bids / offers** — `parcel_id`, `trip_id`, `traveler_id`, `bid_contribution_pennies` (**cap-validated at creation**), `status` (`pending`/`accepted`/`declined`/`withdrawn`/`expired`), `expires_at`. Drives the bidding engine below.
- **bookings** — contract created when a bid is accepted (one parcel ↔ one trip); lifecycle `claimed→funded→picked_up→delivered→released/refunded/disputed`; `pickup_otp`/`dropoff_otp` (hashed), QR tokens.
- **payments (escrow ledger)** — Stripe intent/transfer ids; `gross`, `platform_fee`, `escrow_fee`, `insurance_cost`, `traveler_payout`; state `authorized→captured(held)→released/refunded`.
- **handoff_events** — append-only: `open_box_confirmed`, `pickup_scan`, `dropoff_scan`, geo, photo, checklist version.
- **insurance_policies**, **reviews**, **disputes**, **user_trip_counters** (rolling frequency).
- **★compliance_audit_log** — append-only / hash-chained (see below).

DB-enforced invariants (not just app code): one active booking per parcel; money state transitions only via Cloud Run handlers reacting to signed Stripe webhooks; a booking **cannot reach `picked_up` without an `open_box_confirmed` event**; `declared_value` and per-trip cap enforced as constraints.

---

## Compliance-as-code — legal rule → product rule

This is the differentiator. Each rule lives in the data model + blocking server logic + versioned UI copy.

1. **Payment framing** — no string anywhere (UI, DB columns, receipts) says "fee/earnings/income/delivery fee/wage/job." Money is a **`contribution_amount`** toward the traveler's journey. Copy lives in a versioned `legal_copy` config table; a **CI banned-word lint** over UI strings + column names enforces it. Each transaction snapshots `framing_version`.
2. **Hard per-trip cap** — `committed + new_contribution ≤ trip.journey_cost`. Journey cost captured tiered: (a) rail/coach fares API for the standard fare on that date = ceiling; (b) optional receipt OCR raises trust, capped at the API fare; (c) car = conservative fuel-only mileage estimate. **Cap locked at trip creation** so it can't be inflated retroactively. Enforced atomically with a row lock on `trip_capacity_ledger`; multi-parcel trips share one cap; cancellations return capacity (audited).
3. **Trip-frequency throttle** — block trip *publication* over `MAX_TRIPS_PER_WEEK` (~3) global + per-route. Non-judgmental copy ("PBuddy is for trips you're already taking"). Hitting the ceiling = a **Pro Buddy upgrade signal** (invite eligible non-students to upgrade), not a permanent block.
4. **£1,000 Trading Allowance = disclosure, not gate** — the legal basis is expense-reimbursement framing, *not* the allowance. Track annual gross per user; when a domestic non-student crosses ~£1k, show a one-time dismissible tax-disclosure banner (log acknowledgment). Never show "you're within your tax-free allowance."
5. **International students = visa-safe by structure** — `student_visa` users **hard-locked to Casual Buddy** (Pro Buddy impossible at the data layer), stricter caps + throttle, explicit "this is cost-sharing, not work/self-employment" copy (logged). Aim to keep cumulative contributions ≤ cumulative declared journey costs (reimbursement, never profit). **#1 item for solicitor sign-off.**
6. **Transport mode branch** — public transport (train/bus/coach): standard caps + National Rail luggage gate (≤3 pieces, no dimension >1m). Car: conservative fuel-only cap + insurance-validity acknowledgment. **Recommendation: launch public-transport-only; defer cars** until a solicitor + insurer bless the car cost-sharing math (biggest liability, smallest incremental supply on rail corridors).
7. **Domestic allowlist** — routes selectable only from the seeded enum; both ends GB-postcode.
8. **Open-Box Policy** — parcels unsealed; mandatory inspection checklist at handoff before escrow arms ("I've seen contents / no prohibited items / matches listing"), logged with geo + checklist version. Sender attests prohibited-items declaration at posting.
9. **Value cap + embedded insurance** — `declared_value ≤ £250` (pilot: tighter, e.g. £100); mandatory insurance auto-added at checkout, framed separately from the contribution; claims tie to open-box attestation.
10. **Two tiers — Casual Buddy & Pro Buddy.** The tier boundary is a hard branch in caps, frequency, insurance, onboarding gates, and tax messaging.
    - **Casual Buddy** (default, the safe harbour): per-trip cap + frequency throttle enforced; **no** Right-to-Work check, **no** hire&reward needed; contributions framed as expense reimbursement. **Students are hard-locked here.** This is the tier the whole compliance design above protects.
    - **Pro Buddy** (no limits — "work as much as you want"): **no per-trip cap, no frequency throttle** — a real earning/gig tier. Precisely *because* it removes the limits, it leaves the cost-sharing safe harbour, so it is **gated behind the full legal apparatus**, all required *before* the tier activates: (a) **Right-to-Work verification** (`rtw_status = verified`) — this is what makes uncapped earning lawful and is why students/visa-restricted users **cannot** be Pro Buddy; (b) **hire & reward insurance** (Zego-class) for car drivers (`hire_reward_policy_id`); (c) explicit **"this is taxable self-employment"** acknowledgment (`self_employed_ack_at`) with proper tax messaging (no Trading-Allowance framing). Pricing/earnings for Pro Buddy are *not* clamped to journey cost.
    - **Branch enforcement:** the matching/bidding cap-check and frequency throttle apply to `casual_buddy` only; for `pro_buddy` they are bypassed *but* every Pro action checks `rtw_status = verified` (+ hire&reward for car) first, else the action is blocked. `student_visa` → `pro_buddy` transition is impossible at the data layer. Every `TIER_TRANSITION` is audited with the RTW/insurance evidence refs.

### Compliance evidence trail
Append-only **`compliance_audit_log`** (write-once / hash-chained), written on every legally-relevant decision: `CAP_COMPUTED`, `CAP_CHECK` (cap, before, contribution, after, decision), `FREQUENCY_CHECK`, `FRAMING_SHOWN`, `STUDENT_ATTESTATION`, `OPEN_BOX_CONFIRMED`, `PROHIBITED_ITEMS_ATTESTED`, `ROUTE_VALIDATED`, `INSURANCE_BOUND`, `TAX_DISCLOSURE_SHOWN`, `TIER_TRANSITION`. Build audience-specific exports (HMRC / Home Office / insurer) as first-class reports from day one; retain ≥6 years. This turns "we believe we're compliant" into "here is the proof" — and is itself a fundable differentiator vs. gig couriers.

---

## Matching engine & bidding

A two-sided matching engine with **cap-bounded bidding**. The key design rule: **price discovery is allowed, but the auction can never breach the Cost-Sharing Invariant** — every bid is validated against the traveler's remaining trip cap before it can exist. This gives a real marketplace with competitive pricing that is *mathematically prevented* from turning a traveler's trip into profit.

### Matching (candidate generation + ranking)
Implemented as a SQL query + scoring in the Cloud Run API (no ML for MVP):
- **Hard filters (must pass):** same `corridor_id` + `direction`; date/time window overlap (parcel pickup/dropoff windows vs trip `depart_at`); **trip remaining cap ≥ contribution**; luggage fit (dimensions ≤ limits, trip piece-count headroom); domestic GB both ends; not self; both parties KYC-verified.
- **Proximity score (uses the real lat/lng):** Haversine distance of pickup & dropoff from the traveler's route/stations — closer detour ranks higher.
- **Ranking surfaces:** for a **traveler** browsing parcels → rank by contribution value, proximity, time fit. For a **sender** reviewing bids → rank by price, traveler `trust_score`/rating, reliability, ETA.

### Bidding model (recommended: reverse auction, travelers compete)
Default mechanic drives prices **down** toward marginal cost — which both benefits senders *and* strengthens the cost-sharing posture (lower contributions look unambiguously like expense reimbursement, never profit):
1. Sender posts a parcel with `pricing_mode`:
   - **`fixed`** — sender sets a contribution (≤ a platform-suggested fair value). Travelers **instant-claim** at that price; first cap-valid claim wins. Best for cold-start / low liquidity.
   - **`auction`** — sender sets `max_contribution`. Travelers **bid** (propose their contribution ≤ sender max); sender picks a winner on price + trust. Best once there's traveler supply.
2. **Every bid passes the cap check at creation:** `trip.committed + bid_contribution ≤ trip.journey_cost`. A bid that would breach the cap is rejected outright with the cost-sharing copy — the auction ceiling is the journey cost, not "whatever the market will bear."
3. **On accept:** atomically (row-locked on `trip_capacity_ledger`) commit the contribution, create the `booking`, write `CAP_CHECK` to the audit log, and expire competing bids on that parcel.
4. Bids have `expires_at`; pending bids are re-validated at accept time (cap may have been consumed by another booking on the same trip).

**Deliberately NOT in MVP:** ascending auctions where *senders* bid up scarce trip space. Pushing prices *toward* the cap optimizes for traveler profit and weakens the expense-reimbursement story — exactly the optics to avoid. Keep the auction price-suppressing, not price-inflating.

### Price suggestion (cold-start helper)
Before bidding liquidity exists, the platform suggests a fair contribution from a simple **size-band × distance-band table**, always clamped ≤ the relevant cap. This anchors senders and avoids empty-marketplace paralysis.

## User flows (MVP screens)

**Sender:** phone-OTP auth → KYC → Post Parcel (corridor+direction enum; **pickup & dropoff postcode → map pin → confirm address**; size/weight/dimensions, photos, declared value ≤ cap, prohibited-items gate; choose **`fixed` price or `auction`**, with platform-suggested fair contribution) → **review incoming bids/claims** (ranked by price + traveler trust) → **accept a bid** → **fund escrow** (itemized: contribution + £1.50 + insurance) → show pickup QR/OTP → live track (Firestore status mirror + FCM push, pins on map) → rate → optional dispute.

**Traveler:** phone-OTP auth → KYC + Stripe Connect onboarding → Post Trip (corridor, date, mode, journey-cost capture) → browse matched parcels on corridor (**map view with real pins**) → **instant-claim (fixed) or place a cap-bounded bid (auction)** → on accept: at pickup **open-box inspection** → scan pickup QR/OTP → carry → at destination: scan dropoff QR/OTP → escrow auto-releases → see contribution received → rate.

Runs on **iOS, Android, and web** from one Expo codebase. ~17 screens incl. a **founder admin/ops console** (Retool/web) for disputes, payout overrides, reconciliation.

---

## Phased build sequence (~10–11 wks solo)

- **Phase 0 — Foundations (1.5–2w):** Expo (iOS+Android+web) scaffold, GCP project (Cloud Run + Cloud SQL + GCS + Secret Manager + Cloud Build), Firebase project (Auth + Firestore + FCM), pbuddy.co.uk DNS + Firebase Hosting, phone-OTP auth + ID-token verification middleware, schema + constraints, seed corridor allowlist, **postcodes.io + MapLibre address/map component**, T&Cs/prohibited-items gate, **legal_copy config + banned-word lint**, **compliance_audit_log wired from day one**.
- **Phase 1 — Marketplace core + matching/bidding (3–4w):** Post Parcel (real postcodes + map pins) / Post Trip, **matching engine** (filter + proximity/trust ranking), **cap-bounded bidding** (fixed-claim + reverse auction), **cap ledger + accept-time enforcement**, price-suggestion table, frequency throttle, booking lifecycle, Firestore status mirror + FCM. Validate liquidity + price discovery with test data, no money yet.
- **Phase 2 — Money + identity (3w, riskiest, buffer it):** Stripe Identity KYC, Connect Express, manual-capture funding → capture-on-pickup → transfer-on-dropoff → refunds, all via webhook-driven Cloud Run endpoints.
- **Phase 3 — Handoff + trust (2w):** QR tokens + scanner, OTP fallback, open-box gate, handoff_events audit, ratings → trust_score, value caps.
- **Phase 4 — Safety net + ops (1.5w):** insurance (stub→Anansi), disputes, Retool admin console, reconciliation + compliance exports.

**Tier sequencing:** **Casual Buddy ships in the pilot** (the safe-harbour model is the whole point of proving). The `pro_buddy` tier is **scaffolded in the data model + gates from day one**, but its full *enablement* (Right-to-Work verification + Zego hire&reward integration + self-employed onboarding) is a **fast-follow** after the Casual pilot proves liquidity and a solicitor signs off the hire&reward/employment-status questions — exactly the items that "no limits" triggers.

**Deferred from pilot:** Pro Buddy enablement (RTW + hire&reward integrations), custody nodes/lockers, turn-by-turn routing, in-app chat (use masked SMS), wallet, multi-corridor self-serve, car mode, free-text routes. (Web app is **included** via Expo web; basic maps/pins are **included**.)

---

## GTM sequencing

- **One corridor first, rail-only, student-anchored.** Don't spread thin; clone the playbook to corridors 2–3 only after the first hits liquidity.
- **Corridor selection:** student density both ends, high existing rail volume, diaspora/family ties, 1–3h distance (cap leaves meaningful capacity), concentrated nodes (campuses/stations) for cheap seeding. **Suggested first: London–Manchester** (or London–Birmingham), then 2 more student-heavy pairs.
- **Seed supply first** (the constraint): recruit regular travelers at stations + uni groups — hook is the compliance model itself ("cover your train fare, legally — not a job, safe on a student visa").
- **Demand, concentrated, in order:** students → diaspora families → SMEs/Vinted-eBay sellers.
- **Playbook:** pre-launch (build firewall + seed roster + waitlist) → **concierge liquidity** (manual matching, courier backstop so demand never dead-ends) → self-serve once organic match rate is healthy → clone.
- **Metrics for the next raise:** time-to-match / % parcels matched in X hrs / % trips carrying ≥1 parcel; repeat traveler & sender rate; **contribution margin per parcel**, CAC-by-channel vs. LTV, CAC payback; each new corridor reaching liquidity *faster* (repeatable flywheel); **zero compliance breaches** (caps + open-box + framing logged).

---

## Legal sign-off required before scaling

This plan encodes founder+AI analysis — **not legal advice**. Before scaling, a UK solicitor + relevant insurers/regulators must bless, in priority order:
1. **Per-trip cap = legal firewall** (the whole model; transport/insurance solicitor + a real insurer, esp. for cars).
2. **International students** (immigration solicitor; whether *any* contribution is safe, and whether self-declared status is defensible).
3. Self-declared journey cost / immigration status fraud exposure.
4. Payment framing vs. worker-status risk (post-*Uber v Aslam*).
5. PBuddy taking commission while users "only share costs."
6. Embedded insurance → likely **FCA** appointed-representative / IDD obligations.
7. Open-box as a real liability discharge for prohibited goods.
8. Escrow/holding funds → use a **regulated PSP/EMI** (Stripe); confirm AML duties.

---

## First files to create (greenfield, future repo root)

Monorepo: `app/` (Expo, iOS+Android+web) + `api/` (Cloud Run Node/TS) + `db/` (migrations) + `infra/` (GCP/Cloud Build).

- `db/migrations/0001_init.sql` — entities, enums, constraints, `trip_capacity_ledger`, `compliance_audit_log`, `routes` allowlist, `legal_copy`, address/postcode columns.
- `api/src/middleware/auth.ts` — verify **Firebase ID token**, scope requests by `user_id`.
- `api/src/services/matching.ts` — candidate generation (filters) + proximity/trust ranking.
- `api/src/routes/bids.ts` — place/accept bid: cap-validate at creation, atomic accept → booking + ledger commit + audit (**the firewall**).
- `api/src/routes/stripe-webhook.ts` — escrow state machine (capture/transfer/refund) + Firestore status mirror write.
- `api/src/lib/stripe.ts` — Connect onboarding, manual-capture PaymentIntent, transfers (server-side only).
- `app/src/components/AddressPicker.tsx` — postcodes.io lookup + MapLibre pin (web + native).
- `app/src/app/parcel/post.tsx` — post parcel + address + prohibited-items + value-cap gate.
- `app/src/app/booking/[id].tsx` — booking hub: funding, QR show/scan, open-box, live status.
- `infra/cloudbuild.yaml` — build/deploy Cloud Run + Firebase Hosting (pbuddy.co.uk).

---

## Verification

- **Cap firewall + bidding:** unit + integration tests proving (a) a bid above `journey_cost` is rejected at creation, (b) `sum(accepted contributions) ≤ journey_cost` holds atomically under concurrent accepts on the same trip, (c) competing bids expire when one is accepted, and (d) a `CAP_CHECK` row is written for every attempt (accept and reject).
- **Matching:** given seeded trips/parcels, the engine returns only cap-valid, in-corridor, dimension-fitting candidates, ranked sensibly by price + proximity + trust.
- **Money loop end-to-end** in Stripe test mode: authorize → capture-on-pickup-scan → transfer-on-dropoff-scan → refund-on-dispute; reconcile ledger vs. Stripe dashboard.
- **Open-box gate:** assert a booking cannot reach `picked_up` without an `open_box_confirmed` event (DB-level).
- **Framing integrity:** banned-word lint passes in CI; receipts/exports contain no "fee/earnings/income."
- **Tiers:** a `student_visa` user cannot become Pro Buddy; a Pro Buddy upgrade is blocked until `rtw_status = verified` (+ hire&reward for car); Casual Buddy stays capped/throttled while Pro Buddy bypasses caps; every `TIER_TRANSITION` is audited.
- **Addresses/maps:** an invalid or non-GB postcode is rejected; a valid one resolves to the correct pin; pickup/dropoff pins render on iOS, Android, **and web**.
- **Cross-platform:** the web build serves at pbuddy.co.uk and the core sender flow works in-browser; mobile builds run on a device.
- **Manual pilot run:** founder posts a real parcel, a seed traveler completes a real London–Manchester handoff with real (small) money, and the HMRC/insurer compliance export renders correctly.
