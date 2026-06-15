// Pure unit tests for postcode format/normalisation (no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidPostcodeFormat, normalisePostcode } from '../src/lib/postcodes.ts';

test('isValidPostcodeFormat accepts well-formed UK postcodes', () => {
  for (const pc of ['M1 1AE', 'm1 1ae', 'SW1A 1AA', 'EC1A1BB', 'B33 8TH', 'CR2 6XH', 'DN55 1PT']) {
    assert.equal(isValidPostcodeFormat(pc), true, pc);
  }
});

test('isValidPostcodeFormat rejects garbage', () => {
  for (const pc of ['', 'NOTAPOSTCODE', '12345', 'ZZZ', 'M1']) {
    assert.equal(isValidPostcodeFormat(pc), false, pc);
  }
});

test('normalisePostcode upper-cases and inserts the single space', () => {
  assert.equal(normalisePostcode('m11ae'), 'M1 1AE');
  assert.equal(normalisePostcode('sw1a1aa'), 'SW1A 1AA');
  assert.equal(normalisePostcode('  ec1a 1bb '), 'EC1A 1BB');
});
