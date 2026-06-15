// Integration tests for the firewall against a REAL Postgres. Gated on
// DATABASE_URL — skipped (not failed) when no DB is configured, so unit tests
// still run in CI without infrastructure.
//
//   DATABASE_URL=postgres://... npm --workspace api test
//
// Requires migrations 0001/0002 to be applied first (npm run db:migrate).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { reserveCapacity } from '../src/services/caps.ts';

const url = process.env.DATABASE_URL;
const dbTest = url ? test : test.skip;

let pool: pg.Pool;
const ids: { sender?: string; traveler?: string; corridor?: string } = {};

before(async () => {
  if (!url) return;
  pool = new pg.Pool({ connectionString: url });
});

after(async () => {
  if (!url) return;
  await pool.end();
});

async function seedTripWithCap(capPennies: number): Promise<string> {
  // Reuse-or-create the two users and a corridor.
  const sender = await pool.query(
    `INSERT INTO users (firebase_uid, phone, kyc_status)
     VALUES ('test-sender', '+440000000001', 'verified')
     ON CONFLICT (firebase_uid) DO UPDATE SET kyc_status = 'verified'
     RETURNING id`,
  );
  const traveler = await pool.query(
    `INSERT INTO users (firebase_uid, phone, kyc_status, is_traveler)
     VALUES ('test-traveler', '+440000000002', 'verified', true)
     ON CONFLICT (firebase_uid) DO UPDATE SET kyc_status = 'verified'
     RETURNING id`,
  );
  ids.sender = sender.rows[0].id;
  ids.traveler = traveler.rows[0].id;
  const corridor = await pool.query(
    `SELECT id FROM corridors WHERE origin_city='London' AND dest_city='Manchester'`,
  );
  ids.corridor = corridor.rows[0].id;

  const trip = await pool.query(
    `INSERT INTO trips (traveler_id, corridor_id, direction, transport_mode, depart_at,
                        journey_cost_pennies, journey_cost_source)
     VALUES ($1, $2, 'outbound', 'train', now() + interval '2 days', $3, 'api_estimate')
     RETURNING id`,
    [ids.traveler, ids.corridor, capPennies],
  );
  return trip.rows[0].id as string;
}

dbTest('ledger is auto-created with cap = journey cost', async () => {
  const tripId = await seedTripWithCap(5000);
  const { rows } = await pool.query(
    'SELECT cap_pennies, committed_pennies, remaining_pennies FROM trip_capacity_ledger WHERE trip_id = $1',
    [tripId],
  );
  assert.equal(rows[0].cap_pennies, 5000);
  assert.equal(rows[0].committed_pennies, 0);
  assert.equal(rows[0].remaining_pennies, 5000);
});

dbTest('reserveCapacity rejects a reservation over the cap', async () => {
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

dbTest('concurrent reservations cannot push committed over the cap', async () => {
  // Cap £50; two concurrent £30 reservations. Only one may succeed.
  const tripId = await seedTripWithCap(5000);

  async function attempt(amount: number): Promise<boolean> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const d = await reserveCapacity(client, tripId, amount, 1);
      if (!d.allowed) {
        await client.query('ROLLBACK');
        return false;
      }
      await client.query('COMMIT');
      return true;
    } catch {
      await client.query('ROLLBACK').catch(() => {});
      return false;
    } finally {
      client.release();
    }
  }

  const [a, b] = await Promise.all([attempt(3000), attempt(3000)]);
  assert.equal([a, b].filter(Boolean).length, 1, 'exactly one reservation should succeed');

  const { rows } = await pool.query(
    'SELECT committed_pennies FROM trip_capacity_ledger WHERE trip_id = $1',
    [tripId],
  );
  assert.ok(rows[0].committed_pennies <= 5000, 'committed must never exceed cap');
  assert.equal(rows[0].committed_pennies, 3000);
});

dbTest('the DB CHECK constraint is the final backstop against over-commit', async () => {
  const tripId = await seedTripWithCap(5000);
  await assert.rejects(
    pool.query(
      'UPDATE trip_capacity_ledger SET committed_pennies = 6000 WHERE trip_id = $1',
      [tripId],
    ),
    /committed_within_cap|check/i,
  );
});

dbTest('a student-visa user can never be Pro Buddy (DB constraint)', async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO users (firebase_uid, phone, immigration_class, tier, rtw_status)
       VALUES ('test-student-pro', '+440000000003', 'student_visa', 'pro_buddy', 'verified')`,
    ),
    /students_cannot_be_pro|check/i,
  );
});

dbTest('compliance_audit_log is append-only (no updates)', async () => {
  await pool.query(
    `INSERT INTO compliance_audit_log (event_type, payload) VALUES ('CAP_CHECK', '{"t":1}')`,
  );
  await assert.rejects(
    pool.query(`UPDATE compliance_audit_log SET event_type = 'x' WHERE event_type = 'CAP_CHECK'`),
    /append-only/i,
  );
});
