// Rate limiting (PBD-63). node --test isolates each test file in its own
// process, so the low RATE_LIMIT_MAX set here does NOT affect the rest of the
// suite. /healthz is DB-free, so this test needs no Postgres.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.RATE_LIMIT_MAX = '3';
process.env.RATE_LIMIT_WINDOW_MS = '60000';
process.env.DISABLE_FIRESTORE_MIRROR = '1';

let app: import('fastify').FastifyInstance;

before(async () => {
  const { buildServer } = await import('../src/server.ts');
  app = buildServer();
  await app.ready();
});

after(async () => {
  await app?.close();
});

test('rate limiter: 429 with Retry-After once a caller exceeds the limit', async () => {
  const hit = () =>
    app.inject({ method: 'GET', url: '/healthz', headers: { authorization: 'Bearer probe-a' } });

  for (let i = 0; i < 3; i++) {
    const ok = await hit();
    assert.equal(ok.statusCode, 200, `request ${i + 1} should pass`);
  }
  const blocked = await hit();
  assert.equal(blocked.statusCode, 429);
  assert.equal(blocked.json().error, 'rate_limited');
  assert.ok(blocked.headers['retry-after'] !== undefined, 'sets a Retry-After header');
});

test('rate limiter: each caller has an independent bucket', async () => {
  // probe-a is now throttled, but a different bearer starts fresh.
  const res = await app.inject({
    method: 'GET', url: '/healthz', headers: { authorization: 'Bearer probe-b' },
  });
  assert.equal(res.statusCode, 200);
});
