// Best-effort Firestore status mirror. Postgres is the source of truth; we mirror
// each booking's current status into a `booking_status/{bookingId}` doc so the
// client can subscribe for live updates. Writes are non-blocking and failures
// (e.g. no credentials locally) are swallowed — the mirror self-disables after a
// failed init so it never slows or breaks a request.
import { config } from '../config.ts';
import { pool } from '../db.ts';
import { sendBookingPush } from './push.ts';

let firestore: import('firebase-admin/firestore').Firestore | null = null;
let disabled = false;

async function getFirestore() {
  if (disabled || config.disableFirestoreMirror) return null;
  if (firestore) return firestore;
  try {
    const { initializeApp, getApps, applicationDefault } = await import('firebase-admin/app');
    const { getFirestore: _get } = await import('firebase-admin/firestore');
    if (getApps().length === 0) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    firestore = _get();
    return firestore;
  } catch {
    disabled = true; // no credentials / not configured — stop trying
    return null;
  }
}

/**
 * Mirror a booking's status to Firestore. Looks up the participant Firebase UIDs
 * so the security rules (participant-only read) can authorise. Best-effort.
 */
export async function mirrorBookingStatus(bookingId: string): Promise<void> {
  // Out-of-app push runs on every transition, independent of the Firestore
  // mirror flag (both are best-effort and never block the request path).
  void sendBookingPush(bookingId);
  if (config.disableFirestoreMirror) return;
  try {
    const fs = await getFirestore();
    if (!fs) return;
    const { rows } = await pool.query(
      `SELECT b.id, b.status, b.parcel_id, b.trip_id,
              s.firebase_uid AS sender_uid, t.firebase_uid AS traveler_uid
         FROM bookings b
         JOIN users s ON s.id = b.sender_id
         JOIN users t ON t.id = b.traveler_id
        WHERE b.id = $1`,
      [bookingId],
    );
    const b = rows[0];
    if (!b) return;
    await fs.collection('booking_status').doc(b.id).set(
      {
        status: b.status,
        parcel_id: b.parcel_id,
        trip_id: b.trip_id,
        sender_uid: b.sender_uid,
        traveler_uid: b.traveler_uid,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );
  } catch {
    // best-effort: never let the mirror break the request path
  }
}
