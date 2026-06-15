// Trip-frequency throttle: keeps Casual Buddy users looking like incidental
// travellers, not couriers. Pure decision function + the persisted counters live
// in user_trip_counters. Pro Buddy (gates satisfied) is exempt.
export interface FrequencyState {
  tripsThisWeekGlobal: number;
  tripsThisWeekRoute: number;
  tripsThisMonth: number;
}

export interface FrequencyLimits {
  maxPerWeekGlobal: number;
  maxPerRouteWeek: number;
  maxPerMonth: number;
}

export interface FrequencyDecision {
  allowed: boolean;
  reason?: 'week_global' | 'week_route' | 'month';
  upgradeSignal: boolean; // hit the ceiling => candidate for Pro Buddy invite
}

export function evaluateFrequency(
  state: FrequencyState,
  limits: FrequencyLimits,
): FrequencyDecision {
  if (state.tripsThisWeekGlobal >= limits.maxPerWeekGlobal) {
    return { allowed: false, reason: 'week_global', upgradeSignal: true };
  }
  if (state.tripsThisWeekRoute >= limits.maxPerRouteWeek) {
    return { allowed: false, reason: 'week_route', upgradeSignal: true };
  }
  if (state.tripsThisMonth >= limits.maxPerMonth) {
    return { allowed: false, reason: 'month', upgradeSignal: true };
  }
  return { allowed: true, upgradeSignal: false };
}
