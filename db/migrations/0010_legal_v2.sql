-- Legal pack v2 (epic E21) — aligns the published legal copy with counsel's
-- binding model: sealed-parcel + right-to-refuse (no open-box), Right-to-Work for
-- ALL carriers, no students carrying, OPTIONAL parcel cover (never "fully
-- insured"), and a two-layer liability model. Adds new documents: carrier
-- agreement, liability policy, optional cover, green-claims methodology.
--
-- Source of truth for these texts is /legal/*.md. This migration seeds version 2
-- (and v1 of the new keys), deactivates the superseded v1 rows, and retires the
-- open-box framing snippet that no longer matches the model.
BEGIN;

-- Retire copy that described the old (open-box / Pro-only-RTW / embedded
-- insurance) model so it can never be served again.
UPDATE legal_copy SET is_active = false
 WHERE (key, version) IN (
   ('terms', 1), ('privacy', 1), ('prohibited_items', 1), ('cost_sharing.explainer', 1),
   ('open_box.checklist', 1)
 );

INSERT INTO legal_copy (key, version, body, is_active) VALUES
('terms', 2, $md$# PBuddy Terms of Service

These terms are a contract between you and PBuddy. By using PBuddy you accept them. Please also read the Carrier Agreement (if you carry), the Liability Policy, the Prohibited Items list, and the Privacy Policy — they form part of this agreement.

## 1. What PBuddy is — and is not
PBuddy is a cost-sharing marketplace. It introduces a person sending a parcel (the Sender) to a person who is already making the same journey by public transport, on foot, or by bike (the Buddy). The agreement to carry a parcel is between the Sender and the Buddy. PBuddy provides the platform, holds the contribution securely through its payments partner, and charges its own platform fee for that service.

PBuddy is not a courier, a delivery company, a transport operator, or the Buddy's employer. A contribution is a share of a journey the Buddy was already making — not a delivery fee, a wage, or payment for a service.

## 2. The cost-sharing limit
A Buddy's total accepted contributions on any one journey can never exceed their own verified cost for that journey. This limit is built into the platform and enforced automatically.

## 3. Who can use PBuddy
You must be 18 or over and able to enter a contract. To carry a parcel you must additionally pass identity verification (KYC), have a verified Right to Work in the UK, and not hold a Student visa (carrying is not permitted on a Student visa, which restricts self-employment and business activity). These conditions are checked by the platform before you can post a trip or bid.

## 4. Sending a parcel
You must describe the parcel honestly, send only permitted items (see Prohibited Items), and seal the parcel yourself. You declare its contents — the Buddy does not open or inspect it. By posting you confirm the parcel contains no prohibited items and that the declared value is accurate.

## 5. Carrying a parcel — refuse and substitute
The parcel is presented sealed. You carry it on trust based on the Sender's declaration; you do not open it. Before pickup you may refuse any booking, for any reason, with no penalty; or appoint a substitute — another verified Buddy — to carry it in your place. These rights are yours and are built into the product. (See the Carrier Agreement.)

## 6. Payments and escrow
The contribution, the platform fee, the escrow fee, and any optional cover are shown separately before you commit. The contribution is held in escrow and released to the Buddy only after a successful hand-off. If a booking is cancelled or refused before pickup, any held funds are released back to the Sender. PBuddy never stores your card details — payments and identity checks are handled by Stripe.

## 7. Liability and optional cover
PBuddy's responsibility, and how loss or damage to a parcel is handled, are set out in the Liability Policy, which forms part of these terms. In short: we stand fully behind our own platform service and everything the law does not allow us to exclude; the carriage of goods is a matter between Sender and Buddy and any optional cover the Sender chose. Parcel cover is optional and, when selected, is provided by an authorised insurer under its own terms — PBuddy does not itself insure your goods and does not describe any parcel as "fully insured".

## 8. Tax
You may have tax-reporting obligations on what you receive or pay. PBuddy does not give tax advice. The £1,000 Trading Allowance is per person and may be used up elsewhere. PBuddy may be required to report certain transaction information to HMRC under digital-platform reporting rules.

## 9. Conduct and account action
Misusing PBuddy — false declarations, prohibited items, fraud, harassment, or attempts to take payment outside the platform — can suspend or end your account and may be reported to the authorities.

## 10. Changes
We may update these terms. A new version supersedes the old, and we will record your acceptance of the new version. Material changes are notified in the app.

## 11. Law
These terms are governed by the law of England and Wales, and the courts of England and Wales have jurisdiction. Nothing in these terms removes statutory rights you have as a consumer that cannot be excluded by law.$md$, true),

('carrier_agreement', 1, $md$# Buddy Carrier Agreement

This agreement applies when you carry a parcel as a Buddy. It sits alongside the Terms of Service. It reflects the reality of how PBuddy works: you are an independent person sharing the cost of a journey you were already making — not an employee or worker of PBuddy, and not a courier.

## 1. You are independent
PBuddy does not employ you, and you are not a worker of PBuddy. There is no obligation on you to carry anything, and no obligation on PBuddy to offer you anything. You decide whether to bid, what to bid, when you travel, how you travel, and your route. PBuddy does not direct, supervise, or control any of this. Your contract for each parcel is with the Sender.

## 2. No obligation to accept
You are never assigned work. You see opportunities and bid on the ones you want. Declining to bid has no consequence for you and is not recorded against you.

## 3. Your right to refuse
Before pickup you may refuse any booking, for any reason or none, without penalty. Refusing does not reduce your standing, ranking, or future opportunities. You never open or inspect a parcel — it is presented sealed and you carry it on the strength of the Sender's declaration. If anything makes you unwilling to carry, refuse. Refusing, not inspecting, is your safeguard, and it keeps you protected as someone who did not knowingly carry anything improper.

## 4. Your right of substitution
You may arrange for another verified Buddy to carry a parcel you accepted, in your place, before pickup. The only condition is that your substitute is, like you, identity-verified and Right-to-Work verified — this protects the Sender and is required by law, not a restriction PBuddy imposes to control you. When a substitution is accepted, the booking and the contribution move to your substitute. This right to send a substitute is a genuine one and reflects that you provide a service as an independent person, not in person as an employee would have to.

## 5. The cost-sharing limit applies to you
Your total accepted contributions on any one journey can never exceed your own verified cost for that journey. The platform enforces this. A contribution reimburses a share of your journey — it is not earnings for a delivery service.

## 6. Eligibility
To carry you must keep your identity verification and your Right to Work status current. If you cannot lawfully work in the UK, or you hold a Student visa, you may not carry on PBuddy. This protects you from breaching your immigration conditions and PBuddy from facilitating unlawful working.

## 7. Your responsibilities
Carry the parcel with reasonable care and hand it over only via the app's pickup and drop-off codes. Do not open, tamper with, or use the parcel. Do not take or solicit payment outside PBuddy. Tell us promptly if something goes wrong.

## 8. Tax and your own affairs
You are responsible for your own tax and for any registrations your activity requires. PBuddy does not give tax advice.

## 9. Insurance
PBuddy does not insure you or the goods you carry. The Sender may have chosen optional parcel cover; that cover is between the Sender, the insurer, and its terms. You are responsible for your own personal insurance needs.$md$, true),

('liability_policy', 1, $md$# Liability Policy

This policy explains who is responsible for what on PBuddy. It is deliberately honest: it does not try to exclude things the law says we cannot exclude, and it does not pretend PBuddy insures your goods. It has two layers.

## Layer 1 — What PBuddy is always responsible for
PBuddy provides you a digital platform service. We will provide that service with reasonable care and skill, as the Consumer Rights Act 2015 requires, and we do not exclude or limit: liability for death or personal injury caused by our negligence; liability for fraud or fraudulent misrepresentation by us; our own negligence in operating the platform; or any other liability that cannot be excluded under the law of England and Wales. If we get the platform wrong — for example, we mishandle your escrowed funds through our fault — that is our responsibility and we will put it right.

## Layer 2 — Loss of or damage to a parcel
Carrying the parcel is an arrangement between the Sender and the Buddy. PBuddy is not the carrier and does not own, handle, or underwrite the goods, so PBuddy is not the insurer of your parcel. Because we want the community to be fair, we provide a voluntary goodwill resolution process: if a parcel is lost or damaged in carriage, the Sender may raise it in the app. Where the Sender chose optional parcel cover, the claim is handled under that cover's terms, subject to its excess and exclusions. Where no cover was chosen, PBuddy may, at its discretion and as a goodwill gesture, contribute toward a resolution up to a defined cap shown in the app at the time. This goodwill contribution is not an admission of legal liability and is not insurance.

PBuddy is not liable for loss or damage to goods beyond Layer 1 and beyond any goodwill contribution it chooses to make. The Buddy may be responsible to the Sender for the goods under their own arrangement and the general law.

## Your statutory rights
Nothing in this policy affects the rights you have as a consumer that cannot be excluded by law. If any part of this policy is found unfair or unenforceable, the rest continues to apply. We never describe a parcel as "fully insured" or "guaranteed".$md$, true),

('insurance_optional', 1, $md$# Optional Parcel Cover

Parcel cover on PBuddy is optional. You choose whether to add it when you fund a booking.

## What it is
An optional protection a Sender can add to a parcel, for an additional amount shown clearly before you pay. It is provided by an authorised insurer or intermediary under that provider's own policy terms, limits, excess, and exclusions. It is a way to get help toward the value of an item if it is lost or damaged in carriage, subject to those terms.

## What it is not
It is not provided or underwritten by PBuddy — PBuddy is not your insurer. It is not automatic; if you do not add it, the parcel is not covered by it. It does not make a parcel "fully insured", and PBuddy never describes it that way. It does not cover prohibited items, undeclared contents, or an inaccurately declared value.

## How a claim works
If a covered parcel is lost or damaged, raise it in the app. The claim is assessed under the insurer's terms. You may need to provide evidence of the item's value and what happened. An excess may apply.

## Cost-sharing is unaffected
Optional cover is a separate, clearly itemised charge. It does not change the cost-sharing limit on the Buddy's contribution.$md$, true),

('prohibited_items', 2, $md$# Prohibited Items

To keep PBuddy safe and lawful, you must never send:

- Drugs, controlled substances, or related paraphernalia
- Weapons, ammunition, or explosives
- Cash, bank cards, or negotiable instruments
- Stolen, counterfeit, or illegal goods
- Hazardous, flammable, corrosive, or toxic materials
- Perishable food or anything that can spoil
- Living things (people, animals, plants)
- Anything whose carriage would break the law or a carrier's conditions of travel

## How this is enforced
PBuddy uses a sealed-parcel model. The Sender seals the parcel and declares that its contents are permitted and accurately described. The Buddy does not open or inspect the parcel — instead, the Buddy may refuse to carry it before pickup if anything gives them concern.

By posting a parcel you confirm it is sealed and free of every prohibited item above. Making a false declaration, or sending a prohibited item, can end your account immediately and may be reported to the authorities. The Buddy who refuses a parcel is acting correctly and is protected for doing so.$md$, true),

('cost_sharing.explainer', 2, $md$# How cost-sharing works on PBuddy

PBuddy is built on cost-sharing, like splitting the cost of a car journey. A Buddy is already travelling from A to B; a contribution helps cover a share of that trip's costs — the ticket, the fuel they would spend anyway, the time set aside.

A contribution is not a delivery fee, a wage, or payment for a service.

The platform enforces a hard limit: a Buddy's total accepted contributions on a journey can never exceed their own verified cost for that journey. That limit is what keeps PBuddy a cost-sharing community rather than a courier business — and it is built into the product, as a database rule, not just written here.

## Why it's set up this way
The Buddy is making the journey anyway, for their own reasons. The Buddy chooses whether to carry, what to bid, and can refuse or appoint a substitute. They are independent — not employed by PBuddy, not a courier. Because contributions can't exceed cost, no one is running a delivery business through the back door.

## What you should keep in mind
You may have your own tax obligations on what you receive or pay. PBuddy does not give tax advice; the £1,000 Trading Allowance is per person. Parcels are presented sealed; the Sender declares the contents and the Buddy may refuse rather than inspect. Optional parcel cover is available to Senders; it is not automatic and PBuddy does not itself insure goods.$md$, true),

('privacy', 2, $md$# PBuddy Privacy Policy

This notice explains how PBuddy collects and uses your personal data. PBuddy is the data controller. We process your data under the UK GDPR and the Data Protection Act 2018.

## What we collect
Your phone number (for sign-in) and name; the addresses and details of the parcels and trips you post; identity- and Right-to-Work-verification status (we receive the result of the check, handled by our verification partner); and payment metadata. We do not store card numbers — payments are handled by Stripe.

## How we use it, and our lawful basis
To run the marketplace — matching, pricing, hand-off, and payments (performance of our contract with you). For safety, fraud prevention, and to enforce our terms (our legitimate interests). To meet legal and compliance obligations, including identity, Right-to-Work, and any tax-reporting duties (legal obligation).

## Who we share it with
Service providers that make PBuddy work — for example Stripe (payments and identity), our verification and insurance partners, and Google Cloud (hosting) — and authorities where the law requires. We do not sell your personal data.

## Your rights
You can request access to, correction of, or deletion of your personal data, and you can object to or restrict certain processing. To exercise these rights, contact us. You also have the right to complain to the Information Commissioner's Office (ICO).

## Retention
We keep compliance records — including an immutable audit trail of key actions — for as long as the law requires. Other data is kept while your account is active and for a reasonable period afterwards.

## International transfers
Where data is processed outside the UK by a provider, we rely on appropriate safeguards (such as adequacy decisions or standard contractual clauses).

## Changes
We may update this notice; a new version supersedes the old and is published in the app.$md$, true),

('green_claims', 1, $md$# Green Claims Methodology

PBuddy makes no environmental claim until it passes this methodology. The standard is the CMA Green Claims Code, the greenwashing provisions of the Digital Markets, Competition and Consumers Act 2024, and the ASA/CAP advertising rules.

## The six tests every claim must pass
1. Truthful and accurate — the claim is correct and we can prove it.
2. Clear and unambiguous — plain meaning; no implied wider benefit.
3. Not omitting or hiding material information.
4. Fair comparisons — like-for-like, against a clearly stated baseline.
5. Considers the full life cycle — no cherry-picking one favourable stage.
6. Substantiated — backed by robust, up-to-date evidence held on file.

## PBuddy-specific rules
Always name the baseline — a comparative claim must state than what (e.g. "compared with a dedicated van making the same single trip"); never a bare "green" / "eco" / "sustainable". No absolute claims ("zero-carbon", "carbon-neutral") unless independently verified. Only count genuine marginal impact: the Buddy is already making the journey, so the comparison must reflect marginal impact, not pretend the journey is free. No offset-based "neutral" claims without disclosing the scheme. Keep dated evidence with a named owner; review at least annually.

No environmental claim may appear anywhere in the product or marketing until it has completed, approved substantiation on file.$md$, true)
ON CONFLICT (key, version) DO NOTHING;

COMMIT;
