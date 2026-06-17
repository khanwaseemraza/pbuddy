// Discover parcels you could carry on this trip, and place a cap-bounded bid.
// A bid above your journey cost is rejected with the cost-sharing message.
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, ApiError, gbp } from '../../src/lib/api';
import { Input } from '../../src/components/ui';
import { Card, EmptyState, ScreenTitle, Skeleton, StatusPill } from '../../src/components/kit';
import { theme } from '../../src/theme';

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
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 48 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenTitle title="Parcels on your route" subtitle="Tap to bid — never above your journey cost (that’s the cap)." />

      {!matches ? (
        <>
          <Skeleton height={120} />
          <Skeleton height={120} />
        </>
      ) : matches.length === 0 ? (
        <EmptyState
          title="No matching parcels yet"
          subtitle="We’ll surface parcels heading your way as senders post them. Check back closer to your trip."
        />
      ) : (
        matches.map((m) => <MatchRow key={m.parcel_id} match={m} tripId={id!} getToken={getToken} onDone={load} />)
      )}
    </ScrollView>
  );
}

function MatchRow({
  match,
  tripId,
  getToken,
  onDone,
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
      setMsg({ ok: true, text: 'Bid placed — the sender will be notified.' });
      onDone();
    } catch (e) {
      const err = e as ApiError;
      const body = err?.body as { error?: string; message?: string } | undefined;
      setMsg({
        ok: false,
        text:
          body?.error === 'cap_exceeded'
            ? body.message ?? 'That exceeds your journey cost — PBuddy is cost-sharing.'
            : body?.error === 'bid_above_sender_max'
              ? 'Above the sender’s maximum.'
              : 'Could not place bid.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <Text style={{ color: theme.text, fontWeight: '800', fontSize: 17 }}>{match.title}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 14 }}>
        <StatusPill label={`~${Math.round(match.detour_km)} km detour`} />
        <StatusPill label={match.pricing_mode === 'auction' ? 'Travellers bid' : 'Fixed'} tone="accent" />
        <StatusPill label={`suggested ${gbp(match.contribution_ref_pennies)}`} tone="success" />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <Pressable
          onPress={busy ? undefined : bid}
          style={{ backgroundColor: theme.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 22, opacity: busy ? 0.7 : 1 }}
        >
          <Text style={{ color: theme.accentText, fontWeight: '800' }}>{busy ? '…' : 'Bid'}</Text>
        </Pressable>
      </View>
      {msg ? <Text style={{ color: msg.ok ? '#1E7F4E' : theme.danger, marginTop: 10 }}>{msg.text}</Text> : null}
    </Card>
  );
}
