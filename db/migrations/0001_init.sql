-- PBuddy initial schema.
--
-- Design principle: the legal model IS the architecture. The cost-sharing safe
-- harbour is enforced here as DB-level invariants (constraints + the capacity
-- ledger + the append-only compliance audit log), not left to application code or
-- terms of service. Money is stored in integer pence. No column is ever named
-- "fee"/"price"/"earnings" on the user-facing contribution path — it is a
-- "contribution" toward the traveller's journey.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE kyc_status        AS ENUM ('unverified', 'pending', 'verified', 'rejected');
CREATE TYPE immigration_class AS ENUM ('uk_citizen_settled', 'student_visa', 'other_visa', 'undeclared');
CREATE TYPE user_tier         AS ENUM ('casual_buddy', 'pro_buddy');
CREATE TYPE rtw_status        AS ENUM ('not_started', 'pending', 'verified', 'rejected');
CREATE TYPE transport_mode    AS ENUM ('train', 'bus', 'coach', 'car');
CREATE TYPE trip_direction    AS ENUM ('outbound', 'return');   -- origin->dest / dest->origin
CREATE TYPE trip_status       AS ENUM ('open', 'full', 'in_progress', 'completed', 'cancelled');
CREATE TYPE journey_cost_source AS ENUM ('api_estimate', 'receipt_upload', 'self_declared');
CREATE TYPE pricing_mode      AS ENUM ('fixed', 'auction');
CREATE TYPE parcel_status     AS ENUM ('draft', 'listed', 'matched', 'in_transit', 'delivered', 'cancelled', 'disputed');
CREATE TYPE bid_status        AS ENUM ('pending', 'accepted', 'declined', 'withdrawn', 'expired');
CREATE TYPE booking_status    AS ENUM ('claimed', 'funded', 'picked_up', 'delivered', 'released', 'refunded', 'disputed');
CREATE TYPE payment_state     AS ENUM ('authorized', 'captured', 'released', 'refunded', 'partially_refunded');
CREATE TYPE handoff_type      AS ENUM ('open_box_confirmed', 'pickup_scan', 'dropoff_scan', 'dispute_opened');
CREATE TYPE dispute_status    AS ENUM ('open', 'investigating', 'resolved_release', 'resolved_refund', 'resolved_split');

-- ---------------------------------------------------------------------------
-- Compliance config: pilot-tunable thresholds. Single row.
-- ---------------------------------------------------------------------------
CREATE TABLE compliance_config (
    id                          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    max_trips_per_week_global   smallint NOT NULL DEFAULT 3,
    max_trips_per_route_week    smallint NOT NULL DEFAULT 3,
    max_trips_per_month         smallint NOT NULL DEFAULT 8,
    max_declared_value_pennies  integer  NOT NULL DEFAULT 10000,  -- £100 pilot value cap
    trading_allowance_pennies   integer  NOT NULL DEFAULT 100000, -- £1,000 HMRC disclosure trigger
    student_stricter_factor     numeric  NOT NULL DEFAULT 0.80,   -- students get a tighter cap/throttle
    max_luggage_pieces          smallint NOT NULL DEFAULT 3,      -- National Rail
    max_dimension_cm            smallint NOT NULL DEFAULT 100,    -- no dimension > 1m
    updated_at                  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO compliance_config (id) VALUES (1);

-- ---------------------------------------------------------------------------
-- Versioned legal copy. UI never hardcodes contribution/framing strings; it
-- references a key here so framing is consistent and auditable over time.
-- ---------------------------------------------------------------------------
CREATE TABLE legal_copy (
    key         text NOT NULL,
    version     integer NOT NULL,
    body        text NOT NULL,
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (key, version)
);

-- ---------------------------------------------------------------------------
-- Users. One row per person; roles are additive (a user can send AND travel).
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid        text UNIQUE NOT NULL,           -- from Firebase phone auth
    phone               text UNIQUE NOT NULL,
    email               text,
    full_name           text,
    avatar_url          text,
    is_sender           boolean NOT NULL DEFAULT true,
    is_traveler         boolean NOT NULL DEFAULT false,
    kyc_status          kyc_status NOT NULL DEFAULT 'unverified',
    stripe_customer_id  text,
    stripe_connect_id   text,                           -- payee account (travellers)
    trust_score         numeric NOT NULL DEFAULT 0,
    rating_avg          numeric NOT NULL DEFAULT 0,
    rating_count        integer NOT NULL DEFAULT 0,
    immigration_class   immigration_class NOT NULL DEFAULT 'undeclared',
    tier                user_tier NOT NULL DEFAULT 'casual_buddy',
    -- Pro Buddy gates (only meaningful when tier = 'pro_buddy'):
    rtw_check_id        text,
    rtw_status          rtw_status NOT NULL DEFAULT 'not_started',
    hire_reward_policy_id text,
    self_employed_ack_at  timestamptz,
    -- HMRC trading-allowance disclosure tracking:
    gross_contribution_pennies_ytd integer NOT NULL DEFAULT 0,
    tax_disclosure_ack_at timestamptz,
    accepted_terms_at   timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),

    -- INVARIANT: a student-visa user can NEVER be Pro Buddy. Enforced at the DB
    -- layer so no application bug can promote a visa-restricted user into the
    -- uncapped tier.
    CONSTRAINT students_cannot_be_pro
        CHECK (NOT (immigration_class = 'student_visa' AND tier = 'pro_buddy')),
    -- INVARIANT: Pro Buddy requires a verified Right to Work.
    CONSTRAINT pro_requires_rtw
        CHECK (tier <> 'pro_buddy' OR rtw_status = 'verified')
);

-- ---------------------------------------------------------------------------
-- Corridors: a curated allowlist of DOMESTIC UK city pairs. International routes
-- simply do not exist in this table, which is how "domestic only" is enforced.
-- ---------------------------------------------------------------------------
CREATE TABLE corridors (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    origin_city   text NOT NULL,
    dest_city     text NOT NULL,
    display_name  text NOT NULL,                 -- "London <-> Manchester"
    is_active     boolean NOT NULL DEFAULT true,
    created_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (origin_city, dest_city)
);

-- ---------------------------------------------------------------------------
-- Trips: a traveller's journey. journey_cost_pennies is the CAP CEILING and is
-- locked at creation so it cannot be inflated later to accept more parcels.
-- ---------------------------------------------------------------------------
CREATE TABLE trips (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    traveler_id         uuid NOT NULL REFERENCES users(id),
    corridor_id         uuid NOT NULL REFERENCES corridors(id),
    direction           trip_direction NOT NULL,
    transport_mode      transport_mode NOT NULL,
    depart_at           timestamptz NOT NULL,
    capacity_pieces     smallint NOT NULL DEFAULT 3 CHECK (capacity_pieces BETWEEN 1 AND 3),
    journey_cost_pennies integer NOT NULL CHECK (journey_cost_pennies >= 0),
    journey_cost_source journey_cost_source NOT NULL,
    journey_cost_evidence_url text,
    cost_locked_at      timestamptz NOT NULL DEFAULT now(),
    status              trip_status NOT NULL DEFAULT 'open',
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX trips_corridor_dir_depart_idx ON trips (corridor_id, direction, depart_at);
CREATE INDEX trips_traveler_idx ON trips (traveler_id);

-- ---------------------------------------------------------------------------
-- The firewall: one capacity ledger row per trip. committed must never exceed
-- the cap. remaining is a generated column so it can never drift.
-- ---------------------------------------------------------------------------
CREATE TABLE trip_capacity_ledger (
    trip_id              uuid PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
    cap_pennies          integer NOT NULL,
    committed_pennies    integer NOT NULL DEFAULT 0,
    remaining_pennies    integer GENERATED ALWAYS AS (cap_pennies - committed_pennies) STORED,
    committed_pieces     smallint NOT NULL DEFAULT 0,
    updated_at           timestamptz NOT NULL DEFAULT now(),

    -- THE COST-SHARING INVARIANT, enforced by the database:
    CONSTRAINT committed_within_cap CHECK (committed_pennies <= cap_pennies),
    CONSTRAINT committed_non_negative CHECK (committed_pennies >= 0)
);

-- Keep the ledger in lock-step with the trip's locked journey cost.
CREATE OR REPLACE FUNCTION init_trip_capacity_ledger() RETURNS trigger AS $$
BEGIN
    INSERT INTO trip_capacity_ledger (trip_id, cap_pennies)
    VALUES (NEW.id, NEW.journey_cost_pennies);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trips_init_ledger
    AFTER INSERT ON trips
    FOR EACH ROW EXECUTE FUNCTION init_trip_capacity_ledger();

-- ---------------------------------------------------------------------------
-- Parcels: a sender's listing. Carries REAL pickup/dropoff postcodes + coords
-- (validated GB via postcodes.io in the API). Contribution is never a "fee".
-- ---------------------------------------------------------------------------
CREATE TABLE parcels (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id             uuid NOT NULL REFERENCES users(id),
    corridor_id           uuid NOT NULL REFERENCES corridors(id),
    direction             trip_direction NOT NULL,
    title                 text NOT NULL,
    description           text,
    category              text NOT NULL,                 -- must not be a prohibited category
    photo_urls            jsonb NOT NULL DEFAULT '[]',
    -- real addresses:
    pickup_postcode       text NOT NULL,
    pickup_address_line   text NOT NULL,
    pickup_lat            double precision NOT NULL,
    pickup_lng            double precision NOT NULL,
    dropoff_postcode      text NOT NULL,
    dropoff_address_line  text NOT NULL,
    dropoff_lat           double precision NOT NULL,
    dropoff_lng           double precision NOT NULL,
    -- size / National Rail luggage limits:
    length_cm             smallint NOT NULL CHECK (length_cm > 0 AND length_cm <= 100),
    width_cm              smallint NOT NULL CHECK (width_cm  > 0 AND width_cm  <= 100),
    height_cm             smallint NOT NULL CHECK (height_cm > 0 AND height_cm <= 100),
    weight_g              integer  NOT NULL CHECK (weight_g > 0),
    piece_count           smallint NOT NULL DEFAULT 1 CHECK (piece_count BETWEEN 1 AND 3),
    declared_value_pennies integer NOT NULL CHECK (declared_value_pennies >= 0),
    -- pricing:
    pricing_mode          pricing_mode NOT NULL DEFAULT 'fixed',
    suggested_contribution_pennies integer CHECK (suggested_contribution_pennies >= 0),
    max_contribution_pennies integer NOT NULL CHECK (max_contribution_pennies >= 0),
    contribution_amount_pennies integer CHECK (contribution_amount_pennies >= 0), -- set on fixed / on accept
    pickup_window_start   timestamptz NOT NULL,
    pickup_window_end     timestamptz NOT NULL,
    dropoff_window_start  timestamptz,
    dropoff_window_end    timestamptz,
    prohibited_items_ack_at timestamptz NOT NULL DEFAULT now(),
    status                parcel_status NOT NULL DEFAULT 'listed',
    created_at            timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT pickup_window_valid CHECK (pickup_window_end >= pickup_window_start)
);
CREATE INDEX parcels_corridor_dir_status_idx ON parcels (corridor_id, direction, status);
CREATE INDEX parcels_sender_idx ON parcels (sender_id);

-- ---------------------------------------------------------------------------
-- Bids/offers. A bid is cap-validated at creation by the API; the partial
-- unique index guarantees a parcel can have at most one ACCEPTED bid.
-- ---------------------------------------------------------------------------
CREATE TABLE bids (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id              uuid NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    trip_id                uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    traveler_id            uuid NOT NULL REFERENCES users(id),
    bid_contribution_pennies integer NOT NULL CHECK (bid_contribution_pennies > 0),
    bid_pieces             smallint NOT NULL DEFAULT 1 CHECK (bid_pieces BETWEEN 1 AND 3),
    status                 bid_status NOT NULL DEFAULT 'pending',
    expires_at             timestamptz,
    created_at             timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bids_parcel_idx ON bids (parcel_id);
CREATE INDEX bids_trip_idx ON bids (trip_id);
CREATE UNIQUE INDEX bids_one_accepted_per_parcel
    ON bids (parcel_id) WHERE status = 'accepted';

-- ---------------------------------------------------------------------------
-- Bookings: created when a bid is accepted (one parcel <-> one trip).
-- ---------------------------------------------------------------------------
CREATE TABLE bookings (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id     uuid NOT NULL REFERENCES parcels(id),
    trip_id       uuid NOT NULL REFERENCES trips(id),
    bid_id        uuid NOT NULL REFERENCES bids(id),
    traveler_id   uuid NOT NULL REFERENCES users(id),
    sender_id     uuid NOT NULL REFERENCES users(id),
    contribution_pennies integer NOT NULL CHECK (contribution_pennies > 0),
    status        booking_status NOT NULL DEFAULT 'claimed',
    pickup_otp_hash   text,
    dropoff_otp_hash  text,
    pickup_qr_token   text,
    dropoff_qr_token  text,
    claimed_at    timestamptz NOT NULL DEFAULT now(),
    funded_at     timestamptz,
    picked_up_at  timestamptz,
    delivered_at  timestamptz,
    released_at   timestamptz,

    -- one active booking per parcel:
    CONSTRAINT one_booking_per_parcel UNIQUE (parcel_id),
    -- INVARIANT: cannot reach picked_up without an open-box inspection event.
    -- (Enforced by trigger below as well — this is the structural backstop.)
    CONSTRAINT pickup_requires_timestamps
        CHECK (status <> 'picked_up' OR picked_up_at IS NOT NULL)
);
CREATE INDEX bookings_trip_idx ON bookings (trip_id);
CREATE INDEX bookings_sender_idx ON bookings (sender_id);
CREATE INDEX bookings_traveler_idx ON bookings (traveler_id);

-- ---------------------------------------------------------------------------
-- Payments (escrow ledger). State transitions only happen in the API in
-- response to signed Stripe webhooks.
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id               uuid NOT NULL UNIQUE REFERENCES bookings(id),
    stripe_payment_intent_id text,
    stripe_transfer_id       text,
    gross_pennies            integer NOT NULL,
    platform_fee_pennies     integer NOT NULL,
    escrow_fee_pennies       integer NOT NULL DEFAULT 150,   -- flat £1.50
    insurance_cost_pennies   integer NOT NULL DEFAULT 0,
    traveler_payout_pennies  integer NOT NULL,
    currency                 text NOT NULL DEFAULT 'GBP',
    state                    payment_state NOT NULL DEFAULT 'authorized',
    captured_at              timestamptz,
    released_at              timestamptz,
    created_at               timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Hand-off events: append-only operational trail (open-box, scans, disputes).
-- ---------------------------------------------------------------------------
CREATE TABLE handoff_events (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id    uuid NOT NULL REFERENCES bookings(id),
    type          handoff_type NOT NULL,
    actor_id      uuid NOT NULL REFERENCES users(id),
    method        text,                 -- 'qr' | 'otp'
    success       boolean NOT NULL DEFAULT true,
    checklist_version integer,
    geo_lat       double precision,
    geo_lng       double precision,
    photo_url     text,
    created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX handoff_events_booking_idx ON handoff_events (booking_id, type);

-- Structural backstop for the Open-Box Policy: a booking cannot move to
-- picked_up unless an open_box_confirmed event already exists for it.
CREATE OR REPLACE FUNCTION enforce_open_box_before_pickup() RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'picked_up' AND OLD.status <> 'picked_up' THEN
        IF NOT EXISTS (
            SELECT 1 FROM handoff_events
            WHERE booking_id = NEW.id
              AND type = 'open_box_confirmed'
              AND success
        ) THEN
            RAISE EXCEPTION 'open_box_required: booking % cannot be picked up before open-box inspection', NEW.id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_enforce_open_box
    BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION enforce_open_box_before_pickup();

-- ---------------------------------------------------------------------------
-- Insurance, reviews, disputes, frequency counters.
-- ---------------------------------------------------------------------------
CREATE TABLE insurance_policies (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id           uuid NOT NULL REFERENCES bookings(id),
    provider             text NOT NULL DEFAULT 'anansi',
    policy_ref           text,
    cover_pennies        integer NOT NULL,
    premium_cost_pennies integer NOT NULL,   -- what PBuddy pays the insurer (~50p)
    premium_charged_pennies integer NOT NULL,-- what the sender pays (~£1.99)
    terms_version        text,
    status               text NOT NULL DEFAULT 'quoted',
    created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reviews (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id  uuid NOT NULL REFERENCES bookings(id),
    rater_id    uuid NOT NULL REFERENCES users(id),
    ratee_id    uuid NOT NULL REFERENCES users(id),
    role_rated  text NOT NULL,           -- 'sender' | 'traveler'
    stars       smallint NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment     text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (booking_id, rater_id)
);

CREATE TABLE disputes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id      uuid NOT NULL REFERENCES bookings(id),
    opened_by       uuid NOT NULL REFERENCES users(id),
    reason_code     text NOT NULL,
    description     text,
    status          dispute_status NOT NULL DEFAULT 'open',
    resolution_notes text,
    resolved_by     uuid REFERENCES users(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    resolved_at     timestamptz
);

CREATE TABLE user_trip_counters (
    user_id        uuid NOT NULL REFERENCES users(id),
    window_start   date NOT NULL,         -- ISO week start (Monday)
    corridor_id    uuid REFERENCES corridors(id),  -- NULL row = global weekly count
    trips_count    smallint NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, window_start, corridor_id)
);

-- ---------------------------------------------------------------------------
-- Compliance audit log: APPEND-ONLY, hash-chained. This is the evidence trail
-- that proves to HMRC / Home Office / insurers that the rules were enforced.
-- ---------------------------------------------------------------------------
CREATE TABLE compliance_audit_log (
    id          bigserial PRIMARY KEY,
    event_type  text NOT NULL,           -- CAP_CHECK, FREQUENCY_CHECK, FRAMING_SHOWN, ...
    user_id     uuid REFERENCES users(id),
    booking_id  uuid REFERENCES bookings(id),
    trip_id     uuid REFERENCES trips(id),
    parcel_id   uuid REFERENCES parcels(id),
    payload     jsonb NOT NULL DEFAULT '{}',
    prev_hash   text,
    row_hash    text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX compliance_audit_user_idx ON compliance_audit_log (user_id, created_at);
CREATE INDEX compliance_audit_type_idx ON compliance_audit_log (event_type, created_at);

-- Hash-chain each row to the previous one and forbid UPDATE/DELETE so the trail
-- is tamper-evident and append-only.
CREATE OR REPLACE FUNCTION audit_hash_chain() RETURNS trigger AS $$
DECLARE
    last_hash text;
BEGIN
    SELECT row_hash INTO last_hash FROM compliance_audit_log ORDER BY id DESC LIMIT 1;
    NEW.prev_hash := last_hash;
    NEW.row_hash := encode(
        digest(
            coalesce(last_hash, '') || NEW.event_type || coalesce(NEW.user_id::text, '')
            || coalesce(NEW.booking_id::text, '') || NEW.payload::text
            || coalesce(NEW.created_at::text, now()::text),
            'sha256'
        ), 'hex');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compliance_audit_chain
    BEFORE INSERT ON compliance_audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_hash_chain();

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'compliance_audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER compliance_audit_no_update
    BEFORE UPDATE OR DELETE ON compliance_audit_log
    FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

COMMIT;
