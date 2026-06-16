# PBuddy GTM Pilot Playbook (E9)

Goal: prove **liquidity** and **unit economics** on ONE corridor before cloning.
Seed supply first, manufacture concentrated demand, instrument everything, and
never let early demand hit a dead end.

Track the numbers via `GET /metrics/pilot` (admin) — see PBD-58 below.

---

## PBD-56 — Corridor seeding (London ⇄ Manchester)

Pick one corridor with a natural, repeating flow of travellers (students between
two campuses is ideal: predictable termly journeys, trust within a community).

**Supply (travellers) — do this first; an empty marketplace kills demand.**
- Recruit a roster of ~20–30 regular travellers on the two campuses (society
  stalls, WhatsApp/Discord groups, noticeboards, a £X sign-up credit framed as
  account credit — never "earnings").
- Get each onto the app, KYC-verified, and posting their real upcoming trips.
- Target: ≥10 live trips on the corridor in any given week.

**Demand (senders) — concentrated, not diffuse.**
- Capture a sender waitlist (same campuses + local "send to uni" parents groups).
- Convert the waitlist with a launch window so demand lands while supply is live.
- Target: first 50 parcels posted within the launch fortnight.

**Definition of done:** corridor has both sides seeded; `by_corridor` in the
metrics shows London↔Manchester with parcels AND a non-trivial match rate.

---

## PBD-57 — Concierge liquidity + courier backstop

Early on, match by hand so no one experiences an empty marketplace.

**Concierge matching SOP**
1. New parcel posted → ops sees it (metrics `parcels_open` / admin console).
2. Within the SLA (e.g. 2h during launch hours), find a roster traveller on that
   corridor + window and nudge both sides to bid/accept in-app.
3. Log the touch so we can later measure organic vs. concierge match rate.

**Courier backstop (no dead ends)**
- If no traveller is found within the SLA, fulfil the parcel via a backup courier
  so the sender still gets delivery. Record it as a backstop (not a P2P match).
- Backstop rate is a *demand-validation* signal, not a failure: it proves demand
  exists ahead of supply. Drive it down as the roster grows.

**Definition of done:** documented SOP in use; zero senders left unmatched AND
unfulfilled during the pilot.

---

## PBD-58 — Pilot metrics dashboard  ✅ (shipped)

`GET /metrics/pilot` (admin-only) returns, straight from Postgres:

- **liquidity**: `parcels_total`, `parcels_matched`, `parcels_open`,
  `match_rate`, `avg_time_to_match_seconds`, `trips_total`, `bids_total`
- **unit_economics** (released bookings): `released_count`, `gross_pennies`,
  `platform_revenue_pennies` (fees + insurance margin), `travellers_paid_pennies`,
  `avg_gross_pennies`
- **compliance**: `audit_events`, `cap_checks`, `consents`, `breaches` (0 by
  construction — the cost-sharing cap is a DB invariant)
- **by_corridor**: parcels + matched per corridor

**Targets to graduate the pilot (tune with real data):**
| metric | pilot target |
|---|---|
| match_rate | ≥ 0.6 |
| avg_time_to_match | ≤ 6 h |
| contribution / platform_revenue per parcel | positive after backstop cost |
| compliance.breaches | 0 (always) |

CAC vs LTV is tracked alongside spend in the growth sheet (CAC isn't in the DB);
the endpoint provides the LTV-side inputs (revenue per released booking).
