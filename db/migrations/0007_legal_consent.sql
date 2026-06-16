-- Legal pages + consent capture (PBD-68). Adds the user-facing legal documents
-- to the versioned legal_copy table and records which version each user accepted
-- at sign-up, so we have a per-user, timestamped, auditable consent trail.
BEGIN;

-- Which legal bundle version the user accepted, and when.
ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_version     integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS legal_accepted_at timestamptz;

-- The four user-facing legal documents (markdown bodies). Versioned + active so
-- a future revision is a new row (version 2) and the accepted version is provable.
INSERT INTO legal_copy (key, version, body) VALUES
  ('terms', 1,
   E'# PBuddy Terms of Service\n\n'
   '## 1. What PBuddy is\n'
   'PBuddy is a cost-sharing platform that connects people sending parcels with travellers already making the same journey. '
   'A traveller''s accepted contribution reimburses a share of their own travel costs. It is not a delivery fee, a wage, or payment for a service, and PBuddy is not a courier or a transport company.\n\n'
   '## 2. Your responsibilities\n'
   'You must give accurate information, send only permitted items (see Prohibited Items), and complete the open-box check before pickup. '
   'A traveller''s total accepted contributions on a trip can never exceed their own verified journey cost — this limit is enforced by the platform.\n\n'
   '## 3. Payments\n'
   'Contributions are held in escrow and released after a successful hand-off. PBuddy charges its own platform and escrow charges, shown separately at checkout.\n\n'
   '## 4. Tiers\n'
   'Casual Buddy is capped and frequency-limited. Pro Buddy is uncapped but requires Right-to-Work verification and appropriate insurance; students cannot use Pro Buddy.\n\n'
   '## 5. Liability & insurance\n'
   'Parcels are covered by the embedded insurance bound at checkout, subject to its terms. PBuddy is not liable beyond what that cover provides.\n\n'
   '## 6. Changes\n'
   'We may update these terms; a new version supersedes the old and we will record your acceptance of it.'),
  ('privacy', 1,
   E'# PBuddy Privacy Policy\n\n'
   '## What we collect\n'
   'Your phone number (for sign-in), name, the addresses and details of parcels/trips you post, identity-verification status, and payment metadata. '
   'We do not store card numbers — payments are handled by Stripe.\n\n'
   '## How we use it\n'
   'To run the marketplace: matching, pricing, hand-off, payments, safety, fraud prevention, and our legal/compliance obligations.\n\n'
   '## Who we share it with\n'
   'Service providers that make PBuddy work (e.g. Stripe for payments and identity, our insurer, Google Cloud for hosting), and authorities where the law requires.\n\n'
   '## Your rights\n'
   'You can request access to, correction of, or deletion of your personal data. Contact us to exercise these rights.\n\n'
   '## Retention\n'
   'We keep compliance records (including an immutable audit trail) for as long as the law requires, and other data for as long as your account is active.'),
  ('prohibited_items', 1,
   E'# Prohibited Items\n\n'
   'To keep PBuddy safe and lawful, you must never send:\n\n'
   '- Drugs, controlled substances, or related paraphernalia\n'
   '- Weapons, ammunition, or explosives\n'
   '- Cash, bank cards, or negotiable instruments\n'
   '- Stolen, counterfeit, or illegal goods\n'
   '- Hazardous, flammable, or toxic materials\n'
   '- Perishable food or anything that can spoil\n'
   '- Living things (people, animals, plants)\n\n'
   'The sender declares the parcel is free of these, and the traveller confirms it during the open-box check before pickup. '
   'Breaking this rule can end your account and may be reported to the authorities.'),
  ('cost_sharing.explainer', 1,
   E'# How cost-sharing works on PBuddy\n\n'
   'PBuddy is built on cost-sharing, like sharing the cost of a car journey. A traveller is already going from A to B; '
   'a contribution helps cover a share of that trip''s costs (fuel, ticket, time set aside).\n\n'
   '**A contribution is not a delivery fee, a wage, or payment for a service.** '
   'The platform enforces a hard limit: a traveller''s total accepted contributions on a journey can never exceed their own verified cost for that journey. '
   'That limit is what keeps PBuddy a cost-sharing community rather than a courier business — and it is built into the product, not just written here.\n\n'
   'If you want to carry parcels as a business without that limit, that is the Pro Buddy tier, which has its own verification and insurance requirements.')
ON CONFLICT (key, version) DO NOTHING;

COMMIT;
