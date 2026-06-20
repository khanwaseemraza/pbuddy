// Discover parcels you could carry on this trip, and place a cap-bounded bid.
// A bid above your journey cost is rejected with the cost-sharing message.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, ApiError, gbp } from '../../src/lib/api';
import {
  EmptyState, FA, Glass, PageScreen, PrimaryButton, Skeleton, StatusChip, TextField,
} from '../../src/components/flowkit';
import { C } from '../../src/components/glass';

interface Match {
  parcel_id: string;
  title: string;
  contribution_ref_pennies: number;
  pricing_mode: 'fixed' | 'auction';
  detour_km: number;
}

export default function TripDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getToken } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<Match[] | null>(null);

  async function load() {
    const token = await getToken();
    if (!token) return;
    try {
      const data = await api.get<{ matches: Match[] }>(`/trips/${id}/matches`, token);
      setMatches(data.matches);
    } catch { setMatches([]); }
  }
  useEffect(() => { load(); }, [id]);

  return (
    <PageScreen onBack={() => router.back()} title="Parcels on your route" subtitle="Offer to carry one — your bid can't go above your own journey cost (that's the cap).">
      <Stack.Screen options={{ headerShown: false }} />
      {!matches ? (
        <>
          <Skeleton height={132} />
          <Skeleton height={132} />
        </>
      ) : matches.length === 0 ? (
        <EmptyState
          icon="box"
          title="No matching parcels yet"
          subtitle="We'll show parcels heading your way as senders post them. Check back closer to your trip."
        />
      ) : (
        matches.map((m) => <MatchRow key={m.parcel_id} match={m} tripId={id!} getToken={getToken} onDone={load} />)
      )}
    </PageScreen>
  );
}

function MatchRow({
  match, tripId, getToken, onDone,
}: {
  match: Match;
  tripId: string;
  getToken: () => Promise<string | null>;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState(((match.contribution_ref_pennies || 0) / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function bid() {
    setBusy(true);
    setMsg(null);
    try {
      const token = await getToken();
      if (!token) return;
      await api.post(`/parcels/${match.parcel_id}/bids`, token, {
        trip_id: tripId,
        bid_contribution_pennies: Math.round(parseFloat(amount || '0') * 100),
      });
      setMsg({ ok: true, text: 'Offer sent — the sender will be notified.' });
      onDone();
    } catch (e) {
      const err = e as ApiError;
      const body = err?.body as { error?: string; message?: string } | undefined;
      setMsg({
        ok: false,
        text:
          body?.error === 'cap_exceeded'
            ? body.message ?? "That's above your own journey cost — pBuddy is cost-sharing."
            : body?.error === 'bid_above_sender_max'
              ? "That's above the sender's maximum."
              : 'Could not send your offer.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Glass style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.tileTint, alignItems: 'center', justifyContent: 'center' }}>
          <FA name="box" size={17} color={C.coral} />
        </View>
        <Text style={{ color: C.heading, fontWeight: '800', fontSize: 17, flex: 1 }}>{match.title}</Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 14 }}>
        <StatusChip label={`~${Math.round(match.detour_km)} km off your route`} />
        <StatusChip label={match.pricing_mode === 'auction' ? 'Buddies bid' : 'Fixed'} tone="accent" />
        <StatusChip label={`suggested ${gbp(match.contribution_ref_pennies)}`} tone="success" />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14 }}>
          <Text style={{ color: C.muted, fontSize: 16, fontWeight: '700' }}>£</Text>
          <TextField value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ flex: 1, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 6 }} />
        </View>
        <PrimaryButton label={busy ? '…' : 'Offer'} onPress={bid} busy={busy} style={{ paddingHorizontal: 22 }} />
      </View>
      {msg ? <Text style={{ color: msg.ok ? C.green : C.coralStatus, marginTop: 10 }}>{msg.text}</Text> : null}
    </Glass>
  );
}
