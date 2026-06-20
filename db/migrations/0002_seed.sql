-- Seed data: the domestic corridor allowlist + versioned legal/framing copy.
-- These are the only routes that exist; "domestic only" is enforced by absence
-- of any international pair here.

BEGIN;

INSERT INTO corridors (origin_city, dest_city, display_name) VALUES
    ('London', 'Manchester',  'London ↔ Manchester'),
    ('London', 'Birmingham',  'London ↔ Birmingham'),
    ('London', 'Leeds',       'London ↔ Leeds')
ON CONFLICT (origin_city, dest_city) DO NOTHING;

INSERT INTO legal_copy (key, version, body) VALUES
    ('contribution.explainer', 1,
     'This is a contribution toward the traveller''s journey costs. PBuddy is a cost-sharing platform — this is not a delivery fee, wage, or payment for a job.'),
    ('framing.receipt_header', 1,
     'Travel Cost Contribution — not a delivery fee. PBuddy is a cost-sharing platform.'),
    ('open_box.checklist', 1,
     'Before you accept: I have seen the contents. There are no prohibited items (no drugs, weapons, cash, or stolen goods). The contents match the listing.'),
    ('prohibited_items.declaration', 1,
     'I confirm this parcel contains no prohibited items: no drugs, weapons, ammunition, cash, stolen goods, hazardous materials, perishables, or living things.'),
    ('student.cost_sharing_notice', 1,
     'PBuddy is cost-sharing, not work or self-employment. Contributions reimburse your travel costs and are not earnings or profit.'),
    ('tax.trading_allowance_disclosure', 1,
     'You may have tax-reporting obligations. PBuddy does not give tax advice. The £1,000 Trading Allowance is per person and may be used up elsewhere.')
ON CONFLICT (key, version) DO NOTHING;

COMMIT;
