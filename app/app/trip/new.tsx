// Post a trip: corridor + direction + transport, depart date, and your journey
// cost — which becomes the cost-sharing cap for what you can carry.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, ApiError, type Corridor } from '../../src/lib/api';
import { Button, Chip, Field, Input } from '../../src/components/ui';
import { theme } from '../../src/theme';

const MODES = ['train', 'bus', 'coach', 'car'] as const;

function plusDaysISODate(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export default function NewTrip() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [corridorId, setCorridorId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'outbound' | 'return'>('outbound');
  const [mode, setMode] = useState<(typeof MODES)[number]>('train');
  const [date, setDate] = useState(plusDaysISODate(2));
  const [costGbp, setCostGbp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token) return;
      try {
        const data = await api.get<{ corridors: Corridor[] }>('/corridors', token);
        setCorridors(data.corridors);
        setCorridorId(data.corridors[0]?.id ?? null);
      } catch { /* on submit */ }
    })();
  }, []);

  const costPennies = Math.round(parseFloat(costGbp || '0') * 100);
  const canSubmit = corridorId && date && costPennies > 0;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const trip = await api.post<{ id: string }>('/trips', token, {
        corridor_id: corridorId,
        direction,
        transport_mode: mode,
        depart_at: new Date(`${date}T09:00:00Z`).toISOString(),
        journey_cost_pennies: costPennies,
        journey_cost_source: 'self_declared',
      });
      router.replace(`/trip/${trip.id}`);
    } catch (e) {
      const err = e as ApiError;
      setError(
        err?.status === 429
          ? 'You’ve hit your weekly travel limit — PBuddy is for trips you’re already taking.'
          : 'Could not post the trip.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800', marginBottom: 4 }}>Carry & earn</Text>
      <Text style={{ color: theme.muted, marginBottom: 24 }}>
        Cover your travel costs — you can only accept up to what your journey costs.
      </Text>

      <Field label="Route">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {corridors.map((c) => (
            <Chip key={c.id} label={c.display_name} active={c.id === corridorId} onPress={() => setCorridorId(c.id)} />
          ))}
        </View>
      </Field>
      <Field label="Direction">
        <View style={{ flexDirection: 'row' }}>
          <Chip label="Outbound" active={direction === 'outbound'} onPress={() => setDirection('outbound')} />
          <Chip label="Return" active={direction === 'return'} onPress={() => setDirection('return')} />
        </View>
      </Field>
      <Field label="Transport">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {MODES.map((m) => (
            <Chip key={m} label={m} active={m === mode} onPress={() => setMode(m)} />
          ))}
        </View>
      </Field>
      <Field label="Departure date">
        <Input value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
      </Field>
      <Field label="Your journey cost (£) — your earning cap">
        <Input value={costGbp} onChangeText={setCostGbp} placeholder="50.00" keyboardType="decimal-pad" />
      </Field>

      {error ? <Text style={{ color: theme.danger, marginBottom: 12 }}>{error}</Text> : null}
      <Button label={canSubmit ? 'Post trip' : 'Complete the form'} onPress={onSubmit} busy={busy} />
    </ScrollView>
  );
}
