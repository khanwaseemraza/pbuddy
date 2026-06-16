// Logging config (PBD-66): pino level -> Cloud Logging severity mapping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pinoSeverity, genReqId } from '../src/lib/logging.ts';

test('pinoSeverity maps pino levels to Cloud Logging severities', () => {
  assert.equal(pinoSeverity('info'), 'INFO');
  assert.equal(pinoSeverity('warn'), 'WARNING');
  assert.equal(pinoSeverity('error'), 'ERROR');
  assert.equal(pinoSeverity('fatal'), 'CRITICAL');
  assert.equal(pinoSeverity('debug'), 'DEBUG');
  assert.equal(pinoSeverity('unknown'), 'DEFAULT');
});

test('genReqId prefers the Cloud Trace id, falls back to a uuid', () => {
  const fromTrace = genReqId({ headers: { 'x-cloud-trace-context': 'abc123/456;o=1' } } as never);
  assert.equal(fromTrace, 'abc123');
  const fallback = genReqId({ headers: {} } as never);
  assert.match(fallback, /^[0-9a-f-]{36}$/);
});
