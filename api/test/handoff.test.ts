// Pure unit tests for hand-off code generation + verification (no DB).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLegCode, hashOtp, verifyCode } from '../src/services/handoff.ts';

test('generateLegCode produces a QR token and a hashed 6-digit OTP', () => {
  const c = generateLegCode('booking-1');
  assert.match(c.qrToken, /^[0-9a-f]{48}$/);
  assert.match(c.otp, /^\d{6}$/);
  assert.equal(c.otpHash, hashOtp(c.otp, 'booking-1'));
});

test('verifyCode accepts the QR token', () => {
  const c = generateLegCode('b');
  assert.equal(verifyCode(c.qrToken, { qrToken: c.qrToken, otpHash: c.otpHash }, 'b'), true);
});

test('verifyCode accepts the correct OTP (by salted hash)', () => {
  const c = generateLegCode('b');
  assert.equal(verifyCode(c.otp, { qrToken: c.qrToken, otpHash: c.otpHash }, 'b'), true);
});

test('verifyCode rejects wrong / empty codes and a mismatched salt', () => {
  const c = generateLegCode('b');
  assert.equal(verifyCode('000000', { qrToken: c.qrToken, otpHash: c.otpHash }, 'b'), false);
  assert.equal(verifyCode('', { qrToken: c.qrToken, otpHash: c.otpHash }, 'b'), false);
  assert.equal(verifyCode(c.otp, { qrToken: c.qrToken, otpHash: c.otpHash }, 'other-booking'), false);
});
