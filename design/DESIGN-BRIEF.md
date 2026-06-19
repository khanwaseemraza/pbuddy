# pBuddy — Design Agent Brief (authoritative)

Use THIS document as the source of truth. Where any Jira ticket disagrees with
it, this wins. Several historical tickets describe an earlier model and were
explicitly marked superseded — do not design against them.

## 1. What pBuddy is (and is not)

pBuddy is a **cost-sharing marketplace**: it introduces a person sending a parcel
(the **Sender**) to a verified person **already making the same journey** (the
**Buddy**). The Sender pays a **contribution** toward the Buddy's journey cost.

It is **NOT** a courier, delivery company, logistics company, transport operator,
or the Buddy's employer. A contribution is a share of a journey that was happening
anyway — never a delivery fee, wage, or payment for a service.

## 2. Which tickets to follow

- **Follow:** E20 (consumer flow UX), E20-S10 (brand & design-system rules —
  canonical), E21 (legal-aligned model v2), E21-S10 (greener scope).
- **Superseded — do NOT design against:** E2-S8 / E5 / E5-S3 (open-box
  inspection — REMOVED), E2-S5 (Pro-only RTW + student-only-Pro lock), E8 / E8-S2
  (Pro-only RTW, car hire&reward), E9-S2 wording (no "courier backstop").

## 3. Brand & visual rules (HARD)

- **No emojis. Anywhere.** Use **FontAwesome** icons for all iconography. (The
  current design's 🛡️🔒📋📜 must become FontAwesome icons; typographic marks like
  check / star / dot are fine but prefer FontAwesome.)
- **No gradients** on buttons or fills. **Solid colours only.** Primary button =
  solid coral **#FF5A5F**, white text. (The current design's coral→orange
  gradients everywhere are wrong.)
- **Airbnb palette + Apple glassmorphism:** light, warm background; translucent
  white cards (≈`rgba(255,255,255,0.7)`) with a soft shadow, subtle blur, a 1px
  light border, and a generous corner radius. Coral is the single accent.
- **Clean sans typography**, no decorative display fonts.
- Premium, restrained, lots of whitespace. No playful clip-art.

## 4. Copy — say / never-say (enforced by CI lint)

- **Say:** cost-sharing, contribution, share the journey cost, Buddy, Sender,
  escrow, Right-to-Work verified, sealed parcel, right to refuse, optional cover,
  cost-sharing cap.
- **Never say:** courier, logistics, delivery fee, "we deliver", "deliver by
  train/bus", our couriers/drivers, delivery fleet, become a driver/courier,
  earn / earnings / wage / salary / income, "fully insured", "guaranteed".
  (Negations are allowed and encouraged, e.g. "not a logistics company".)

## 5. Compliance facts that MUST be portrayed correctly

- **RTW for ALL buddies** — every Buddy is Right-to-Work verified before carrying,
  not just a premium tier.
- **Students:** welcome as **Senders**, but **cannot carry on any tier** (a
  Student visa prohibits it). Do **not** say students can be buddies. (The current
  FAQ #4 is wrong and must be fixed.)
- **Sealed-package model:** the parcel stays **sealed**; the Sender declares the
  contents; the Buddy's safeguard is the **right to refuse** before pickup. There
  is **no open-box / inspection step** — never show one.
- **Right of substitution:** a Buddy may appoint another verified Buddy before
  pickup.
- **Insurance is OPTIONAL** (a Sender bolt-on). Never "fully insured".
- **Cost-sharing cap** is enforced in the database on every trip — contributions
  can never exceed the Buddy's own journey cost. Lead with this; it's the core
  trust story.

## 6. Scope (greener)

- **Domestic UK only.**
- **Public transport (train / bus / coach), bicycle, or on foot only.**
  **No motor vehicles / cars** for now. Lean into the greener, low-carbon,
  active/shared-travel angle.
- Any environmental claim must be **comparative + substantiated** (CMA Green
  Claims Code) — never an unqualified absolute like "zero-carbon".

## 7. What to fix in the current "pBuddy Landing" design

1. Remove every gradient → solid coral buttons/badges/accents.
2. Replace all emoji icons with FontAwesome icons.
3. Fix FAQ "Can students take part?" → students can **send**, but **cannot carry
   at all** (not just excluded from Pro).
4. Add the greener / public-transport-bike-foot emphasis (it currently reads
   mode-agnostic).
5. Keep: glassmorphism, the cost-sharing-cap meter, Right-to-Work + escrow +
   sealed/right-to-refuse + substitution + prohibited-items-screened messaging,
   "not a logistics company" positioning.
6. Keep it framing-clean (section 4) and emoji-free (section 3).
