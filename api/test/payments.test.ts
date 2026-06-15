// Pure unit tests for booking charge math (no DB/Stripe).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBookingCharges } from '../src/services/payments.ts';

test('charges = contribution + 12% platform + £1.50 escrow + £1.99 insurance', () => {
  const c = computeBookingCharges(2000, { withInsurance: true });
  assert.equal(c.platformFeePennies, 240); // 12% of 2000
  assert.equal(c.escrowFeePennies, 150);
  assert.equal(c.insuranceCostPennies, 199);
  assert.equal(c.grossPennies, 2589);
  assert.equal(c.travelerPayoutPennies, 2000); // traveller gets exactly the contribution
});

test('insurance is omitted when not requested', () => {
  const c = computeBookingCharges(2000, { withInsurance: false });
  assert.equal(c.insuranceCostPennies, 0);
  assert.equal(c.grossPennies, 2390);
});

test('the traveller payout never exceeds the contribution (cap firewall holds downstream)', () => {
  for (const amt of [100, 999, 5000]) {
    assert.equal(computeBookingCharges(amt).travelerPayoutPennies, amt);
  }
});
