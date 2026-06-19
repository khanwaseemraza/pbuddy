# Handoff: pBuddy Marketing Landing Page

## Overview
A single, public marketing landing page for **pBuddy**, a UK cost-sharing marketplace that introduces a **Sender** (someone sending a parcel) to a verified **Buddy** who is *already* making the same journey by public transport, bicycle, or on foot. The Sender pays a **contribution** toward the Buddy's journey cost, capped so it can never exceed it. The page's job is to explain the model, establish trust/compliance, and drive two CTAs: *Send a parcel* and *Become a buddy*.

This design is the corrected v2 that conforms to `design/DESIGN-BRIEF.md` in the repo (the authoritative source). It supersedes the older `design/extracted/` version, which used emoji and gradients and had an incorrect students FAQ.

## About the Design Files
The files in this bundle are a **design reference created in HTML** — a prototype showing the intended look, copy, and behavior. **It is not production code to paste in.** The task is to **recreate this design in the target codebase's environment** (e.g. React/Next.js, Vue, etc.) using its established patterns, component library, and tokens. If no front-end environment exists yet, choose the most appropriate framework and implement it there.

> The HTML is authored as a "Design Component" (`.dc.html`) and depends on a runtime (`support.js`). Treat it as a visual + copy spec; do **not** port the `.dc.html`/`support.js` runtime into production. Everything you need to rebuild it is described below.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, copy, and interactions. Recreate the UI faithfully using the codebase's existing libraries and patterns; exact values are given in **Design Tokens** below.

---

## Brand & Compliance Rules (HARD — do not violate)
These come straight from the brief and are enforced by CI lint; a build that breaks them is wrong.

1. **No emojis anywhere.** All iconography is **FontAwesome** (Free, solid style). 
2. **No gradients** on buttons or fills. **Solid colors only.** Primary = solid coral **`#FF5A5F`** with white text.
3. **Airbnb palette + Apple glassmorphism:** light warm background; translucent white cards `rgba(255,255,255,0.7)` with soft shadow, subtle backdrop blur, 1px light border, generous radius. Coral is the *single* accent.
4. **Clean sans typography** (Plus Jakarta Sans), no decorative display fonts. Premium, restrained, generous whitespace.
5. **Copy lint — say / never-say:**
   - **Say:** cost-sharing, contribution, share the journey cost, Buddy, Sender, escrow, Right-to-Work verified, sealed parcel, right to refuse, optional cover, cost-sharing cap.
   - **Never say:** courier, logistics, delivery fee, "we deliver", "deliver by train/bus", couriers/drivers, delivery fleet, become a driver/courier, earn/earnings/wage/salary/income, "fully insured", "guaranteed". (Negations like "not a logistics company" are encouraged.)

### Compliance facts that MUST be portrayed correctly
- **RTW for ALL buddies** — every Buddy is Right-to-Work verified before carrying (not a premium tier). A **substitute** Buddy is re-verified before taking over.
- **Students:** welcome as **Senders**, but **cannot carry on any tier**. Never imply students can be buddies.
- **Sealed-package model:** parcel stays **sealed**; Sender **declares** contents; the Buddy's safeguard is the **right to refuse** before pickup. There is **no open-box / inspection step** — never show one.
- **Right of substitution:** a Buddy may appoint another verified Buddy before pickup.
- **Optional cover:** insurance is an optional Sender bolt-on at checkout. Never "fully insured".
- **Cost-sharing cap is enforced in the database** on every trip — contributions can never exceed the Buddy's own journey cost. This is the core trust story — lead with it.
- **Greener scope:** Domestic UK only; **public transport (train/bus/coach), bicycle, or on foot only — no motor vehicles/cars.** Any environmental claim must be **comparative + substantiated** (CMA Green Claims Code), never an absolute like "zero-carbon".

---

## Page Structure (single scrolling page, max content width 1180px, centered)
Top→bottom sections:

1. **Sticky glass nav**
2. **Hero** (2-col: copy left, floating glass cost-sharing-cap card right)
3. **Trust stat strip** (4 columns)
4. **How it works** (3 steps)
5. **Cost-sharing cap explainer** (2-col card: copy + cap meter)
6. **Trust & safety** (6 cards, 3-col grid)
7. **Greener band** (single horizontal card)
8. **Corridors** (2-col: copy + 3 route rows)
9. **Two-audience CTA** (2 cards: Sender coral / Buddy glass)
10. **FAQ** (5 accordions, max width 820px)
11. **Footer** (3-col + legal baseline)

Page background: warm `#fbf3ee` with three large soft blurred solid blobs (`#ffe1d6`, `#ffd9dc`, `#ffe9d2`, `blur(60px)`, opacity ~0.7) fixed behind content for ambient warmth — **not** gradients on any interactive element.

---

## Sections (detailed)

### 1. Sticky nav
- Pill-shaped glass bar, full max-width, `position: sticky; top: 0`. Padding `12px 14px 12px 22px`, `border-radius: 999px`.
- Glass: `background: rgba(255,255,255,0.7)`, `backdrop-filter: blur(20px) saturate(160%)`, `border: 1px solid rgba(255,255,255,0.85)`, `box-shadow: 0 8px 30px rgba(150,60,50,0.1)`.
- Left: logo — coral circle (30×30, `#FF5A5F`, white "p", weight 800) + wordmark "pBuddy" (20px/800/-0.02em).
- Center: links (14.5px/500, `#4a4a4a`): *How it works · Cost-sharing · Trust & safety · Corridors* (anchor scroll to `#how`, `#model`, `#trust`, `#corridors`).
- Right: solid coral pill button "Get started" (14.5px/700, white, `padding: 11px 20px`, `border-radius: 999px`).

### 2. Hero
- 2-col grid `1.05fr 0.95fr`, gap 48px, padding `64px 24px 40px`.
- **Left column:**
  - Eyebrow pill (glass): coral dot + text **"A cost-sharing community, not a logistics company"** (13px/600, color `#c23b46`).
  - H1 (60px/800/-0.035em, `#1d1d1f`, `text-wrap: balance`): **"Send it with someone already going your way."**
  - Sub (19px/400/1.55, `#5b5b5f`, max 520px): "pBuddy connects a Sender with a verified Buddy already making the journey — by train, bus, bike or on foot. You simply **share the journey cost**, capped so it never exceeds what the trip actually costs."
  - Two CTAs (gap 12px):
    - Primary: solid coral, white, icon `fa-box` + "Send a parcel". `padding: 16px 28px`, `border-radius: 18px`, 16px/700.
    - Secondary: glass, `#1d1d1f` text, icon `fa-route` + "Become a buddy".
  - Trust line (13.5px/600, `#6b6b70`): `fa-circle-check` (coral) "Right-to-Work verified buddies" · `fa-lock` (coral) "Contributions held in escrow".
- **Right column — floating glass cards:**
  - Small floating badge card (top-right, `animation: float 9s`): label "Sealed parcel · right to refuse" + green check chip (`fa-shield-halved`, `#1f9d57` on `#e8f7ee`) "Declared & accepted".
  - Main card (322px, radius 30px, glass, `box-shadow: 0 30px 70px rgba(150,60,50,0.2)`, `animation: float 8s`):
    - Header row: "Corridor" / coral "● live".
    - Route: "London → Manchester" (21px/800) with coral `fa-arrow-right-long`.
    - Mode/time row: `fa-train` "Train" · "Saturday · departs 10:24".
    - Buddy row (inner translucent card): avatar circle (`#ffd9c2` bg, `fa-user` `#c8603a`), "Aisha K." + green `fa-circle-check` "Right-to-Work verified", right: "4.96" + `fa-star` (`#f5a623`) "38 trips".
    - Contribution meter: label "Your contribution" / "Journey cost £38"; track `rgba(0,0,0,0.07)` height 12px radius 999px; **solid coral** fill 68% with `fill` keyframe (width 0→68%, 1.6s `cubic-bezier(.2,.8,.2,1)`). Below: "£26" (24px/800) + green `fa-circle-check` "within cost-sharing cap".
    - Solid coral button "Share the journey".

### 3. Trust stat strip
- Glass card, 4-col grid, gap 14px, padding 22px, radius 18px.
- Each item: coral FA icon (18px) + stat (20px/800) + label (13px/500, `#6b6b70`):
  1. `fa-id-card` — "All buddies" / "Right-to-Work verified before they can carry"
  2. `fa-lock` — "Escrow" / "contributions held safely until handover"
  3. `fa-gauge` — "Capped" / "contributions never exceed the journey cost"
  4. `fa-leaf` — "Greener" / "rides along journeys already happening"

### 4. How it works
- Centered header: eyebrow "How it works"; H2 (42px/800/-0.03em) "Three steps. No depots, no detours."; sub "Buddies don't make special trips — they carry along a journey they're already taking by public transport, bike or on foot."
- 3-col grid of glass cards, gap 22px. Each: coral rounded-square icon tile (48×48, radius 14, white icon 19px) + "Step N" label; H3 (21px/700) + body (15.5px/1.55).
  1. `fa-box` **Post your sealed parcel** — "Seal your parcel and declare what's inside. We check it against the prohibited-items list — the Buddy keeps a full right to refuse."
  2. `fa-route` **Match on a corridor** — "We connect you with a verified Buddy already travelling your route by train, bus, bike or on foot — no special trips, no detours."
  3. `fa-handshake` **Share the journey cost** — "Your contribution goes into escrow and releases on handover. It's a share of the trip, capped at what it actually cost."

### 5. Cost-sharing cap explainer (`#model`)
- One large glass card, 2-col grid gap 48px, padding 44px, radius 28px.
- **Left:** eyebrow "The cost-sharing cap"; H2 (38px/800) **"The cap is enforced in our database — not just our terms."**; body: "Every contribution is checked against the cap inside the same transaction that records it. A Buddy shares costs and never turns a profit — that's what keeps pBuddy a genuine cost-sharing community rather than a transport business." Then a 3-item checklist (green `fa-check` chips):
  - "Each trip has a cap equal to the Buddy's own journey cost."
  - "Contributions are checked against that cap in the same database transaction that records them."
  - "Any contribution that would tip past the cap is rejected automatically."
- **Right — cap meter panel** (`rgba(255,255,255,0.6)`, radius 22):
  - `fa-train` "Trip: London → Manchester".
  - Bar 1: "Buddy's journey cost" / "£38.00" — empty neutral track (the 100% reference).
  - Bar 2: "Total contributions" / coral "£26.00" — solid coral fill at 68%.
  - Callout (white, 1px dashed coral border): coral `fa-ban` chip + "Any contribution that would pass £38 is rejected automatically at the database."

### 6. Trust & safety (`#trust`)
- Centered header: eyebrow "Trust & safety"; H2 "Compliance built in, not bolted on."; sub "Every safeguard runs on every trip — verified people, sealed and declared parcels, protected contributions."
- 3-col grid, 6 glass cards. Each: FA icon tile (50×50, radius 14, `#fff0ec` bg, coral icon 21px) + H3 (18.5px/700) + body (15px/1.5):
  1. `fa-id-card` **Right-to-Work verified** — "Every Buddy completes Right-to-Work verification before they can carry anything — and a substitute Buddy is re-checked before they take over."
  2. `fa-lock` **Contributions held in escrow** — "Contributions are held securely by our payments partner and only release once the parcel is handed over."
  3. `fa-box-open` **Sealed parcel, right to refuse** — "Parcels travel sealed with a sender declaration — no inspection step — and the Buddy can refuse any parcel, for any reason."
  4. `fa-shield-halved` **Prohibited items screened** — "Listings are screened against a clear prohibited-items policy, with a report flow so anything concerning reaches our team."
  5. `fa-file-shield` **An immutable audit trail** — "Every compliance-relevant decision is written to an append-only, hash-chained log — transparency you can rely on."
  6. `fa-umbrella` **Optional cover at checkout** — "Senders can add optional cover for a parcel at checkout. It's never mandatory, and we never claim a parcel is 'fully insured'."

### 7. Greener band
- Single horizontal glass card, padding `30px 36px`, radius 18, flex with wrap.
- Green rounded tile (56×56, `#e8f7ee`, `fa-leaf` `#1f9d57` 24px) + heading "A greener way to send." + body: "Because parcels ride along journeys already happening by train, bus, bike or on foot, a pBuddy trip adds **no extra vehicle to the road** — lower-carbon than commissioning a separate dedicated van trip for the same route." + small right-aligned note "Comparative claim · methodology available".
- **Note:** the claim is deliberately comparative + qualified (CMA compliance). Keep it that way; do not strengthen to an absolute.

### 8. Corridors (`#corridors`)
- 2-col grid `0.9fr 1.1fr`, gap 40px.
- **Left:** eyebrow "Corridors"; H2 "We open one route at a time."; body: "Each corridor is allowlisted and seeded with regular travellers before it goes live — so there's always a verified buddy heading your way. More routes are joining the waitlist now." + coral text link "Request your corridor →".
- **Right:** 3 glass rows. Each: coral mode icon + route (17px/700) + note + status pill.
  - `fa-train` "London → Manchester" · "Roster seeded" · **Live** (green pill `#e8f7ee`/`#1f9d57`)
  - `fa-train` "Manchester → London" · "Roster seeded" · **Live**
  - `fa-bus` "Birmingham ↔ Leeds" · "Waitlist open" · **Soon** (coral-tint pill `rgba(255,90,95,0.14)`/`#d12a4d`)

### 9. Two-audience CTA (`#cta`)
- 2-col grid, gap 22px.
- **Card A (Sender) — solid coral `#FF5A5F`, white text**, radius 26, `box-shadow: 0 24px 60px rgba(255,90,95,0.3)`. White-on-translucent icon tile `fa-box`; H3 "Sending something?"; body "Post your sealed parcel, match with a verified Buddy on your corridor, and share their journey cost."; white button (coral text) "Send a parcel".
- **Card B (Buddy) — glass**, radius 26. `#fff0ec` icon tile `fa-route` (coral); H3 "Travelling anyway?"; body "Become a Buddy, carry along a trip you're already making, and have senders share your costs. You choose what, when and how — with a full right to refuse."; solid coral button "Become a buddy".

### 10. FAQ
- Max width 820px. H2 centered "Questions, answered." 5 glass `<details>` accordions; summary (17px/700) + coral `fa-chevron-down` that rotates 180° on open (transition 0.25s). Body 15.5px/1.6.
  1. **How does cost-sharing actually work?** — "A Buddy already making a journey shares the cost of that trip with the people sending parcels along it. The total of everyone's contributions is capped at the Buddy's own journey cost — enforced in our database — so they share expenses rather than profit from the trip."
  2. **Who is allowed to carry a parcel?** — "Every Buddy completes Right-to-Work verification before they can carry anything at all. If a Buddy passes a trip to a substitute, that person is verified too before they take over."
  3. **Do you open and inspect my parcel?** — "No. Parcels travel sealed with a sender declaration of the contents — there's no open-box inspection. The Buddy keeps a full right to refuse any parcel, and listings are screened against our prohibited-items policy."
  4. **Can students take part?** — "Students are welcome to send parcels. Carrying as a Buddy is not available to students — only senders who are not carrying can take part on a student visa."
  5. **Is my parcel covered?** — "Cover is an optional bolt-on the sender can add at checkout — it's never mandatory, and we never describe a parcel as 'fully insured' or guaranteed. Your contribution is always held in escrow until handover."

### 11. Footer
- Glass top border, 3-col grid `1.4fr 1fr 1fr`, padding `44px 24px`.
- Col 1: logo + "pBuddy" + disclaimer: **"pBuddy is a cost-sharing community that connects senders with buddies already travelling. It is not a logistics, transport or hire-and-reward service."**
- Col 2 (Legal): Terms & Conditions · Privacy Policy · Prohibited Items · Cost-sharing explainer.
- Col 3 (Company): How it works · Trust & safety · Corridors · Contact.
- Baseline (12.5px, `#9a9a9f`): "© 2026 pBuddy · Buddies are independent and choose their own journeys · Right-to-Work verified before carrying".

---

## Interactions & Behavior
- **Anchor nav:** nav links and several CTAs smooth-scroll (`scroll-behavior: smooth`) to `#how`, `#model`, `#trust`, `#corridors`, `#cta`.
- **Float animations:** the two hero cards bob gently (`float` 8s / `float2` 9s, ±~12px translateY + slight rotate). Subtle, decorative — safe to reduce/disable under `prefers-reduced-motion`.
- **Cap meter fill:** the hero meter animates width `0 → 68%` once on load (1.6s `cubic-bezier(.2,.8,.2,1)`).
- **FAQ accordion:** native `<details>`; chevron rotates 180° on open.
- **Hover states** (recommend, not in prototype): buttons darken coral ~6% on hover; glass cards lift shadow slightly. Apply your codebase's standard interaction tokens.
- **Responsive:** below ~900px, collapse all 2-col/3-col grids to single column; nav center links collapse into a menu; hero card stack moves below copy. The prototype is desktop-first at 1180px.

## State Management
Static marketing page — **no app state** required. The only dynamic value is the demo cap-meter percentage (hard-coded 68% = £26/£38), purely illustrative. No data fetching.

## Design Tokens
**Colors**
- Primary coral (accent, buttons): `#FF5A5F`
- Coral alt (for darker text-on-light eyebrow): `#c23b46`; coral status text: `#d12a4d`
- Page background: `#fbf3ee`; ambient blobs `#ffe1d6` / `#ffd9dc` / `#ffe9d2`
- Glass card: `rgba(255,255,255,0.7)` (Standard); Subtle `0.8`, Vivid `0.58`
- Glass border: `rgba(255,255,255,0.85)`
- Text: heading `#1d1d1f`; body `#5b5b5f`; muted `#6b6b70` / `#8a8a8f` / `#9a9a9f`
- Success green: text `#1f9d57`, bg `#e8f7ee`
- Star/amber: `#f5a623`
- Icon-tile tint: `#fff0ec`; avatar `#ffd9c2` / `#c8603a`

**Typography** — Plus Jakarta Sans (400/500/600/700/800)
- H1 60/800/-0.035em; Section H2 42/800/-0.03em (model & corridors 38); H3 18.5–21/700; eyebrow 13/700/upper/0.08em; body 15–19/400–500; small 12.5–13.5.

**Radii** — buttons/cards 18px (token, range 10–28); large feature cards 26–30px; pills 999px; icon tiles 14px.

**Shadows** — nav `0 8px 30px rgba(150,60,50,0.1)`; cards `0 14–24px 36–60px rgba(150,60,50,0.08–0.12)`; hero main card `0 30px 70px rgba(150,60,50,0.2)`; coral CTA `0 24px 60px rgba(255,90,95,0.3)`.

**Backdrop blur** — Standard `blur(20px) saturate(160-170%)` (Subtle 12px, Vivid 30px).

**Tweakable props in the prototype** (map to your theme as needed): `accent` (coral options), `glass` (Subtle/Standard/Vivid intensity), `radius` (10–28).

## Assets
- **Icons:** FontAwesome Free 6.5.2 (solid). Use whatever FA package/Icon component your codebase already has; class names are listed per element above. **No emoji.**
- **Fonts:** Plus Jakarta Sans (Google Fonts) — or the nearest clean sans in your design system.
- **Images:** none required. All visuals are CSS + icons. (The repo's `design/extracted/uploads/*.png` are prior screenshots, not page assets.)

## Files in this bundle
- `pBuddy Landing.dc.html` — the hi-fi design reference (open in a browser to view; depends on `support.js`).
- `support.js` — runtime for the `.dc.html` prototype. **Reference only — do not port to production.**
- `README.md` — this spec (self-sufficient; implement from this alone).
