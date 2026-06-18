// Your parcel: ranked traveller bids -> accept -> fund escrow (with a clear price
// breakdown) -> live tracking + hand-off QR/OTP. Built on the design-system kit.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, gbp, type BidSummary, type HandoffCodes } from '../../src/lib/api';
import { useLiveBooking } from '../../src/lib/useLiveBooking';
import { QrCode } from '../../src/components/QrCode';
import { Card, EmptyState, ScreenTitle, Skeleton, StatusPill, StatusTimeline, SummaryRow } from '../../src/components/kit';
import { theme } from '../../src/theme';

interface Charges {
  grossPennies: number;
  platformFeePennies: number;
  escrowFeePennies: number;
  insuranceCostPennies: number;
}

export default function ParcelDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const [bids, setBids] = useState<BidSummary[] | null>(null);
  const [busyBid, setBusyBid] = useState<string | null>(null);
  const [codes, setCodes] = useState<HandoffCodes | null>(null);
  const [charges, setCharges] = useState<Charges | null>(null);
  const [accepted, setAccepted] = useState<BidSummary | null>(null);
  const [bookingId, setBookingId] = useState<string>('');
  const [insure, setInsure] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { booking: live } = useLiveBooking(bookingId, getToken);

  async function load() {
    try {
      const token = await getToken();
      if (!token) return;
      const data = await api.get<{ bids: BidSummary[] }>(`/parcels/${id}/bids`, token);
      // Rank cheapest-first (the sender's contribution is capped either way);
      // tie-break by trust. The top card is badged "Best value".
      const ranked = [...data.bids].sort(
        (a, b) => a.bid_contribution_pennies - b.bid_contribution_pennies || b.trust_score - a.trust_score,
      );
      setBids(ranked);
    } catch {
      setError('Could not load bids.');
    }
  }
  useEffect(() => { load(); }, [id]);

  async function acceptAndFund(bid: BidSummary) {
    setBusyBid(bid.id);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const booking = await api.post<{ booking_id: string }>(`/bids/${bid.id}/accept`, token);
      setBookingId(booking.booking_id);
      const funded = await api.post<{ handoff_codes: HandoffCodes; charges: Charges }>(
        `/bookings/${booking.booking_id}/fund`,
        token,
        { with_insurance: insure },
      );
      setAccepted(bid);
      setCharges(funded.charges);
      setCodes(funded.handoff_codes);
    } catch {
      setError('Could not accept/fund — please try again.');
    } finally {
      setBusyBid(null);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 48 }}>
      <Stack.Screen options={{ headerShown: false }} />

      {codes && accepted ? (
        <>
          <ScreenTitle title="Track your parcel" subtitle={`${accepted.traveller_name ?? 'Your traveller'} is carrying your parcel.`} />

          {(() => {
            const s = live?.status ?? 'funded';
            const bad = s === 'refunded' || s === 'cancelled' || s === 'disputed';
            return (
              <Card style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ color: theme.text, fontWeight: '800' }}>Delivery progress</Text>
                  <StatusPill label={bad ? s : `● Live · ${s}`} tone={bad ? 'danger' : 'accent'} />
                </View>
                {bad ? (
                  <Text style={{ color: theme.muted }}>This booking is {s}. Any held funds are released back to you.</Text>
                ) : (
                  <StatusTimeline status={s} />
                )}
              </Card>
            );
          })()}

          <Card style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.muted, marginBottom: 16, textAlign: 'center' }}>
              Show this at pickup — your traveller scans the QR or enters the code.
            </Text>
            <QrCode value={codes.pickup_qr} />
            <Text style={{ color: theme.text, marginTop: 16, fontWeight: '800', fontSize: 22, letterSpacing: 6 }}>
              {codes.pickup_otp}
            </Text>
            <Text style={{ color: theme.muted, marginTop: 2 }}>pickup code</Text>
          </Card>

          {charges ? (
            <Card style={{ marginTop: 16 }}>
              <Text style={{ color: theme.text, fontWeight: '800', marginBottom: 4 }}>Payment held in escrow</Text>
              <SummaryRow label="Contribution" value={gbp(accepted.bid_contribution_pennies)} />
              <SummaryRow label="Platform fee" value={gbp(charges.platformFeePennies)} />
              <SummaryRow label="Escrow fee" value={gbp(charges.escrowFeePennies)} />
              <SummaryRow label="Insurance" value={gbp(charges.insuranceCostPennies)} />
              <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 6 }} />
              <SummaryRow label="Total held" value={gbp(charges.grossPennies)} strong />
              <Text style={{ color: theme.muted, fontSize: 12, marginTop: 8 }}>
                Released to the traveller only after a successful drop-off.
              </Text>
            </Card>
          ) : null}
        </>
      ) : (
        <>
          <ScreenTitle title="Choose a traveller" subtitle="Travellers on your route have bid to carry your parcel." />

          {bids && bids.length > 0 ? (
            <Pressable onPress={() => setInsure(!insure)} style={{ marginBottom: 16 }}>
              <Card>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                      borderColor: insure ? theme.accent : theme.border,
                      backgroundColor: insure ? theme.accent : 'transparent',
                      alignItems: 'center', justifyContent: 'center', marginRight: 12,
                    }}
                  >
                    {insure ? <Text style={{ color: theme.accentText, fontWeight: '900', fontSize: 13 }}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: theme.text, fontWeight: '700' }}>Add parcel cover (optional)</Text>
                    <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>
                      Extra protection for your item, added to the total you fund.
                    </Text>
                  </View>
                </View>
              </Card>
            </Pressable>
          ) : null}

          {error ? <Text style={{ color: theme.danger, marginBottom: 12 }}>{error}</Text> : null}

          {!bids ? (
            <>
              <Skeleton height={92} />
              <Skeleton height={92} />
              <Skeleton height={92} />
            </>
          ) : bids.length === 0 ? (
            <EmptyState
              title="No bids yet"
              subtitle="Travellers heading along your route will appear here. We’ll notify you the moment one bids."
            />
          ) : (
            bids.map((b, i) => (
              <Card key={b.id} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    {i === 0 ? <View style={{ marginBottom: 8 }}><StatusPill label="Best value" tone="success" /></View> : null}
                    <Text style={{ color: theme.text, fontWeight: '800', fontSize: 22 }}>{gbp(b.bid_contribution_pennies)}</Text>
                    <Text style={{ color: theme.muted, marginTop: 4 }}>
                      {b.traveller_name ?? 'Traveller'} · ★ {Number(b.trust_score).toFixed(1)} ({b.rating_count})
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <StatusPill label={b.transport_mode} />
                      {b.depart_at ? <StatusPill label={`departs ${new Date(b.depart_at).toLocaleDateString()}`} /> : null}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => acceptAndFund(b)}
                    disabled={!!busyBid}
                    style={{
                      backgroundColor: theme.accent,
                      borderRadius: 12,
                      paddingVertical: 12,
                      paddingHorizontal: 18,
                      opacity: busyBid && busyBid !== b.id ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: theme.accentText, fontWeight: '800' }}>
                      {busyBid === b.id ? '…' : 'Accept'}
                    </Text>
                  </Pressable>
                </View>
              </Card>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}
