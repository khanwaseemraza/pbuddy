// Best-effort push notifications (PBD-72) over FCM. Postgres remains the source
// of truth and the Firestore mirror (lib/mirror.ts) drives live in-app updates;
// push is the out-of-app nudge on key booking transitions. Failures (no
// credentials locally, stale tokens) are swallowed so push never breaks the
// request path. A test seam (setMessagingForTests) injects a fake.
import { config } from '../config.ts';
import { pool } from '../db.ts';
import type { BookingStatus } from '../services/bookingLifecycle.ts';

// Minimal slice of firebase-admin Messaging we use (and the shape a fake mimics).
export interface MessagingLike {
  sendEachForMulticast(message: {
    tokens: string[];
    notification: { title: string; body: string };
    data?: Record<string, string>;
  }): Promise<{ successCount: number; failureCount: number }>;
}

let real: MessagingLike | null = null;
let fake: MessagingLike | null = null;
let disabled = false;

export function setMessagingForTests(client: MessagingLike | null): void {
  fake = client;
  disabled = false;
}

async function getMessaging(): Promise<MessagingLike | null> {
  if (fake) return fake;
  if (disabled || config.disablePush) return null;
  if (real) return real;
  try {
    const { initializeApp, getApps, applicationDefault } = await import('firebase-admin/app');
    const { getMessaging: _get } = await import('firebase-admin/messaging');
    if (getApps().length === 0) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    real = _get() as unknown as MessagingLike;
    return real;
  } catch {
    disabled = true; // no credentials — stop trying
    return null;
  }
}

// Who hears about each transition, and what they see. 'both' = sender + traveller.
type Audience = 'sender' | 'traveler' | 'both';
const NOTIFY: Partial<Record<BookingStatus, { to: Audience; title: string; body: string }>> = {
  funded: { to: 'traveler', title: 'Parcel funded', body: 'A sender funded a booking — it’s ready for pickup.' },
  picked_up: { to: 'sender', title: 'Parcel picked up', body: 'Your parcel is on its way.' },
  delivered: { to: 'sender', title: 'Parcel delivered', body: 'Your parcel was delivered. Please confirm and rate.' },
  released: { to: 'traveler', title: 'Contribution released', body: 'Your travel-cost contribution has been released.' },
  disputed: { to: 'both', title: 'Booking disputed', body: 'A dispute was opened on your booking. We’ll be in touch.' },
  refunded: { to: 'both', title: 'Booking refunded', body: 'This booking was refunded and the hold released.' },
  cancelled: { to: 'both', title: 'Booking cancelled', body: 'This booking was cancelled.' },
};

/** Register (or refresh) a device's push token for a user. */
export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web',
): Promise<void> {
  await pool.query(
    `INSERT INTO device_tokens (user_id, token, platform)
     VALUES ($1, $2, $3)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id,
                                       platform = EXCLUDED.platform,
                                       updated_at = now()`,
    [userId, token, platform],
  );
}

/**
 * Send a push for a booking's CURRENT status to the relevant participant(s).
 * Best-effort: returns the number of devices messaged (0 if none / disabled).
 */
export async function sendBookingPush(bookingId: string): Promise<number> {
  if (config.disablePush) return 0;
  try {
    const { rows } = await pool.query(
      `SELECT status, sender_id, traveler_id FROM bookings WHERE id = $1`,
      [bookingId],
    );
    const b = rows[0];
    if (!b) return 0;
    const spec = NOTIFY[b.status as BookingStatus];
    if (!spec) return 0;

    const userIds =
      spec.to === 'both' ? [b.sender_id, b.traveler_id]
      : spec.to === 'sender' ? [b.sender_id]
      : [b.traveler_id];

    const tok = await pool.query(
      `SELECT token FROM device_tokens WHERE user_id = ANY($1)`,
      [userIds],
    );
    const tokens = tok.rows.map((r) => r.token as string);
    if (tokens.length === 0) return 0;

    const messaging = await getMessaging();
    if (!messaging) return 0;

    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title: spec.title, body: spec.body },
      data: { booking_id: bookingId, status: b.status },
    });
    return res.successCount;
  } catch {
    return 0; // best-effort: never break the request path
  }
}
