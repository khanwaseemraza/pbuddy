// Booking lifecycle state machine. Transitions are enforced server-side so a
// booking can only move along legal paths (e.g. you cannot release escrow on a
// booking that was never picked up). Pure + exhaustive so it can be unit tested.
export type BookingStatus =
  | 'claimed'
  | 'funded'
  | 'picked_up'
  | 'delivered'
  | 'released'
  | 'refunded'
  | 'disputed'
  | 'cancelled';

// Allowed forward transitions. Terminal states map to [].
const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  claimed: ['funded', 'cancelled'],
  funded: ['picked_up', 'refunded', 'disputed', 'cancelled'],
  picked_up: ['delivered', 'disputed'],
  delivered: ['released', 'disputed'],
  disputed: ['released', 'refunded'],
  released: [],
  refunded: [],
  cancelled: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStates(from: BookingStatus): BookingStatus[] {
  return TRANSITIONS[from] ?? [];
}

export function isTerminal(status: BookingStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}

/** States in which a booking may still be cancelled (pre-hand-off). */
export function isCancellable(status: BookingStatus): boolean {
  return canTransition(status, 'cancelled');
}
