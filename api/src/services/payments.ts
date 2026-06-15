// Pure money math for a booking. The sender pays the traveller's contribution
// plus PBuddy's platform fee, the flat escrow fee, and (optionally) the insurance
// premium. The traveller is paid exactly the contribution — never more than their
// own journey cost, which the cap firewall already guaranteed upstream.
import { config } from '../config.ts';

export interface BookingCharges {
  contributionPennies: number;
  platformFeePennies: number;
  escrowFeePennies: number;
  insuranceCostPennies: number; // what the sender is charged for cover
  grossPennies: number; // total charged to the sender
  travelerPayoutPennies: number; // transferred to the traveller
}

export function computeBookingCharges(
  contributionPennies: number,
  opts: { withInsurance?: boolean } = {},
): BookingCharges {
  const platformFeePennies = Math.round((contributionPennies * config.platformFeeBps) / 10000);
  const escrowFeePennies = config.escrowFeePennies;
  const insuranceCostPennies = opts.withInsurance ? config.insurancePremiumPennies : 0;
  const grossPennies =
    contributionPennies + platformFeePennies + escrowFeePennies + insuranceCostPennies;
  return {
    contributionPennies,
    platformFeePennies,
    escrowFeePennies,
    insuranceCostPennies,
    grossPennies,
    travelerPayoutPennies: contributionPennies,
  };
}
