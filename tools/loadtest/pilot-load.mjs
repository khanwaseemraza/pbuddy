// Pilot-scale load test (PBD-69). Boots the API against an embedded Postgres and
// drives the hot paths in-process at concurrency, reporting latency percentiles
// and error rate against the SLOs. No k6/Docker needed:
//
//   node --experimental-strip-types tools/loadtest/pilot-load.mjs
//   VUS=100 DURATION_MS=30000 SLO_P95_MS=300 node --experimental-strip-types tools/loadtest/pilot-load.mjs
//
// In-process (app.inject) so it measures handler + DB + cap-logic latency — the
// real capacity driver — without network noise. Exits non-zero if an SLO is missed.
// NOTE: only import modules that do NOT pull in config here. Anything that reads
// process.env at import time (config/db/stripe/server) must be imported AFTER we
// set DATABASE_URL below, or it binds to an empty connection string.
import { performance } from 'node:perf_hooks';
import { startTestPg } from '../../api/test/_pg.ts';

const VUS = Number(process.env.VUS ?? 50);
const DURATION_MS = Number(process.env.DURATION_MS ?? 15000);
const SLO_P95_MS = Number(process.env.SLO_P95_MS ?? 300);
const SLO_ERROR_RATE = Number(process.env.SLO_ERROR_RATE ?? 0.01);

const tpg = await startTestPg();
process.env.DATABASE_URL = tpg.connectionString;
process.env.AUTH_DEV_BYPASS = '1';
process.env.DISABLE_FIRESTORE_MIRROR = '1';
process.env.RATE_LIMIT_DISABLED = '1';

const { pool } = await import('../../api/src/db.ts');
const { setStripeForTests } = await import('../../api/src/lib/stripe.ts');
const { buildServer } = await import('../../api/src/server.ts');
setStripeForTests({}); // no payment ops in this profile

const app = buildServer();
await app.ready();

await pool.query(
  `INSERT INTO users (firebase_uid, phone, kyc_status, is_sender, is_traveler)
   VALUES ('load-user','+440000009999','verified',true,true)
   ON CONFLICT (firebase_uid) DO UPDATE SET kyc_status='verified'`,
);

// Weighted mix of the highest-frequency endpoints: authenticated DB read, public
// read, and the provisioning upsert (a write).
const AUTH = { authorization: 'Bearer load-user' };
const ops = [
  { weight: 70, name: 'GET /corridors', run: () => app.inject({ method: 'GET', url: '/corridors', headers: AUTH }) },
  { weight: 20, name: 'GET /legal', run: () => app.inject({ method: 'GET', url: '/legal' }) },
  { weight: 10, name: 'POST /users/me', run: () => app.inject({ method: 'POST', url: '/users/me', headers: AUTH, payload: { phone: '+440000009999' } }) },
];
const bag = ops.flatMap((o) => Array(o.weight).fill(o));

const samples = [];
let errors = 0;
const deadline = performance.now() + DURATION_MS;

async function virtualUser() {
  while (performance.now() < deadline) {
    const op = bag[Math.floor(Math.random() * bag.length)];
    const t0 = performance.now();
    try {
      const res = await op.run();
      const dt = performance.now() - t0;
      samples.push(dt);
      if (res.statusCode >= 500) errors++;
    } catch {
      samples.push(performance.now() - t0);
      errors++;
    }
  }
}

console.log(`Load: ${VUS} VUs for ${DURATION_MS / 1000}s — SLO p95<${SLO_P95_MS}ms, errors<${SLO_ERROR_RATE * 100}%`);
const started = performance.now();
await Promise.all(Array.from({ length: VUS }, virtualUser));
const elapsed = (performance.now() - started) / 1000;

samples.sort((a, b) => a - b);
const pct = (p) => samples[Math.min(samples.length - 1, Math.floor((p / 100) * samples.length))] ?? 0;
const total = samples.length;
const errorRate = total ? errors / total : 1;
const rps = total / elapsed;

console.log(`\nrequests   ${total}  (${rps.toFixed(0)} req/s)`);
console.log(`errors     ${errors}  (${(errorRate * 100).toFixed(2)}%)`);
console.log(`p50        ${pct(50).toFixed(1)} ms`);
console.log(`p95        ${pct(95).toFixed(1)} ms`);
console.log(`p99        ${pct(99).toFixed(1)} ms`);
console.log(`max        ${pct(100).toFixed(1)} ms`);

await app.close();
await pool.end();
await tpg.stop();

const p95 = pct(95);
const pass = p95 <= SLO_P95_MS && errorRate <= SLO_ERROR_RATE;
console.log(`\nSLO: ${pass ? 'PASS ✅' : 'FAIL ❌'}  (p95 ${p95.toFixed(1)}ms / ${SLO_P95_MS}ms, errors ${(errorRate * 100).toFixed(2)}% / ${(SLO_ERROR_RATE * 100)}%)`);
process.exit(pass ? 0 : 1);
