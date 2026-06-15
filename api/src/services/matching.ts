// Matching engine: candidate generation (hard filters) + ranking. No ML for the
// MVP — a SQL query plus a scoring pass. Proximity uses the real lat/lng we
// capture on parcels and (via the trip's corridor) the journey endpoints.
import { pool } from '../db.ts';

const EARTH_KM = 6371;

/** Great-circle distance in km between two lat/lng points. */
export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(h));
}

export interface ParcelCandidate {
  parcel_id: string;
  title: string;
  contribution_ref_pennies: number; // suggested (fixed) or max (auction)
  pricing_mode: 'fixed' | 'auction';
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  piece_count: number;
  sender_trust: number;
}

export interface RankedCandidate extends ParcelCandidate {
  detour_km: number;
  score: number;
}

/**
 * Find parcels a given trip could carry. Hard filters (all must pass):
 *  - same corridor + direction
 *  - parcel still listed, not the traveller's own
 *  - sender KYC-verified
 *  - parcel pickup window overlaps the trip departure (± window)
 *  - the trip's remaining cap can still afford the parcel's reference contribution
 *  - luggage fits remaining piece capacity
 */
export async function candidatesForTrip(tripId: string): Promise<ParcelCandidate[]> {
  const { rows } = await pool.query<ParcelCandidate>(
    `
    SELECT p.id AS parcel_id,
           p.title,
           COALESCE(p.suggested_contribution_pennies, p.max_contribution_pennies)
               AS contribution_ref_pennies,
           p.pricing_mode,
           p.pickup_lat, p.pickup_lng, p.dropoff_lat, p.dropoff_lng,
           p.piece_count,
           s.trust_score AS sender_trust
      FROM trips t
      JOIN trip_capacity_ledger l ON l.trip_id = t.id
      JOIN parcels p
        ON p.corridor_id = t.corridor_id
       AND p.direction   = t.direction
       AND p.status      = 'listed'
       AND p.sender_id  <> t.traveler_id
      JOIN users s ON s.id = p.sender_id AND s.kyc_status = 'verified'
     WHERE t.id = $1
       AND p.pickup_window_start <= t.depart_at + interval '12 hours'
       AND p.pickup_window_end   >= t.depart_at - interval '12 hours'
       AND COALESCE(p.suggested_contribution_pennies, p.max_contribution_pennies)
             <= l.remaining_pennies
       AND p.piece_count <= (t.capacity_pieces - l.committed_pieces)
    `,
    [tripId],
  );
  return rows;
}

/**
 * Rank candidates for a traveller: prefer higher contribution, lower detour, and
 * more trustworthy senders. Detour is the extra distance pickup->dropoff implies
 * relative to a straight corridor leg (a simple, explainable proxy for the MVP).
 */
export function rankForTraveler(candidates: ParcelCandidate[]): RankedCandidate[] {
  const maxContribution = Math.max(1, ...candidates.map((c) => c.contribution_ref_pennies));
  return candidates
    .map((c) => {
      const detour_km = haversineKm(c.pickup_lat, c.pickup_lng, c.dropoff_lat, c.dropoff_lng);
      const contributionScore = c.contribution_ref_pennies / maxContribution; // 0..1
      const proximityScore = 1 / (1 + detour_km / 50); // closer => higher
      const trustScore = Math.min(1, c.sender_trust / 5); // 0..1 assuming 5-star
      const score = 0.5 * contributionScore + 0.3 * proximityScore + 0.2 * trustScore;
      return { ...c, detour_km, score };
    })
    .sort((a, b) => b.score - a.score);
}
