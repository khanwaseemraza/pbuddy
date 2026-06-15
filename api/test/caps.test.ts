// Pure unit tests for the Cost-Sharing Invariant decision functions. No DB
// needed — these run anywhere with `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCap, proBypassAllowed, type ProGate } from '../src/services/caps.ts';
import {
  evaluateFrequency,
  type FrequencyLimits,
  type FrequencyState,
} from '../src/services/frequency.ts';
import { haversineKm, rankForTraveler, type ParcelCandidate } from '../src/services/matching.ts';

test('evaluateCap allows a contribution at exactly the cap', () => {
  const d = evaluateCap({ capPennies: 5000, committedPennies: 0 }, 5000);
  assert.equal(d.allowed, true);
  assert.equal(d.committedAfter, 5000);
});

test('evaluateCap rejects a contribution one penny over the cap', () => {
  const d = evaluateCap({ capPennies: 5000, committedPennies: 0 }, 5001);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, 'cap_exceeded');
});

test('evaluateCap rejects when cumulative committed would breach the cap', () => {
  const d = evaluateCap({ capPennies: 5000, committedPennies: 3000 }, 2500);
  assert.equal(d.allowed, false);
  assert.equal(d.remainingBefore, 2000);
});

test('evaluateCap rejects non-positive contributions', () => {
  assert.equal(evaluateCap({ capPennies: 5000, committedPennies: 0 }, 0).allowed, false);
  assert.equal(evaluateCap({ capPennies: 5000, committedPennies: 0 }, -10).allowed, false);
});

test('proBypassAllowed: Casual never bypasses the cap', () => {
  const gate: ProGate = {
    tier: 'casual_buddy',
    rtwStatus: 'verified',
    hireRewardPolicyId: 'pol_1',
    transportMode: 'train',
  };
  assert.equal(proBypassAllowed(gate), false);
});

test('proBypassAllowed: Pro needs verified RTW', () => {
  const gate: ProGate = {
    tier: 'pro_buddy',
    rtwStatus: 'pending',
    hireRewardPolicyId: null,
    transportMode: 'train',
  };
  assert.equal(proBypassAllowed(gate), false);
});

test('proBypassAllowed: Pro by car needs hire & reward insurance', () => {
  const base: ProGate = {
    tier: 'pro_buddy',
    rtwStatus: 'verified',
    hireRewardPolicyId: null,
    transportMode: 'car',
  };
  assert.equal(proBypassAllowed(base), false);
  assert.equal(proBypassAllowed({ ...base, hireRewardPolicyId: 'pol_1' }), true);
});

test('proBypassAllowed: Pro on public transport with verified RTW bypasses', () => {
  const gate: ProGate = {
    tier: 'pro_buddy',
    rtwStatus: 'verified',
    hireRewardPolicyId: null,
    transportMode: 'train',
  };
  assert.equal(proBypassAllowed(gate), true);
});

const limits: FrequencyLimits = { maxPerWeekGlobal: 3, maxPerRouteWeek: 3, maxPerMonth: 8 };

test('evaluateFrequency allows under all limits', () => {
  const s: FrequencyState = { tripsThisWeekGlobal: 1, tripsThisWeekRoute: 1, tripsThisMonth: 2 };
  const d = evaluateFrequency(s, limits);
  assert.equal(d.allowed, true);
  assert.equal(d.upgradeSignal, false);
});

test('evaluateFrequency blocks at the weekly ceiling and flags an upgrade signal', () => {
  const s: FrequencyState = { tripsThisWeekGlobal: 3, tripsThisWeekRoute: 1, tripsThisMonth: 3 };
  const d = evaluateFrequency(s, limits);
  assert.equal(d.allowed, false);
  assert.equal(d.reason, 'week_global');
  assert.equal(d.upgradeSignal, true);
});

test('haversineKm: London->Manchester is roughly 260km', () => {
  const km = haversineKm(51.5074, -0.1278, 53.4808, -2.2426);
  assert.ok(km > 200 && km < 320, `expected ~260km, got ${km}`);
});

test('rankForTraveler ranks higher contribution + closer + more trusted first', () => {
  const candidates: ParcelCandidate[] = [
    {
      parcel_id: 'far-cheap',
      title: 'far',
      contribution_ref_pennies: 500,
      pricing_mode: 'fixed',
      pickup_lat: 51.5,
      pickup_lng: -0.12,
      dropoff_lat: 53.48,
      dropoff_lng: -2.24,
      piece_count: 1,
      sender_trust: 1,
    },
    {
      parcel_id: 'near-rich',
      title: 'near',
      contribution_ref_pennies: 2000,
      pricing_mode: 'fixed',
      pickup_lat: 51.5,
      pickup_lng: -0.12,
      dropoff_lat: 51.52,
      dropoff_lng: -0.1,
      piece_count: 1,
      sender_trust: 5,
    },
  ];
  const ranked = rankForTraveler(candidates);
  assert.equal(ranked[0]!.parcel_id, 'near-rich');
});
