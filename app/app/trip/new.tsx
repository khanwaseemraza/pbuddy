// Carry & earn — a guided wizard to post a trip you're already taking. Your
// declared journey cost becomes the cost-sharing cap on what you can accept.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, ApiError, gbp, type Corridor } from '../../src/lib/api';
import { Chip, Field, Input } from '../../src/components/ui';
import { Card, ProgressBar, ScreenTitle, StepNav, SummaryRow } from '../../src/components/kit';
import { theme } from '../../src/theme';

const MODES = ['train', 'bus', 'coach', 'car'] as const;
const STEPS = ['Route', 'Trip', 'Cost & review'];

function plusDaysISODate(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

export default function NewTrip() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [step, setStep] = useState(0);
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
  const corridorName = corridors.find((c) => c.id === corridorId)?.display_name ?? '—';
  const stepValid = [!!corridorId, /\d{4}-\d{2}-\d{2}/.test(date), costPennies > 0][step];

  async function onSubmit() {
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
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 48 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProgressBar step={step} total={STEPS.length} />

      {step === 0 && (
        <>
          <ScreenTitle title="Your journey" subtitle="Post a trip you’re already taking and carry parcels along the way." />
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
        </>
      )}

      {step === 1 && (
        <>
          <ScreenTitle title="How & when" subtitle="Your transport and departure date." />
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
        </>
      )}

      {step === 2 && (
        <>
          <ScreenTitle
            title="Your journey cost"
            subtitle="This is your cost-sharing cap — you can never accept more than what your own trip costs."
          />
          <Field label="Journey cost (£)">
            <Input value={costGbp} onChangeText={setCostGbp} placeholder="50.00" keyboardType="decimal-pad" />
          </Field>
          <Card>
            <SummaryRow label="Route" value={`${corridorName} · ${direction}`} />
            <SummaryRow label="Transport" value={mode} />
            <SummaryRow label="Departs" value={date} />
            <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 6 }} />
            <SummaryRow label="Contribution cap" value={gbp(costPennies)} strong />
          </Card>
        </>
      )}

      {error ? <Text style={{ color: theme.danger, marginTop: 16 }}>{error}</Text> : null}

      <StepNav
        onBack={step > 0 ? () => setStep(step - 1) : undefined}
        onNext={() => (step < STEPS.length - 1 ? setStep(step + 1) : onSubmit())}
        nextLabel={step === STEPS.length - 1 ? 'Post trip' : 'Continue'}
        busy={busy}
        disabled={!stepValid}
      />
    </ScrollView>
  );
}
