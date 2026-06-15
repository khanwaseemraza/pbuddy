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

before(async () => {
  tpg = await startTestPg();
  process.env.DATABASE_URL = tpg.connectionString;
  process.env.AUTH_DEV_BYPASS = '1';
  ({ pool } = await import('../src/db.ts'));
  ({ reserveCapacity } = await import('../src/services/caps.ts'));
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
