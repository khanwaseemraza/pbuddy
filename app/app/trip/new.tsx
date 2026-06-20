// Share your trip — a guided wizard to post a journey you're already taking. Your
// declared journey cost becomes the cost-sharing cap on what you can accept.
// Greener scope (PBD-145): public transport, bike or on foot only — no motor cars.
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, ApiError, gbp, routeLabel, type Corridor } from '../../src/lib/api';
import {
  Divider, Field, FlowScreen, Panel, Pill, ProgressDots, ScreenHeading,
  StepNav, SummaryRow, TextField,
} from '../../src/components/flowkit';
import { C } from '../../src/components/glass';

// Public transport / bike / foot only — greener scope, no motor vehicles.
const MODES = ['train', 'bus', 'coach', 'bike', 'foot'] as const;
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

  // Public fetch so the wizard works logged out; sign-in only at the Post step.
  useEffect(() => {
    api
      .getPublic<{ corridors: Corridor[] }>('/corridors')
      .then((d) => {
        setCorridors(d.corridors);
        setCorridorId(d.corridors[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  const costPennies = Math.round(parseFloat(costGbp || '0') * 100);
  const corridorName = routeLabel(corridors.find((c) => c.id === corridorId)?.display_name ?? '—');
  const stepValid = [!!corridorId, /\d{4}-\d{2}-\d{2}/.test(date), costPennies > 0][step];

  async function onSubmit() {
    const token = await getToken();
    if (!token) {
      router.push('/sign-in');
      return;
    }
    setBusy(true);
    setError(null);
    try {
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
          ? "You've hit your weekly travel limit — pBuddy is for trips you're already taking."
          : 'Could not post the trip.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <FlowScreen onBack={step > 0 ? () => setStep(step - 1) : () => router.back()}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProgressDots step={step} total={STEPS.length} />

      <Panel>
        {step === 0 && (
          <>
            <ScreenHeading title="Your journey" subtitle="Share a trip you're already taking and bring parcels along the way." />
            <Field label="Route">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {corridors.map((c) => (
                  <Pill key={c.id} label={routeLabel(c.display_name)} active={c.id === corridorId} onPress={() => setCorridorId(c.id)} />
                ))}
              </View>
            </Field>
            <Field label="Direction">
              <View style={{ flexDirection: 'row' }}>
                <Pill label="Outbound" active={direction === 'outbound'} onPress={() => setDirection('outbound')} />
                <Pill label="Return" active={direction === 'return'} onPress={() => setDirection('return')} />
              </View>
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <ScreenHeading title="How & when" subtitle="How you're travelling, and the day you set off." />
            <Field label="Travelling by">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {MODES.map((m) => (
                  <Pill key={m} label={MODE_LABEL[m]} active={m === mode} onPress={() => setMode(m)} />
                ))}
              </View>
            </Field>
            <Field label="Departure date">
              <TextField value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" autoCapitalize="none" />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <ScreenHeading
              title="What does the trip cost you?"
              subtitle="This sets your cost-sharing cap — you can never accept more than your own journey costs."
            />
            <Field label="Your journey cost (£)">
              <TextField value={costGbp} onChangeText={setCostGbp} placeholder="50.00" keyboardType="decimal-pad" />
            </Field>
            <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, backgroundColor: 'rgba(255,255,255,0.5)' }}>
              <SummaryRow label="Route" value={`${corridorName} · ${direction}`} />
              <SummaryRow label="Travelling by" value={MODE_LABEL[mode]} />
              <SummaryRow label="Departs" value={date} />
              <Divider />
              <SummaryRow label="Most you can accept" value={gbp(costPennies)} strong />
            </View>
          </>
        )}

        {error ? <Text style={{ color: C.coralStatus, marginTop: 16 }}>{error}</Text> : null}

        <StepNav
          onBack={step > 0 ? () => setStep(step - 1) : undefined}
          onNext={() => (step < STEPS.length - 1 ? setStep(step + 1) : onSubmit())}
          nextLabel={step === STEPS.length - 1 ? 'Post trip' : 'Continue'}
          busy={busy}
          disabled={!stepValid}
        />
      </Panel>
    </FlowScreen>
  );
}

const MODE_LABEL: Record<(typeof MODES)[number], string> = {
  train: 'Train', bus: 'Bus', coach: 'Coach', bike: 'Bike', foot: 'On foot',
};
