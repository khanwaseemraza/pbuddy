// Your parcel: ranked Buddy offers -> accept -> fund escrow (with a clear price
// breakdown) -> live tracking + hand-off QR/OTP. Built on the flow UI kit.
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, gbp, type BidSummary, type HandoffCodes } from '../../src/lib/api';
import { useLiveBooking } from '../../src/lib/useLiveBooking';
import { QrCode } from '../../src/components/QrCode';
import {
  Checkbox, Divider, FA, FlowScreen, Glass, PrimaryButton, ScreenHeading,
  StatusChip, SummaryRow,
} from '../../src/components/flowkit';
import { C } from '../../src/components/glass';

interface Charges {
  grossPennies: number;
  platformFeePennies: number;
  escrowFeePennies: number;
  insuranceCostPennies: number;
}

// Plain-English labels for the live booking status.
const STATUS_LABEL: Record<string, string> = {
  funded: 'Paid — waiting for pickup',
  picked_up: 'On its way',
  released: 'Handed over',
  refunded: 'Refunded',
  cancelled: 'Cancelled',
  disputed: 'Under review',
};

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
      setError('Could not load offers.');
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
      setError('Could not confirm — please try again.');
    } finally {
      setBusyBid(null);
    }
  }

  return (
    <FlowScreen>
      <Stack.Screen options={{ headerShown: false }} />

      {codes && accepted ? (
        <>
          <ScreenHeading title="Track your parcel" subtitle={`${accepted.traveller_name ?? 'Your Buddy'} is taking your parcel along.`} />

          {(() => {
            const s = live?.status ?? 'funded';
            const bad = s === 'refunded' || s === 'cancelled' || s === 'disputed';
            return (
              <Glass style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.heading, fontWeight: '800', fontSize: 16 }}>Progress</Text>
                  <StatusChip label={STATUS_LABEL[s] ?? s} tone={bad ? 'danger' : 'accent'} />
                </View>
                {bad ? (
                  <Text style={{ color: C.muted, marginTop: 12 }}>This booking is {STATUS_LABEL[s] ?? s}. Any money held is released back to you.</Text>
                ) : null}
              </Glass>
            );
          })()}

          <Glass style={{ alignItems: 'center', padding: 24 }}>
            <Text style={{ color: C.muted, marginBottom: 16, textAlign: 'center' }}>
              Show this at pickup — your Buddy scans the QR or enters the code.
            </Text>
            <QrCode value={codes.pickup_qr} />
            <Text style={{ color: C.heading, marginTop: 16, fontWeight: '800', fontSize: 24, letterSpacing: 6 }}>{codes.pickup_otp}</Text>
            <Text style={{ color: C.muted, marginTop: 2, fontSize: 13 }}>pickup code</Text>
          </Glass>

          {charges ? (
            <Glass style={{ marginTop: 16 }}>
              <Text style={{ color: C.heading, fontWeight: '800', marginBottom: 6, fontSize: 16 }}>Held securely until handover</Text>
              <SummaryRow label="Your contribution" value={gbp(accepted.bid_contribution_pennies)} />
              <SummaryRow label="Platform charge" value={gbp(charges.platformFeePennies)} />
              <SummaryRow label="Escrow charge" value={gbp(charges.escrowFeePennies)} />
              <SummaryRow label="Optional cover" value={gbp(charges.insuranceCostPennies)} />
              <Divider />
              <SummaryRow label="Total held" value={gbp(charges.grossPennies)} strong />
              <Text style={{ color: C.muted, fontSize: 12, marginTop: 8, lineHeight: 17 }}>
                Released to your Buddy only after a successful hand-off.
              </Text>
            </Glass>
          ) : null}
        </>
      ) : (
        <>
          <ScreenHeading title="Choose your Buddy" subtitle="Buddies on your route have offered to take your parcel along." />

          {bids && bids.length > 0 ? (
            <Glass style={{ marginBottom: 16 }}>
              <Checkbox
                checked={insure}
                onToggle={() => setInsure(!insure)}
                label="Add optional cover for your parcel — added to the total you pay. It's never required."
              />
            </Glass>
          ) : null}

          {error ? <Text style={{ color: C.coralStatus, marginBottom: 12 }}>{error}</Text> : null}

          {!bids ? (
            <Glass style={{ height: 96, marginBottom: 12 }}><Text style={{ color: C.muted }}>Loading offers…</Text></Glass>
          ) : bids.length === 0 ? (
            <Glass style={{ padding: 28, alignItems: 'center' }}>
              <FA name="inbox" size={26} color={C.muted2} />
              <Text style={{ color: C.heading, fontWeight: '800', fontSize: 17, marginTop: 12 }}>No offers yet</Text>
              <Text style={{ color: C.muted, textAlign: 'center', marginTop: 6, lineHeight: 20 }}>
                Buddies heading along your route will appear here. We'll let you know the moment one offers.
              </Text>
            </Glass>
          ) : (
            bids.map((b, i) => (
              <Glass key={b.id} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    {i === 0 ? <View style={{ marginBottom: 8 }}><StatusChip label="Best value" tone="success" /></View> : null}
                    <Text style={{ color: C.heading, fontWeight: '800', fontSize: 24 }}>{gbp(b.bid_contribution_pennies)}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <Text style={{ color: C.muted }}>{b.traveller_name ?? 'Buddy'}</Text>
                      <FA name="star" size={11} color={C.amber} />
                      <Text style={{ color: C.muted }}>{Number(b.trust_score).toFixed(1)} ({b.rating_count})</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <StatusChip label={b.transport_mode} />
                      {b.depart_at ? <StatusChip label={`departs ${new Date(b.depart_at).toLocaleDateString()}`} /> : null}
                    </View>
                  </View>
                  <PrimaryButton
                    label={busyBid === b.id ? '…' : 'Choose'}
                    onPress={() => acceptAndFund(b)}
                    busy={busyBid === b.id}
                    disabled={!!busyBid && busyBid !== b.id}
                    style={{ paddingHorizontal: 20 }}
                  />
                </View>
              </Glass>
            ))
          )}
        </>
      )}
    </FlowScreen>
  );
}
