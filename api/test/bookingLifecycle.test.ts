// Pure unit tests for the booking lifecycle state machine (no DB).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canTransition,
  isCancellable,
  isTerminal,
  nextStates,
} from '../src/services/bookingLifecycle.ts';

test('legal forward transitions are allowed', () => {
  assert.equal(canTransition('claimed', 'funded'), true);
  assert.equal(canTransition('funded', 'picked_up'), true);
  assert.equal(canTransition('picked_up', 'delivered'), true);
  assert.equal(canTransition('delivered', 'released'), true);
});

test('illegal transitions are rejected', () => {
  assert.equal(canTransition('claimed', 'released'), false); // cannot skip the flow
  assert.equal(canTransition('delivered', 'funded'), false); // no going backwards
  assert.equal(canTransition('released', 'disputed'), false); // terminal
});

test('pre-hand-off states are cancellable; later ones are not', () => {
  assert.equal(isCancellable('claimed'), true);
  assert.equal(isCancellable('funded'), true);
  assert.equal(isCancellable('picked_up'), false);
  assert.equal(isCancellable('delivered'), false);
});

test('terminal states have no onward transitions', () => {
  for (const s of ['released', 'refunded', 'cancelled'] as const) {
    assert.equal(isTerminal(s), true);
    assert.deepEqual(nextStates(s), []);
  }
});

test('disputed can resolve to release or refund', () => {
  assert.deepEqual(nextStates('disputed').sort(), ['refunded', 'released']);
});
