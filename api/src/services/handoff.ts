// Hand-off codes. Each booking gets a QR token + a 6-digit OTP fallback per leg
// (pickup, dropoff). The QR token is a bearer string shown as a QR and scanned by
// the traveller; the OTP is for poor-signal hand-offs. OTPs are stored hashed
// (salted by booking id); QR tokens are stored as-is (they are the bearer secret).
import crypto from 'node:crypto';

export function hashOtp(otp: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${otp}`).digest('hex');
}

export interface LegCode {
  qrToken: string;
  otp: string;
  otpHash: string;
}

export function generateLegCode(salt: string): LegCode {
  const qrToken = crypto.randomBytes(24).toString('hex');
  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  return { qrToken, otp, otpHash: hashOtp(otp, salt) };
}

/** A submitted code verifies if it matches the QR token OR the OTP (by hash). */
export function verifyCode(
  submitted: string,
  stored: { qrToken: string | null; otpHash: string | null },
  salt: string,
): boolean {
  if (!submitted) return false;
  if (stored.qrToken && submitted === stored.qrToken) return true;
  if (stored.otpHash && hashOtp(submitted, salt) === stored.otpHash) return true;
  return false;
}
