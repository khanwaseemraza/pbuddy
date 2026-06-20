// Job (booking) hand-off for the Buddy. Sealed-package model: no open-box
// inspection — the sender declares the contents, the Buddy may decline (right to
// refuse), then scans the pickup code (captures escrow) and the dropoff code
// (releases the payout). Built on the flow UI kit.
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, ApiError, gbp } from '../../src/lib/api';
import { useLiveBooking } from '../../src/lib/useLiveBooking';
import {
  FA, FlowScreen, GhostButton, Glass, PrimaryButton, ScreenHeading, StatusChip, TextField,
} from '../../src/components/flowkit';
import { C } from '../../src/components/glass';

export default function Job() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const { booking, refresh } = useLiveBooking(id!, getToken);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, body?: object) {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      await api.post(`/bookings/${id}${path}`, token, body);
      setCode('');
      await refresh();
    } catch (e) {
      const err = e as ApiError;
      const b = err?.body as { error?: string } | undefined;
      setError(b?.error === 'invalid_code' ? "That code didn't match — check and try again." : (b?.error ?? 'Something went wrong.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FlowScreen>
      <Stack.Screen options={{ headerShown: false }} />
      {!booking ? (
        <Glass style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: C.muted }}>Loading…</Text>
        </Glass>
      ) : (
        <>
          <ScreenHeading title="Hand-off" subtitle={`Your share: ${gbp(booking.contribution_pennies)}`} />

          {booking.status === 'claimed' ? (
            <Glass>
              <StatusChip label="Waiting to be paid" tone="neutral" />
              <Text style={{ color: C.muted, marginTop: 12, lineHeight: 21 }}>
                The sender is paying into escrow now. You'll be ready to collect once it's held securely.
              </Text>
            </Glass>
          ) : booking.status === 'funded' ? (
            <Glass>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: C.tileTint, alignItems: 'center', justifyContent: 'center' }}>
                  <FA name="box" size={17} color={C.coral} />
                </View>
                <Text style={{ color: C.heading, fontWeight: '800', fontSize: 17 }}>Sealed parcel</Text>
              </View>
              <Text style={{ color: C.muted, marginBottom: 16, lineHeight: 21 }}>
                The sender has sealed the parcel and declared what's inside. It stays sealed — you don't open it.
                If you'd rather not take it, you can decline.
              </Text>
              <Text style={{ color: C.heading, fontWeight: '700', marginBottom: 8 }}>Pickup — enter the sender's code</Text>
              <TextField value={code} onChangeText={setCode} placeholder="6-digit code or QR token" autoCapitalize="none" />
              <View style={{ marginTop: 12 }}>
                <PrimaryButton label="Confirm pickup" icon="circle-check" onPress={() => call('/pickup', { code })} busy={busy} />
              </View>
              <View style={{ marginTop: 10 }}>
                <GhostButton label="Decline this parcel" onPress={() => call('/decline')} busy={busy} />
              </View>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 14, lineHeight: 17 }}>
                You can also pass this to another verified Buddy before pickup — your right of substitution.
                See the Buddy Carrier Agreement.
              </Text>
            </Glass>
          ) : booking.status === 'picked_up' ? (
            <Glass>
              <Text style={{ color: C.heading, fontWeight: '700', marginBottom: 8 }}>Drop-off — enter the recipient's code</Text>
              <TextField value={code} onChangeText={setCode} placeholder="6-digit code or QR token" autoCapitalize="none" />
              <View style={{ marginTop: 12 }}>
                <PrimaryButton label="Confirm drop-off" icon="circle-check" onPress={() => call('/dropoff', { code })} busy={busy} />
              </View>
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 12, lineHeight: 17 }}>
                Once confirmed, your share is released from escrow to you.
              </Text>
            </Glass>
          ) : booking.status === 'released' ? (
            <Glass style={{ alignItems: 'center', padding: 28 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: C.greenBg, alignItems: 'center', justifyContent: 'center' }}>
                <FA name="circle-check" size={24} color={C.green} />
              </View>
              <Text style={{ color: C.heading, fontWeight: '800', fontSize: 18, marginTop: 14 }}>Handed over</Text>
              <Text style={{ color: C.muted, marginTop: 4 }}>{gbp(booking.contribution_pennies)} is on its way to you.</Text>
            </Glass>
          ) : (
            <Glass>
              <StatusChip label={booking.status} tone="neutral" />
              <Text style={{ color: C.muted, marginTop: 12 }}>Nothing to do right now.</Text>
            </Glass>
          )}

          {error ? <Text style={{ color: C.coralStatus, marginTop: 16 }}>{error}</Text> : null}
        </>
      )}
    </FlowScreen>
  );
}
