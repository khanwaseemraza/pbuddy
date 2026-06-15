// Embedded parcel insurance. The sender is charged a small premium at funding
// (see computeBookingCharges); this binds a policy for the parcel's value. A stub
// provider is used for the pilot; the real Anansi integration goes behind a flag.
import crypto from 'node:crypto';
import { config } from '../config.ts';

export interface BoundPolicy {
  provider: string;
  policyRef: string;
  coverPennies: number;
  premiumCostPennies: number; // what PBuddy pays the insurer
  premiumChargedPennies: number; // what the sender paid
  termsVersion: string;
}

/** Bind cover for a booking. Stub for now — deterministic, no network. */
export function bindPolicy(params: { bookingId: string; coverPennies: number }): BoundPolicy {
  return {
    provider: 'stub',
    policyRef: `stub_${crypto.randomBytes(8).toString('hex')}`,
    coverPennies: params.coverPennies,
    premiumCostPennies: config.insuranceCostPennies,
    premiumChargedPennies: config.insurancePremiumPennies,
    termsVersion: 'v1',
  };
}
