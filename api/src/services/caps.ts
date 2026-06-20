// The Cost-Sharing Invariant, in code.
//
//   A traveller's cumulative accepted contributions on a given trip
//   <= their own verified journey cost,
//   AND the user stays within "incidental traveller" frequency bounds.
//
// This module holds the PURE decision functions (no I/O) so they can be unit
// tested exhaustively, plus the atomic DB enforcement used at bid-accept time.
import type { Tx } from '../db.ts';

export interface CapState {
  capPennies: number;
  committedPennies: number;
}

export interface CapDecision {
  allowed: boolean;
  reason?: 'cap_exceeded';
  capPennies: number;
  committedBefore: number;
  contribution: number;
  committedAfter: number;
  remainingBefore: number;
}

/**
 * Pure cap check. Casual Buddy is bounded by journey cost; this is the function
 * the auction ceiling is built on. A contribution that would push the trip's
 * committed total above the cap is rejected — the ceiling is the journey cost,
 * never "whatever the market will bear".
 */
export function evaluateCap(state: CapState, contributionPennies: number): CapDecision {
  const committedAfter = state.committedPennies + contributionPennies;
  const allowed = contributionPennies > 0 && committedAfter <= state.capPennies;
  return {
    allowed,
    reason: allowed ? undefined : 'cap_exceeded',
    capPennies: state.capPennies,
    committedBefore: state.committedPennies,
    contribution: contributionPennies,
    committedAfter,
    remainingBefore: state.capPennies - state.committedPennies,
  };
}

/**
 * Pro Buddy bypasses the per-trip cap, but ONLY when the legal gates are
 * satisfied. This keeps "no limits" lawful: uncapped earning requires a verified
 * Right to Work (and, for car drivers, hire & reward insurance).
 */
export interface ProGate {
  tier: 'casual_buddy' | 'pro_buddy';
  rtwStatus: 'not_started' | 'pending' | 'verified' | 'rejected';
  hireRewardPolicyId: string | null;
  transportMode: 'train' | 'bus' | 'coach' | 'car' | 'bike' | 'foot';
}

export function proBypassAllowed(gate: ProGate): boolean {
  if (gate.tier !== 'pro_buddy') return false;
  if (gate.rtwStatus !== 'verified') return false;
  if (gate.transportMode === 'car' && !gate.hireRewardPolicyId) return false;
  return true;
}

/**
 * Atomically reserve `contributionPennies` of capacity on a trip's ledger,
 * inside the caller's transaction. Row-locks the ledger so concurrent accepts on
 * the same trip serialize. Returns the decision; on success the ledger is
 * already updated (the DB CHECK constraint is the final backstop).
 *
 * For Pro Buddy with the gates satisfied, capacity is still recorded for the
 * audit trail but the cap is not enforced (committed may exceed cap is NOT
 * allowed by the constraint, so Pro trips are created with an effectively
 * unbounded cap — see trips.journey_cost handling for Pro).
 */
export async function reserveCapacity(
  tx: Tx,
  tripId: string,
  contributionPennies: number,
  pieces: number,
): Promise<CapDecision> {
  const { rows } = await tx.query<{ cap_pennies: number; committed_pennies: number }>(
    `SELECT cap_pennies, committed_pennies
       FROM trip_capacity_ledger
      WHERE trip_id = $1
      FOR UPDATE`,
    [tripId],
  );
  const ledger = rows[0];
  if (!ledger) {
    throw new Error(`no_ledger_for_trip:${tripId}`);
  }
  const decision = evaluateCap(
    { capPennies: ledger.cap_pennies, committedPennies: ledger.committed_pennies },
    contributionPennies,
  );
  if (!decision.allowed) return decision;

  await tx.query(
    `UPDATE trip_capacity_ledger
        SET committed_pennies = committed_pennies + $2,
            committed_pieces  = committed_pieces + $3,
            updated_at = now()
      WHERE trip_id = $1`,
    [tripId, contributionPennies, pieces],
  );
  return decision;
}

/** Release reserved capacity (e.g. on booking cancellation). */
export async function releaseCapacity(
  tx: Tx,
  tripId: string,
  contributionPennies: number,
  pieces: number,
): Promise<void> {
  await tx.query(
    `UPDATE trip_capacity_ledger
        SET committed_pennies = GREATEST(0, committed_pennies - $2),
            committed_pieces  = GREATEST(0, committed_pieces - $3),
            updated_at = now()
      WHERE trip_id = $1`,
    [tripId, contributionPennies, pieces],
  );
}
