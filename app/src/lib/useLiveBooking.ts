// Live booking status. Subscribes to the Firestore status mirror for real-time
// updates (production, where the API writes the mirror with its service account)
// and ALSO polls the API as a fallback so it works locally without those
// credentials. Returns the latest booking plus a manual refresh.
import { useCallback, useEffect, useState } from 'react';
import { subscribeBookingStatus } from './firebase';
import { api } from './api';

export interface LiveBooking {
  id: string;
  status: string;
  contribution_pennies: number;
}

export function useLiveBooking(id: string, getToken: () => Promise<string | null>) {
  const [booking, setBooking] = useState<LiveBooking | null>(null);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    try {
      setBooking(await api.get<LiveBooking>(`/bookings/${id}`, token));
    } catch {
      /* keep last known */
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    refresh();
    const poll = setInterval(refresh, 4000); // fallback (works without Firestore writes)

    // Real-time nudge: when the mirror doc changes, refresh immediately. Errors
    // (e.g. doc not yet written locally -> rules deny missing doc) are ignored.
    // Real-time nudge: when the mirror doc changes, refresh immediately.
    const unsub = subscribeBookingStatus(id, refresh);

    return () => {
      clearInterval(poll);
      unsub();
    };
  }, [id, refresh]);

  return { booking, refresh };
}
