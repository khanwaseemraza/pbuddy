// Job (booking) hand-off for the traveller. Sealed-package model: no open-box
// inspection — the sender declares the contents, the carrier may decline (right
// to refuse), then scans the pickup code (captures escrow) and the dropoff code
// (releases the payout).
import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, ApiError, gbp } from '../../src/lib/api';
import { useLiveBooking } from '../../src/lib/useLiveBooking';
import { GlassCard } from '../../src/components/GlassCard';
import { Button, Input } from '../../src/components/ui';
import { theme } from '../../src/theme';

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
      setError(b?.error === 'invalid_code' ? 'That code didn’t match — check and retry.' : (b?.error ?? 'Action failed.'));
    } finally {
      setBusy(false);
    }
  }

  if (!booking) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator color={theme.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800' }}>Hand-off</Text>
      <Text style={{ color: theme.muted, marginBottom: 20 }}>
        Status: {booking.status} · contribution {gbp(booking.contribution_pennies)}
      </Text>

      <GlassCard>
        {booking.status === 'claimed' ? (
          <Text style={{ color: theme.muted }}>Waiting for the sender to fund the escrow.</Text>
        ) : booking.status === 'funded' ? (
          <>
            <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 6 }}>Sealed parcel</Text>
            <Text style={{ color: theme.muted, marginBottom: 14 }}>
              The sender has declared the contents and that there are no prohibited items. The parcel stays sealed —
              you don’t open it. If you’re not willing to carry it, you can decline.
            </Text>
            <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 10 }}>Pickup — enter the sender’s code</Text>
            <Input value={code} onChangeText={setCode} placeholder="6-digit code or QR token" autoCapitalize="none" />
            <View style={{ marginTop: 12 }}>
              <Button label="Confirm pickup" onPress={() => call('/pickup', { code })} busy={busy} />
            </View>
            <View style={{ marginTop: 10 }}>
              <Button label="Decline this parcel" variant="ghost" onPress={() => call('/decline')} busy={busy} />
            </View>
          </>
        ) : booking.status === 'picked_up' ? (
          <>
            <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 10 }}>Drop-off — enter the recipient’s code</Text>
            <Input value={code} onChangeText={setCode} placeholder="6-digit code or QR token" autoCapitalize="none" />
            <View style={{ marginTop: 12 }}>
              <Button label="Confirm drop-off & get paid" onPress={() => call('/dropoff', { code })} busy={busy} />
            </View>
          </>
        ) : booking.status === 'released' ? (
          <Text style={{ color: theme.accent, fontWeight: '800', fontSize: 18 }}>
            Delivered & paid {gbp(booking.contribution_pennies)}
          </Text>
        ) : (
          <Text style={{ color: theme.muted }}>Nothing to do right now ({booking.status}).</Text>
        )}
      </GlassCard>

      {error ? <Text style={{ color: theme.danger, marginTop: 16 }}>{error}</Text> : null}
    </ScrollView>
  );
}
