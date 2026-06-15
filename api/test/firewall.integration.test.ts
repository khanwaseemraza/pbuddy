// Integration tests against a REAL Postgres (booted via embedded-postgres — no
// Docker needed). Covers the cost-sharing firewall at the DB level and the
// parcel/trip routes (domestic-only validation, caps, frequency throttle).
//
// Modules that open the pool are imported dynamically in before(), AFTER
// DATABASE_URL is set, so the pool binds to the throwaway database.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestPg, type TestPg } from './_pg.ts';

let tpg: TestPg;
let pool: import('pg').Pool;
let reserveCapacity: typeof import('../src/services/caps.ts').reserveCapacity;
let app: import('fastify').FastifyInstance;
let corridorId: string;
const realFetch = globalThis.fetch;

// Fake Stripe so the escrow state machine is tested without the network.
let stripeSeq = 0;
const fakeStripe = {
  accounts: { create: async () => ({ id: `acct_test_${++stripeSeq}` }) },
  accountLinks: { create: async () => ({ url: 'https://connect.stripe.test/onboard' }) },
  paymentIntents: {
    create: async () => ({ id: `pi_${++stripeSeq}`, client_secret: `pi_secret_${stripeSeq}`, status: 'requires_payment_method' }),
    capture: async (id: string) => ({ id, status: 'succeeded' }),
    cancel: async (id: string) => ({ id, status: 'canceled' }),
  },
  transfers: { create: async () => ({ id: `tr_${++stripeSeq}` }) },
  refunds: { create: async () => ({ id: `re_${++stripeSeq}`, status: 'succeeded' }) },
  identity: {
    verificationSessions: {
      create: async () => ({ id: `vs_${++stripeSeq}`, client_secret: `vs_secret_${stripeSeq}`, url: 'https://verify.stripe.test', status: 'requires_input' }),
    },
  },
  webhooks: { constructEvent: (payload: Buffer) => JSON.parse(payload.toString()) },
};

before(async () => {
  tpg = await startTestPg();
  process.env.DATABASE_URL = tpg.connectionString;
  process.env.AUTH_DEV_BYPASS = '1';
  process.env.DISABLE_FIRESTORE_MIRROR = '1'; // best-effort mirror off in tests
  process.env.ADMIN_FIREBASE_UIDS = 'test-admin';
  ({ pool } = await import('../src/db.ts'));
  ({ reserveCapacity } = await import('../src/services/caps.ts'));
  const { setStripeForTests } = await import('../src/lib/stripe.ts');
  setStripeForTests(fakeStripe as never);
  const { buildServer } = await import('../src/server.ts');
  app = buildServer();
  await app.ready();

  // Seed verified users + grab the seeded corridor.
  await pool.query(
    `INSERT INTO users (firebase_uid, phone, kyc_status, is_sender)
     VALUES ('test-sender','+440000000001','verified',true)
     ON CONFLICT (firebase_uid) DO UPDATE SET kyc_status='verified'`,
  );
  await pool.query(
    `INSERT INTO users (firebase_uid, phone, kyc_status, is_traveler)
     VALUES ('test-traveler','+440000000002','verified',true)
     ON CONFLICT (firebase_uid) DO UPDATE SET kyc_status='verified'`,
  );
  await pool.query(
    `INSERT INTO users (firebase_uid, phone, kyc_status)
     VALUES ('test-outsider','+440000000003','verified')
     ON CONFLICT (firebase_uid) DO UPDATE SET kyc_status='verified'`,
  );
  await pool.query(
    `INSERT INTO users (firebase_uid, phone, kyc_status)
     VALUES ('test-admin','+440000000004','verified')
     ON CONFLICT (firebase_uid) DO UPDATE SET kyc_status='verified'`,
  );
  corridorId = (await pool.query(
    `SELECT id FROM corridors WHERE origin_city='London' AND dest_city='Manchester'`,
  )).rows[0].id;

  // Stub postcodes.io so route tests are hermetic. JE2* => non-GB (Jersey).
  globalThis.fetch = (async (url: string) => {
    const u = String(url);
    const body = u.includes('JE2')
      ? { result: { postcode: 'JE2 3AB', latitude: 49.2, longitude: -2.1, country: 'Jersey' } }
      : { result: { postcode: 'M1 1AE', latitude: 53.48, longitude: -2.24, country: 'England' } };
    return { status: 200, ok: true, json: async () => body } as unknown as Response;
  }) as typeof fetch;
});

after(async () => {
  globalThis.fetch = realFetch;
  await app?.close();
  await pool?.end?.();
  await tpg?.stop();
});

async function seedTripWithCap(capPennies: number): Promise<string> {
  const traveler = (await pool.query(`SELECT id FROM users WHERE firebase_uid='test-traveler'`)).rows[0].id;
  const trip = await pool.query(
    `INSERT INTO trips (traveler_id, corridor_id, direction, transport_mode, depart_at,
                        journey_cost_pennies, journey_cost_source)
     VALUES ($1,$2,'outbound','train', now() + interval '2 days', $3, 'api_estimate')
     RETURNING id`,
    [traveler, corridorId, capPennies],
  );
  return trip.rows[0].id as string;
}

function parcelPayload(over: Record<string, unknown> = {}) {
  return {
    corridor_id: corridorId,
    direction: 'outbound',
    title: 'Box of books',
    category: 'general',
    pickup: { postcode: 'M1 1AE', address_line: '1 Test St' },
    dropoff: { postcode: 'M1 1AE', address_line: '2 Test Rd' },
    length_cm: 30, width_cm: 20, height_cm: 10, weight_g: 1500, piece_count: 1,
    declared_value_pennies: 5000,
    pricing_mode: 'auction',
    max_contribution_pennies: 2000,
    pickup_window_start: new Date(Date.now() + 86400000).toISOString(),
    pickup_window_end: new Date(Date.now() + 2 * 86400000).toISOString(),
    prohibited_items_ack: true,
    ...over,
  };
}

// ---- Firewall (DB-level) -------------------------------------------------

test('ledger is auto-created with cap = journey cost', async () => {
  const tripId = await seedTripWithCap(5000);
  const { rows } = await pool.query(
    'SELECT cap_pennies, committed_pennies, remaining_pennies FROM trip_capacity_ledger WHERE trip_id=$1',
    [tripId],
  );
  assert.equal(rows[0].cap_pennies, 5000);
  assert.equal(rows[0].remaining_pennies, 5000);
});

test('reserveCapacity rejects a reservation over the cap', async () => {
  const tripId = await seedTripWithCap(5000);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const d = await reserveCapacity(client, tripId, 6000, 1);
    assert.equal(d.allowed, false);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
});

test('concurrent reservations cannot push committed over the cap', async () => {
  const tripId = await seedTripWithCap(5000);
  async function attempt(amount: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const d = await reserveCapacity(client, tripId, amount, 1);
      if (!d.allowed) { await client.query('ROLLBACK'); return false; }
      await client.query('COMMIT');
      return true;
    } catch { await client.query('ROLLBACK').catch(() => {}); return false; }
    finally { client.release(); }
  }
  const [a, b] = await Promise.all([attempt(3000), attempt(3000)]);
  assert.equal([a, b].filter(Boolean).length, 1, 'exactly one reservation should succeed');
  const committed = (await pool.query(
    'SELECT committed_pennies FROM trip_capacity_ledger WHERE trip_id=$1', [tripId])).rows[0].committed_pennies;
  assert.equal(committed, 3000);
});

test('the DB CHECK constraint is the final backstop against over-commit', async () => {
  const tripId = await seedTripWithCap(5000);
  await assert.rejects(
    pool.query('UPDATE trip_capacity_ledger SET committed_pennies=6000 WHERE trip_id=$1', [tripId]),
    /committed_within_cap|check/i,
  );
});

test('a student-visa user can never be Pro Buddy (DB constraint)', async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO users (firebase_uid, phone, immigration_class, tier, rtw_status)
       VALUES ('student-pro','+440000000009','student_visa','pro_buddy','verified')`,
    ),
    /students_cannot_be_pro|check/i,
  );
});

test('compliance_audit_log is append-only', async () => {
  await pool.query(`INSERT INTO compliance_audit_log (event_type, payload) VALUES ('CAP_CHECK','{"t":1}')`);
  await assert.rejects(
    pool.query(`UPDATE compliance_audit_log SET event_type='x' WHERE event_type='CAP_CHECK'`),
    /append-only/i,
  );
});

// ---- Parcel route (PBD-21 / PBD-17) --------------------------------------

test('POST /parcels persists GB addresses with geocoded lat/lng', async () => {
  const res = await app.inject({
    method: 'POST', url: '/parcels',
    headers: { authorization: 'Bearer test-sender' },
    payload: parcelPayload(),
  });
  assert.equal(res.statusCode, 201, res.body);
  const parcel = res.json();
  const row = (await pool.query(
    'SELECT pickup_postcode, pickup_lat, dropoff_lng FROM parcels WHERE id=$1', [parcel.id])).rows[0];
  assert.equal(row.pickup_postcode, 'M1 1AE');
  assert.ok(Math.abs(row.pickup_lat - 53.48) < 0.01);
  // ROUTE_VALIDATED audit written.
  const audit = await pool.query(
    `SELECT 1 FROM compliance_audit_log WHERE parcel_id=$1 AND event_type='ROUTE_VALIDATED'`, [parcel.id]);
  assert.equal(audit.rowCount, 1);
});

test('POST /parcels rejects a non-GB postcode', async () => {
  const res = await app.inject({
    method: 'POST', url: '/parcels',
    headers: { authorization: 'Bearer test-sender' },
    payload: parcelPayload({ dropoff: { postcode: 'JE2 3AB', address_line: 'Jersey' } }),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, 'invalid_address');
  assert.equal(res.json().dropoff, 'not_gb');
});

test('POST /parcels rejects declared value over the cap', async () => {
  const res = await app.inject({
    method: 'POST', url: '/parcels',
    headers: { authorization: 'Bearer test-sender' },
    payload: parcelPayload({ declared_value_pennies: 999999 }),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, 'declared_value_over_cap');
});

test('POST /parcels rejects a prohibited category', async () => {
  const res = await app.inject({
    method: 'POST', url: '/parcels',
    headers: { authorization: 'Bearer test-sender' },
    payload: parcelPayload({ category: 'weapons' }),
  });
  assert.equal(res.statusCode, 400);
  assert.equal(res.json().error, 'prohibited_category');
});

// ---- Trip route + frequency throttle (PBD-12) ----------------------------

test('POST /trips creates a trip + ledger, and throttles past the weekly limit', async () => {
  // Fresh traveller to isolate the weekly counter.
  await pool.query(
    `INSERT INTO users (firebase_uid, phone, kyc_status, is_traveler)
     VALUES ('freq-traveler','+440000000010','verified',true)
     ON CONFLICT (firebase_uid) DO UPDATE SET kyc_status='verified'`,
  );
  const body = {
    corridor_id: corridorId, direction: 'outbound', transport_mode: 'train',
    depart_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    journey_cost_pennies: 4000, journey_cost_source: 'api_estimate',
  };
  // Default cap is 3 trips/week.
  for (let i = 0; i < 3; i++) {
    const ok = await app.inject({
      method: 'POST', url: '/trips',
      headers: { authorization: 'Bearer freq-traveler' }, payload: body,
    });
    assert.equal(ok.statusCode, 201, ok.body);
  }
  const blocked = await app.inject({
    method: 'POST', url: '/trips',
    headers: { authorization: 'Bearer freq-traveler' }, payload: body,
  });
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.json().error, 'frequency_limit');
});

// ---- Booking lifecycle + cancel (PBD-25) ---------------------------------

async function makeBooking(tripId: string, contribution = 2000): Promise<string> {
  const parcel = await app.inject({
    method: 'POST', url: '/parcels',
    headers: { authorization: 'Bearer test-sender' },
    payload: parcelPayload({ max_contribution_pennies: contribution }),
  });
  const parcelId = parcel.json().id as string;
  const bid = await app.inject({
    method: 'POST', url: `/parcels/${parcelId}/bids`,
    headers: { authorization: 'Bearer test-traveler' },
    payload: { trip_id: tripId, bid_contribution_pennies: contribution },
  });
  const bidId = bid.json().id as string;
  const accept = await app.inject({
    method: 'POST', url: `/bids/${bidId}/accept`,
    headers: { authorization: 'Bearer test-sender' },
  });
  assert.equal(accept.statusCode, 201, accept.body);
  return accept.json().booking_id as string;
}

test('GET /bookings/:id is participant-only', async () => {
  const tripId = await seedTripWithCap(5000);
  const bookingId = await makeBooking(tripId);

  const asSender = await app.inject({
    method: 'GET', url: `/bookings/${bookingId}`,
    headers: { authorization: 'Bearer test-sender' },
  });
  assert.equal(asSender.statusCode, 200);
  assert.equal(asSender.json().status, 'claimed');

  const asOutsider = await app.inject({
    method: 'GET', url: `/bookings/${bookingId}`,
    headers: { authorization: 'Bearer test-outsider' },
  });
  assert.equal(asOutsider.statusCode, 403);
});

test('cancelling a booking releases the reserved capacity back to the ledger', async () => {
  const tripId = await seedTripWithCap(5000);
  const bookingId = await makeBooking(tripId, 2000);

  // £20 committed after the booking.
  let committed = (await pool.query(
    'SELECT committed_pennies FROM trip_capacity_ledger WHERE trip_id=$1', [tripId])).rows[0].committed_pennies;
  assert.equal(committed, 2000);

  const cancel = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/cancel`,
    headers: { authorization: 'Bearer test-traveler' },
  });
  assert.equal(cancel.statusCode, 200, cancel.body);
  assert.equal(cancel.json().status, 'cancelled');

  // Capacity returned to 0; booking + parcel cancelled.
  committed = (await pool.query(
    'SELECT committed_pennies FROM trip_capacity_ledger WHERE trip_id=$1', [tripId])).rows[0].committed_pennies;
  assert.equal(committed, 0);
  const b = (await pool.query('SELECT status FROM bookings WHERE id=$1', [bookingId])).rows[0];
  assert.equal(b.status, 'cancelled');
});

test('cancelling an already-cancelled booking is rejected (illegal transition)', async () => {
  const tripId = await seedTripWithCap(5000);
  const bookingId = await makeBooking(tripId);
  await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/cancel`,
    headers: { authorization: 'Bearer test-sender' },
  });
  const again = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/cancel`,
    headers: { authorization: 'Bearer test-sender' },
  });
  assert.equal(again.statusCode, 409);
  assert.equal(again.json().error, 'not_cancellable');
});

// ---- Price suggestion (PBD-24) -------------------------------------------

test('GET /price-suggestion returns a capped suggestion', async () => {
  const res = await app.inject({
    method: 'GET', url: '/price-suggestion?size_band=M&distance_km=260',
    headers: { authorization: 'Bearer test-sender' },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.size_band, 'M');
  assert.equal(body.distance_km, 260);
  // M base 400 + 260km*8 = 2480, under the £50 ceiling.
  assert.equal(body.suggested_contribution_pennies, 2480);
});

test('GET /price-suggestion never exceeds the configured ceiling', async () => {
  const res = await app.inject({
    method: 'GET', url: '/price-suggestion?size_band=L&distance_km=100000',
    headers: { authorization: 'Bearer test-sender' },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.json().suggested_contribution_pennies, 5000); // clamped to £50
});

// ---- Compliance exports (PBD-18) -----------------------------------------

test('compliance exports are admin-only', async () => {
  const denied = await app.inject({
    method: 'GET', url: '/compliance/export/hmrc',
    headers: { authorization: 'Bearer test-outsider' },
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().error, 'admin_required');
});

test('HMRC export aggregates contributions + proves cap enforcement', async () => {
  const res = await app.inject({
    method: 'GET', url: '/compliance/export/hmrc',
    headers: { authorization: 'Bearer test-admin' },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.report, 'hmrc_gross_contributions');
  assert.ok(Array.isArray(body.travellers));
  assert.ok(Number(body.cap_enforcement.cap_checks) > 0, 'cap checks should be recorded');
});

test('Home Office + insurer exports return their reports', async () => {
  const ho = await app.inject({
    method: 'GET', url: '/compliance/export/home-office',
    headers: { authorization: 'Bearer test-admin' },
  });
  assert.equal(ho.statusCode, 200);
  assert.equal(ho.json().report, 'home_office_student_visa');

  const ins = await app.inject({
    method: 'GET', url: '/compliance/export/insurer',
    headers: { authorization: 'Bearer test-admin' },
  });
  assert.equal(ins.statusCode, 200);
  assert.equal(ins.json().report, 'insurer_bookings');
  assert.ok(Array.isArray(ins.json().bookings));
});

// ---- Escrow / payments (PBD-27/29/30/31) ---------------------------------

test('traveller onboards to Connect and gets an onboarding link', async () => {
  const res = await app.inject({
    method: 'POST', url: '/connect/onboard',
    headers: { authorization: 'Bearer test-traveler' },
  });
  assert.equal(res.statusCode, 200, res.body);
  assert.match(res.json().stripe_connect_id, /^acct_test_/);
  assert.ok(res.json().onboarding_url);
  const stored = (await pool.query(
    `SELECT stripe_connect_id FROM users WHERE firebase_uid='test-traveler'`)).rows[0];
  assert.match(stored.stripe_connect_id, /^acct_test_/);
});

test('full escrow happy path: fund -> capture -> payout', async () => {
  const tripId = await seedTripWithCap(5000);
  const bookingId = await makeBooking(tripId, 2000);

  // Fund (authorize).
  const fund = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/fund`,
    headers: { authorization: 'Bearer test-sender' },
    payload: { with_insurance: true },
  });
  assert.equal(fund.statusCode, 201, fund.body);
  const charges = fund.json().charges;
  // contribution 2000 + 12% platform (240) + £1.50 escrow (150) + £1.99 insurance (199) = 2589
  assert.equal(charges.grossPennies, 2589);
  assert.equal(charges.travelerPayoutPennies, 2000);
  assert.ok(fund.json().client_secret);

  let payment = (await pool.query('SELECT state FROM payments WHERE booking_id=$1', [bookingId])).rows[0];
  assert.equal(payment.state, 'authorized');
  let booking = (await pool.query('SELECT status FROM bookings WHERE id=$1', [bookingId])).rows[0];
  assert.equal(booking.status, 'funded');

  // Capture (hold).
  const cap = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/capture`,
    headers: { authorization: 'Bearer test-admin' },
  });
  assert.equal(cap.statusCode, 200, cap.body);
  payment = (await pool.query('SELECT state FROM payments WHERE booking_id=$1', [bookingId])).rows[0];
  assert.equal(payment.state, 'captured');

  // Payout (transfer to traveller — onboarded in the previous test).
  const pay = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/payout`,
    headers: { authorization: 'Bearer test-admin' },
  });
  assert.equal(pay.statusCode, 200, pay.body);
  assert.match(pay.json().transfer_id, /^tr_/);
  payment = (await pool.query('SELECT state, stripe_transfer_id FROM payments WHERE booking_id=$1', [bookingId])).rows[0];
  assert.equal(payment.state, 'released');
  assert.match(payment.stripe_transfer_id, /^tr_/);
});

test('funding binds an embedded insurance policy + INSURANCE_BOUND audit', async () => {
  const tripId = await seedTripWithCap(5000);
  const bookingId = await makeBooking(tripId, 2000);
  await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/fund`,
    headers: { authorization: 'Bearer test-sender' }, payload: { with_insurance: true },
  });
  const policy = (await pool.query(
    'SELECT provider, cover_pennies, premium_charged_pennies, status FROM insurance_policies WHERE booking_id=$1',
    [bookingId])).rows[0];
  assert.ok(policy, 'a policy should be bound');
  assert.equal(policy.status, 'active');
  assert.equal(policy.premium_charged_pennies, 199);
  const audit = await pool.query(
    `SELECT 1 FROM compliance_audit_log WHERE booking_id=$1 AND event_type='INSURANCE_BOUND'`, [bookingId]);
  assert.equal(audit.rowCount, 1);
});

test('double funding is rejected', async () => {
  const tripId = await seedTripWithCap(5000);
  const bookingId = await makeBooking(tripId, 1500);
  const first = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/fund`,
    headers: { authorization: 'Bearer test-sender' },
  });
  assert.equal(first.statusCode, 201);
  const second = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/fund`,
    headers: { authorization: 'Bearer test-sender' },
  });
  // The booking is now 'funded', so re-funding is rejected by the status guard.
  assert.equal(second.statusCode, 409);
  assert.equal(second.json().error, 'not_fundable');
});

test('refunding an authorized booking cancels the hold and releases capacity', async () => {
  const tripId = await seedTripWithCap(5000);
  const bookingId = await makeBooking(tripId, 2000);
  await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/fund`,
    headers: { authorization: 'Bearer test-sender' },
  });
  // £20 committed.
  let committed = (await pool.query(
    'SELECT committed_pennies FROM trip_capacity_ledger WHERE trip_id=$1', [tripId])).rows[0].committed_pennies;
  assert.equal(committed, 2000);

  const refund = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/refund`,
    headers: { authorization: 'Bearer test-admin' },
  });
  assert.equal(refund.statusCode, 200, refund.body);

  const payment = (await pool.query('SELECT state FROM payments WHERE booking_id=$1', [bookingId])).rows[0];
  assert.equal(payment.state, 'refunded');
  const booking = (await pool.query('SELECT status FROM bookings WHERE id=$1', [bookingId])).rows[0];
  assert.equal(booking.status, 'refunded');
  committed = (await pool.query(
    'SELECT committed_pennies FROM trip_capacity_ledger WHERE trip_id=$1', [tripId])).rows[0].committed_pennies;
  assert.equal(committed, 0);
});

// ---- Hand-off: open-box -> pickup(capture) -> dropoff(payout) (PBD-34/35/36) ----

async function fundBooking(bookingId: string) {
  const res = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/fund`,
    headers: { authorization: 'Bearer test-sender' },
  });
  assert.equal(res.statusCode, 201, res.body);
  return res.json().handoff_codes as { pickup_otp: string; dropoff_otp: string; pickup_qr: string };
}

test('full hand-off: open-box -> pickup captures -> dropoff pays out, then rate', async () => {
  // Ensure the traveller is a payout-ready Connect account.
  await pool.query(
    `UPDATE users SET stripe_connect_id='acct_test_handoff' WHERE firebase_uid='test-traveler'`);
  const tripId = await seedTripWithCap(5000);
  const bookingId = await makeBooking(tripId, 2000);
  const codes = await fundBooking(bookingId);

  // Open-box gate.
  const ob = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/open-box`,
    headers: { authorization: 'Bearer test-traveler' },
  });
  assert.equal(ob.statusCode, 200, ob.body);

  // Pickup: wrong code rejected, right code captures.
  const bad = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/pickup`,
    headers: { authorization: 'Bearer test-traveler' }, payload: { code: '000000' },
  });
  assert.equal(bad.statusCode, 401);
  const pick = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/pickup`,
    headers: { authorization: 'Bearer test-traveler' }, payload: { code: codes.pickup_otp },
  });
  assert.equal(pick.statusCode, 200, pick.body);
  assert.equal(pick.json().status, 'picked_up');
  let pay = (await pool.query('SELECT state FROM payments WHERE booking_id=$1', [bookingId])).rows[0];
  assert.equal(pay.state, 'captured');

  // Dropoff: pays out + releases.
  const drop = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/dropoff`,
    headers: { authorization: 'Bearer test-traveler' }, payload: { code: codes.dropoff_otp },
  });
  assert.equal(drop.statusCode, 200, drop.body);
  assert.equal(drop.json().status, 'released');
  assert.match(drop.json().transfer_id, /^tr_/);
  pay = (await pool.query('SELECT state FROM payments WHERE booking_id=$1', [bookingId])).rows[0];
  assert.equal(pay.state, 'released');
  const bk = (await pool.query('SELECT status FROM bookings WHERE id=$1', [bookingId])).rows[0];
  assert.equal(bk.status, 'released');

  // Sender rates the traveller -> trust score updates.
  const rate = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/reviews`,
    headers: { authorization: 'Bearer test-sender' }, payload: { stars: 5, comment: 'Smooth!' },
  });
  assert.equal(rate.statusCode, 201, rate.body);
  const trav = (await pool.query(
    `SELECT trust_score, rating_count FROM users WHERE firebase_uid='test-traveler'`)).rows[0];
  assert.equal(Number(trav.trust_score), 5);
  assert.ok(Number(trav.rating_count) >= 1);
});

test('pickup is blocked without an open-box inspection', async () => {
  const tripId = await seedTripWithCap(5000);
  const bookingId = await makeBooking(tripId, 1800);
  const codes = await fundBooking(bookingId);
  const pick = await app.inject({
    method: 'POST', url: `/bookings/${bookingId}/pickup`,
    headers: { authorization: 'Bearer test-traveler' }, payload: { code: codes.pickup_otp },
  });
  assert.equal(pick.statusCode, 409);
  assert.equal(pick.json().error, 'open_box_required');
});

// ---- KYC via Stripe Identity (PBD-28) ------------------------------------

test('KYC: start a session then the webhook flips kyc_status to verified', async () => {
  await pool.query(
    `INSERT INTO users (firebase_uid, phone, kyc_status)
     VALUES ('kyc-user','+440000000020','unverified')
     ON CONFLICT (firebase_uid) DO UPDATE SET kyc_status='unverified', kyc_session_id=NULL`,
  );
  const start = await app.inject({
    method: 'POST', url: '/kyc/start', headers: { authorization: 'Bearer kyc-user' },
  });
  assert.equal(start.statusCode, 200, start.body);
  assert.equal(start.json().kyc_status, 'pending');
  const sessionId = start.json().session_id;
  assert.match(sessionId, /^vs_/);

  // Simulate Stripe's verified webhook.
  const hook = await app.inject({
    method: 'POST', url: '/stripe/webhook',
    headers: { 'content-type': 'application/json' },
    payload: JSON.stringify({
      type: 'identity.verification_session.verified',
      data: { object: { id: sessionId, status: 'verified' } },
    }),
  });
  assert.equal(hook.statusCode, 200);
  const u = (await pool.query(`SELECT kyc_status FROM users WHERE firebase_uid='kyc-user'`)).rows[0];
  assert.equal(u.kyc_status, 'verified');
});

// ---- Reconciliation (PBD-32) ---------------------------------------------

test('reconciliation reports by-state totals, revenue, and consistency checks', async () => {
  const res = await app.inject({
    method: 'GET', url: '/payments/reconciliation',
    headers: { authorization: 'Bearer test-admin' },
  });
  assert.equal(res.statusCode, 200, res.body);
  const body = res.json();
  assert.equal(body.report, 'payments_reconciliation');
  assert.ok(Array.isArray(body.by_state) && body.by_state.length > 0);
  assert.ok('platform_revenue_pennies' in body.revenue);
  assert.ok('travellers_paid_pennies' in body.revenue);
  assert.ok(Array.isArray(body.inconsistencies));
  assert.equal(typeof body.healthy, 'boolean');
  // A booking taken through the FULL hand-off flow is consistent (released/released);
  // it must never appear as an inconsistency.
  const handoff = await app.inject({
    method: 'GET', url: '/payments/reconciliation', headers: { authorization: 'Bearer test-admin' },
  });
  const releasedConsistent = (await pool.query(
    `SELECT b.id FROM bookings b JOIN payments p ON p.booking_id=b.id
      WHERE b.status='released' AND p.state='released' LIMIT 1`)).rows[0];
  if (releasedConsistent) {
    const flagged = handoff.json().inconsistencies.some((i: { booking_id: string }) => i.booking_id === releasedConsistent.id);
    assert.equal(flagged, false);
  }
});

test('reconciliation is admin-only', async () => {
  const res = await app.inject({
    method: 'GET', url: '/payments/reconciliation',
    headers: { authorization: 'Bearer test-outsider' },
  });
  assert.equal(res.statusCode, 403);
});

// ---- User provisioning (PBD-59) ------------------------------------------

test('POST /users/me provisions the user from the token, unblocking authed calls', async () => {
  // A brand-new (unprovisioned) uid is rejected by an authenticated endpoint.
  const denied = await app.inject({
    method: 'GET', url: '/corridors', headers: { authorization: 'Bearer brand-new-uid' },
  });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.json().error, 'user_not_provisioned');

  // Provision (dev-bypass has no phone claim, so supply one).
  const prov = await app.inject({
    method: 'POST', url: '/users/me', headers: { authorization: 'Bearer brand-new-uid' },
    payload: { phone: '+447100000001', full_name: 'New User' },
  });
  assert.equal(prov.statusCode, 200, prov.body);
  assert.equal(prov.json().firebase_uid, 'brand-new-uid');

  // Now authenticated calls succeed.
  const ok = await app.inject({
    method: 'GET', url: '/corridors', headers: { authorization: 'Bearer brand-new-uid' },
  });
  assert.equal(ok.statusCode, 200);

  // GET /users/me returns the profile; provisioning is idempotent.
  const me = await app.inject({
    method: 'GET', url: '/users/me', headers: { authorization: 'Bearer brand-new-uid' },
  });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().firebase_uid, 'brand-new-uid');
});

test('POST /users/me without any phone is rejected', async () => {
  const r = await app.inject({
    method: 'POST', url: '/users/me', headers: { authorization: 'Bearer no-phone-uid' }, payload: {},
  });
  assert.equal(r.statusCode, 400);
  assert.equal(r.json().error, 'phone_required');
});

// ---- Sender flow read endpoints (PBD-46) ---------------------------------

test('sender lists their parcels with bid counts and views bids; non-owner blocked', async () => {
  const tripId = await seedTripWithCap(5000);
  const parcel = await app.inject({
    method: 'POST', url: '/parcels',
    headers: { authorization: 'Bearer test-sender' },
    payload: parcelPayload({ title: 'Sender-flow parcel', max_contribution_pennies: 2000 }),
  });
  const parcelId = parcel.json().id as string;
  await app.inject({
    method: 'POST', url: `/parcels/${parcelId}/bids`,
    headers: { authorization: 'Bearer test-traveler' },
    payload: { trip_id: tripId, bid_contribution_pennies: 2000 },
  });

  // Sender sees their parcel with a pending bid.
  const list = await app.inject({
    method: 'GET', url: '/parcels', headers: { authorization: 'Bearer test-sender' },
  });
  assert.equal(list.statusCode, 200);
  const mine = list.json().parcels.find((p: { id: string }) => p.id === parcelId);
  assert.ok(mine, 'posted parcel should be listed');
  assert.equal(Number(mine.pending_bids), 1);

  // Sender views the bids.
  const bids = await app.inject({
    method: 'GET', url: `/parcels/${parcelId}/bids`, headers: { authorization: 'Bearer test-sender' },
  });
  assert.equal(bids.statusCode, 200);
  assert.equal(bids.json().bids.length, 1);
  assert.equal(bids.json().bids[0].bid_contribution_pennies, 2000);

  // A non-owner cannot view them.
  const denied = await app.inject({
    method: 'GET', url: `/parcels/${parcelId}/bids`, headers: { authorization: 'Bearer test-outsider' },
  });
  assert.equal(denied.statusCode, 403);
});

// ---- Traveller flow read endpoints (PBD-47) ------------------------------

test('traveller lists their trips with remaining cap headroom', async () => {
  await seedTripWithCap(5000);
  const res = await app.inject({
    method: 'GET', url: '/trips', headers: { authorization: 'Bearer test-traveler' },
  });
  assert.equal(res.statusCode, 200);
  assert.ok(res.json().trips.length > 0);
  assert.ok('remaining_pennies' in res.json().trips[0]);
});

test('GET /bookings returns the user\'s bookings with role flags', async () => {
  const tripId = await seedTripWithCap(5000);
  const bookingId = await makeBooking(tripId, 2000);
  // Traveller sees it as a job (is_traveler).
  const asTrav = await app.inject({
    method: 'GET', url: '/bookings', headers: { authorization: 'Bearer test-traveler' },
  });
  assert.equal(asTrav.statusCode, 200);
  const job = asTrav.json().bookings.find((b: { id: string }) => b.id === bookingId);
  assert.ok(job);
  assert.equal(job.is_traveler, true);
  // Sender sees it as a send (is_sender).
  const asSender = await app.inject({
    method: 'GET', url: '/bookings', headers: { authorization: 'Bearer test-sender' },
  });
  const send = asSender.json().bookings.find((b: { id: string }) => b.id === bookingId);
  assert.ok(send);
  assert.equal(send.is_sender, true);
});
