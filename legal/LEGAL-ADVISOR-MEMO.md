# Legal advisor memo — PBuddy operating model

**To:** PBuddy founders
**Re:** Binding legal review of the operating model, and the legal pack drafted to match it
**Date:** 2026-06-19
**Status:** In-house "best-possible" advice. **Not** a substitute for sign-off by a
practising, SRA-regulated solicitor in UK employment + immigration + consumer law.
Read the *Limits of this advice* section last — it is load-bearing.

---

## 1. What PBuddy is, in law

PBuddy is a **neutral online marketplace** that introduces a person who wants a
parcel taken along a journey (the **Sender**) to a person who is **already making
that journey** by public transport, on foot, or by bike (the **Buddy**). The
contract for carrying the parcel is **between the Sender and the Buddy**. PBuddy
is the **intermediary**: it provides the platform, holds the contribution in
escrow via an authorised payments partner, and takes its own platform fee.

This characterisation matters because it keeps PBuddy out of three regulated
boxes:

1. **Not a transport operator / courier.** No motor vehicles are used for hire
   and reward, so there is no PSV operator licence, goods-vehicle operator
   licence, or taxi/PHV licensing question. Domestic UK only.
2. **Not a payment institution.** PBuddy never holds client money in its own
   right; funds are held and moved by the authorised Stripe Connect platform, so
   PBuddy relies on Stripe's authorisation rather than needing its own under the
   Payment Services Regulations 2017.
3. **Not the Buddy's employer.** See §3.

Everything in the product and the legal pack is engineered to keep these three
true. The marketing lint (`api/scripts/banned-words.mjs`) exists precisely so we
never *describe* ourselves into a box we have engineered our way out of.

## 2. The cost-sharing invariant (the core defence)

A Buddy's cumulative accepted contributions on a journey **can never exceed their
own verified cost for that journey**. This is not a policy line — it is a
database `CHECK` constraint on `trip_capacity_ledger` and the auction ceiling is
built on it (`api/src/services/caps.ts`). A genuine cost-share (sharing fuel/a
ticket/time set aside, as with car-share) is not a taxable trade in the ordinary
sense and is not the supply of a transport service for reward. The fact that the
ceiling is **structural, not advisory**, is the single strongest fact in our
favour and should be foregrounded in any regulator conversation.

## 3. Worker / employment status — why a Buddy is not a worker

The risk (post *Uber BV v Aslam* [2021] UKSC 5) is that a platform "worker"
relationship is found despite the contract's labels. The court looks at the
**reality**, not the wording (*Autoclenz v Belcher* [2011] UKSC 41). We win on
the reality because of features built into the product, not asserted on paper:

- **No obligation to accept work** (no mutuality of obligation). A Buddy bids
  only when they choose; PBuddy never allocates or pushes jobs.
- **The Buddy sets the price** by bidding — PBuddy does not impose a tariff.
  This is the inverse of Uber, where the price was set by the platform.
- **An unfettered right to refuse** before pickup (`POST /bookings/:id/decline`)
  with no penalty, rating consequence engineered against them, or "deactivation".
- **A genuine right of substitution** (`POST /bookings/:id/substitute`) — a
  Buddy may appoint another verified Buddy to fulfil a booking. Personal service
  is the irreducible minimum of worker status (*Pimlico Plumbers v Smith* [2018]
  UKSC 29); a real substitution right defeats it. Ours is *conditional only* on
  the substitute being equally right-to-work-verified and KYC-checked — a
  condition the Supreme Court in *Pimlico* indicated is compatible with a valid
  substitution clause, because it is a genuine integrity condition, not a sham.
- **No control / no integration.** PBuddy does not direct route, timing, kit,
  conduct, or appearance. The Buddy is already making the journey for their own
  reasons.
- **Frequency throttle** keeps Casual Buddies in "incidental traveller"
  territory — the design favours *supplementary* activity, not a full-time job.

**Action for the solicitor:** pressure-test the substitution clause against the
latest worker-status authority and confirm it is not a sham on our facts. This is
flagged as PBD-139 / E21-S5. The *mechanic* now exists in code; the *legal
opinion that it bites on our facts* must come from counsel.

## 4. Right to Work and international students

The 2026 platform regime is courier-targeted and pushes liability onto platforms
for illegal working. We have therefore taken the **conservative** position:

- **Every** Buddy who carries must have a **verified Right to Work**
  (`requireCarrierEligible`), not just high-frequency carriers. This is stricter
  than strictly required for a true self-employed contractor, but it is cheap
  insurance against the illegal-working civil penalty regime
  (Immigration, Asylum and Nationality Act 2006) and the direction of travel of
  platform liability.
- **International students cannot carry at all.** A Student visa prohibits
  self-employment and "engaging in business activity". Rather than police
  hour-limits we exclude the activity entirely for that immigration class. This
  protects the student from a visa breach and PBuddy from facilitating one.

## 5. Liability — the two-layer model

PBuddy provides a **digital platform service to consumers**, so the Consumer
Rights Act 2015 applies to *that service* (reasonable care and skill, s49) and
**cannot be excluded** (s57; Unfair Contract Terms regime; CRA Part 2 fairness).
The carriage itself is a **Sender↔Buddy** contract. We therefore split liability
into two honest layers:

- **Layer 1 — the statutory floor we cannot and do not exclude.** PBuddy is
  liable for failing to provide the *platform* with reasonable care and skill,
  for our own negligence, and for anything the law forbids us to exclude (death
  or personal injury from negligence; fraud). We do not pretend otherwise.
- **Layer 2 — a voluntary goodwill resolution layer** for parcel loss or damage,
  which is fundamentally a matter between Sender and Buddy and/or the optional
  insurer. PBuddy is not the carrier and does not underwrite the goods, but it
  offers a defined, capped goodwill process to keep the community fair.

This is honest, CRA-safe, and avoids the unenforceable "we exclude everything"
clause that consumer regulators strike down.

**Action for the solicitor:** the precise wording of the Layer-1 floor and the
Layer-2 cap is the one piece of text that must be **drafted/approved by counsel**
(PBD-140). [liability-policy.md](liability-policy.md) is a faithful, structured
draft of the intended split for them to finalise — not the final word.

## 6. Insurance — optional, never "fully insured"

Arranging insurance is a regulated activity (FSMA 2000). PBuddy must **not** hold
itself out as an insurer or imply blanket cover. Therefore:

- Parcel cover is an **optional** Sender bolt-on, arranged through an authorised
  insurer/intermediary, with its own terms, excess, and exclusions.
- We never say "fully insured", "guaranteed", or equivalent — the marketing lint
  blocks these strings in CI.

**Action for the solicitor / before launch:** confirm the distribution
arrangement with the chosen insurer makes PBuddy an Introducer Appointed
Representative or otherwise compliant, before the optional-cover toggle is
enabled in production.

## 7. Green claims

Any environmental claim ("lower-carbon than a dedicated van trip", etc.) must
satisfy the **CMA Green Claims Code** and survive **DMCCA 2024** greenwashing
enforcement and ASA/CAP rules. [green-claims-methodology.md](green-claims-methodology.md)
sets the substantiation standard: comparison must be like-for-like against a
named baseline, lifecycle-honest, evidence-backed, and never absolute
("zero-carbon") without proof. **No green claim ships until its row in the
methodology's evidence table is filled.**

## 8. Money, tax, data — briefly

- **Tax:** contributions may be reportable by the Buddy; the £1,000 Trading
  Allowance is per-person and may be used elsewhere. PBuddy gives **no** tax
  advice and says so. (We may have OECD/UK digital-platform reporting duties —
  confirm with an accountant.)
- **Data:** UK GDPR / DPA 2018 notice in [privacy-policy.md](privacy-policy.md).
  Compliance records are kept in an immutable, hash-chained audit log.
- **Payments:** Stripe Connect (manual capture escrow); PBuddy never touches card
  data.

## 9. Residual risk register

| # | Risk | Likelihood | Severity | Mitigation in place | Owner of residual sign-off |
|---|---|---|---|---|---|
| R1 | Worker-status finding against a Buddy | Low–Med | High | No mutuality, Buddy-set price, refuse + substitution rights, no control | **Solicitor (PBD-139)** |
| R2 | Illegal-working penalty | Low | High | RTW for all carriers; students excluded | Solicitor confirm sufficiency |
| R3 | "Courier/operator" recharacterisation | Low | High | No motor hire-and-reward; cost-share cap; marketing lint | Solicitor + don't deviate |
| R4 | CRA-unfair liability clause struck down | Med | Med | Two-layer model; no blanket exclusion | **Solicitor wording (PBD-140)** |
| R5 | Insurance mis-selling / FSMA breach | Med | High | Optional only; no "fully insured"; via authorised insurer | **Insurer + FCA status pre-launch** |
| R6 | Greenwashing enforcement | Med | Med | Methodology gate; evidence table required | Fill evidence before any claim |
| R7 | Platform tax-reporting duty missed | Med | Med | Flagged | Accountant |

## 10. Limits of this advice (read this)

I am acting as your in-house drafter to get you **launch-ready and review-cheap**,
not as your retained solicitor. This memo and the pack are a strong, internally
consistent, UK-law-aware foundation — but **the binding sign-off on the exact
mechanics has to come from someone regulated who can see your full facts**,
specifically:

- a UK **employment** solicitor on §3 (substitution clause) and the carrier
  agreement;
- a UK **immigration** solicitor on §4 (RTW + student exclusion);
- a **consumer/commercial** solicitor on §5 (the two-layer liability wording);
- an **FCA-authorised insurer/intermediary** on §6 before the cover toggle goes
  live.

Treat everything here as the brief that makes their review fast — not as the
review itself.
