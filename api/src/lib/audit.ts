// Helper for writing to the append-only, hash-chained compliance_audit_log.
// Every legally-relevant decision goes through here so the evidence trail is
// uniform and queryable for HMRC / Home Office / insurer exports.
import type { Tx } from '../db.ts';
import { pool } from '../db.ts';

export type AuditEventType =
  | 'CAP_COMPUTED'
  | 'CAP_CHECK'
  | 'FREQUENCY_CHECK'
  | 'FRAMING_SHOWN'
  | 'STUDENT_ATTESTATION'
  | 'OPEN_BOX_CONFIRMED'
  | 'PROHIBITED_ITEMS_ATTESTED'
  | 'ROUTE_VALIDATED'
  | 'INSURANCE_BOUND'
  | 'TAX_DISCLOSURE_SHOWN'
  | 'TIER_TRANSITION';

export interface AuditEntry {
  eventType: AuditEventType;
  userId?: string;
  bookingId?: string;
  tripId?: string;
  parcelId?: string;
  payload?: Record<string, unknown>;
}

export async function writeAudit(entry: AuditEntry, tx?: Tx): Promise<void> {
  const runner = tx ?? pool;
  await runner.query(
    `INSERT INTO compliance_audit_log
       (event_type, user_id, booking_id, trip_id, parcel_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.eventType,
      entry.userId ?? null,
      entry.bookingId ?? null,
      entry.tripId ?? null,
      entry.parcelId ?? null,
      JSON.stringify(entry.payload ?? {}),
    ],
  );
}
