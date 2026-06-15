// Trip detail: matched parcels you could carry; place a cap-bounded bid.
// A bid above your journey cost is rejected with the cost-sharing message.
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, ApiError, gbp } from '../../src/lib/api';
import { GlassCard } from '../../src/components/GlassCard';
import { Button, Input } from '../../src/components/ui';
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
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800', marginBottom: 4 }}>Parcels for your trip</Text>
      <Text style={{ color: theme.muted, marginBottom: 20 }}>Bid only up to your journey cost — that’s the cap.</Text>

      {!matches ? (
        <ActivityIndicator color={theme.accent} />
      ) : matches.length === 0 ? (
        <Text style={{ color: theme.muted }}>No matching parcels right now. Check back closer to your trip.</Text>
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
      setMsg({ ok: true, text: 'Bid placed!' });
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
    <GlassCard style={{ marginBottom: 12 }}>
      <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{match.title}</Text>
      <Text style={{ color: theme.muted, marginTop: 2, marginBottom: 10 }}>
        ~{Math.round(match.detour_km)} km · suggested {gbp(match.contribution_ref_pennies)}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" style={{ flex: 1 }} />
        <View style={{ width: 110 }}>
          <Button label="Bid" onPress={bid} busy={busy} />
        </View>
      </View>
      {msg ? <Text style={{ color: msg.ok ? theme.accent : theme.danger, marginTop: 10 }}>{msg.text}</Text> : null}
    </GlassCard>
  );
}
