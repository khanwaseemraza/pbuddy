// Price suggestion: a cold-start helper that anchors the sender's "contribution
// to the traveller's costs" before there's bidding liquidity. Pure + clamped so
// a suggestion can never exceed the configured ceiling (and downstream, a trip's
// actual journey-cost cap still bounds what any traveller may accept).
import { config } from '../config.ts';

export type SizeBand = 'S' | 'M' | 'L';

/** Derive a size band from the largest dimension (cm). Parcels are ≤ 100cm. */
export function deriveSizeBand(maxDimensionCm: number): SizeBand {
  if (maxDimensionCm <= 30) return 'S';
  if (maxDimensionCm <= 60) return 'M';
  return 'L';
}

/**
 * Suggested contribution in pence: a size base plus a per-km component, clamped
 * to the configured ceiling. `ceilingPennies` lets a caller tighten the clamp
 * further (e.g. to a known trip cap); defaults to the global ceiling.
 */
export function suggestContribution(
  sizeBand: SizeBand,
  distanceKm: number,
  ceilingPennies: number = config.maxSuggestedContributionPennies,
): number {
  const base = config.priceBase[sizeBand];
  const distance = Math.max(0, Math.round(distanceKm)) * config.pricePerKmPennies;
  const raw = base + distance;
  return Math.min(raw, ceilingPennies, config.maxSuggestedContributionPennies);
}
