// Parcel detail: review bids -> accept -> fund escrow -> show the pickup QR/OTP.
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, gbp, type BidSummary, type HandoffCodes } from '../../src/lib/api';
import { useLiveBooking } from '../../src/lib/useLiveBooking';
import { GlassCard } from '../../src/components/GlassCard';
import { Button } from '../../src/components/ui';
import { QrCode } from '../../src/components/QrCode';
import { theme } from '../../src/theme';

export default function ParcelDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const [bids, setBids] = useState<BidSummary[] | null>(null);
  const [busyBid, setBusyBid] = useState<string | null>(null);
  const [codes, setCodes] = useState<HandoffCodes | null>(null);
  const [bookingId, setBookingId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { booking: live } = useLiveBooking(bookingId, getToken);

  async function load() {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.get<{ bids: BidSummary[] }>(`/parcels/${id}/bids`, token);
      setBids(data.bids);
    } catch {
      setError('Could not load bids.');
    }
  }
  useEffect(() => { load(); }, [id]);

  // Accept a bid -> creates booking -> fund escrow -> reveal hand-off codes.
  async function acceptAndFund(bidId: string) {
    setBusyBid(bidId);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const booking = await api.post<{ booking_id: string }>(`/bids/${bidId}/accept`, token);
      setBookingId(booking.booking_id);
      const funded = await api.post<{ handoff_codes: HandoffCodes }>(
        `/bookings/${booking.booking_id}/fund`,
        token,
        { with_insurance: true },
      );
      setCodes(funded.handoff_codes);
    } catch {
      setError('Could not accept/fund — try again.');
    } finally {
      setBusyBid(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800', marginBottom: 16 }}>Your parcel</Text>

      {codes ? (
        <GlassCard>
          <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18, marginBottom: 4 }}>Booked & funded ✅</Text>
          <Text style={{ color: theme.muted, marginBottom: 16 }}>
            Show this QR to your traveller at pickup (or read out the code).
          </Text>
          <QrCode value={codes.pickup_qr} />
          <Text style={{ color: theme.text, textAlign: 'center', marginTop: 16, fontWeight: '700', fontSize: 20, letterSpacing: 4 }}>
            {codes.pickup_otp}
          </Text>
          <Text style={{ color: theme.muted, textAlign: 'center', marginTop: 4 }}>pickup code</Text>
          {live ? (
            <Text style={{ color: theme.accent, textAlign: 'center', marginTop: 16, fontWeight: '700' }}>
              ● Live: {live.status}
            </Text>
          ) : null}
        </GlassCard>
      ) : (
        <>
          <Text style={{ color: theme.text, fontWeight: '700', marginBottom: 12 }}>Bids from travellers</Text>
          {error ? <Text style={{ color: theme.danger, marginBottom: 12 }}>{error}</Text> : null}
          {!bids ? (
            <ActivityIndicator color={theme.accent} />
          ) : bids.length === 0 ? (
            <Text style={{ color: theme.muted }}>No bids yet — travellers on this route will appear here.</Text>
          ) : (
            bids.map((b) => (
              <GlassCard key={b.id} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 18 }}>
                      {gbp(b.bid_contribution_pennies)}
                    </Text>
                    <Text style={{ color: theme.muted, marginTop: 2 }}>
                      {b.traveller_name ?? 'Traveller'} · ★ {Number(b.trust_score).toFixed(1)} ({b.rating_count}) · {b.transport_mode}
                    </Text>
                  </View>
                  <View style={{ width: 120 }}>
                    <Button label="Accept" onPress={() => acceptAndFund(b.id)} busy={busyBid === b.id} />
                  </View>
                </View>
              </GlassCard>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}
