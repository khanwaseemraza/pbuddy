// Pure unit tests for the price-suggestion helper (no DB/network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveSizeBand, suggestContribution } from '../src/services/pricing.ts';

test('deriveSizeBand buckets by largest dimension', () => {
  assert.equal(deriveSizeBand(20), 'S');
  assert.equal(deriveSizeBand(30), 'S');
  assert.equal(deriveSizeBand(45), 'M');
  assert.equal(deriveSizeBand(60), 'M');
  assert.equal(deriveSizeBand(80), 'L');
});

test('suggestContribution = size base + per-km, rounded', () => {
  // M base 400 + 100km*8 = 1200
  assert.equal(suggestContribution('M', 100), 1200);
  // S base 200 + 0km = 200
  assert.equal(suggestContribution('S', 0), 200);
});

test('suggestContribution is clamped to the ceiling', () => {
  assert.equal(suggestContribution('L', 100000), 5000); // global £50 ceiling
  // Caller-supplied tighter ceiling wins.
  assert.equal(suggestContribution('M', 1000, 1500), 1500);
});
