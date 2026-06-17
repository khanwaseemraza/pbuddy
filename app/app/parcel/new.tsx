// Send a parcel — a guided, validated, multi-step wizard (route -> addresses ->
// parcel -> contribution -> review). Cost-sharing framing throughout. Submits to
// POST /parcels. Built on the design-system kit (components/kit.tsx).
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, ApiError, gbp, type Corridor } from '../../src/lib/api';
import { AddressPicker, type PickedAddress } from '../../src/components/AddressPicker';
import { Chip, Field, Input } from '../../src/components/ui';
import { Card, ProgressBar, ScreenTitle, StepNav, SummaryRow } from '../../src/components/kit';
import { theme } from '../../src/theme';

const STEPS = ['Route', 'Addresses', 'Parcel', 'Contribution', 'Review'];

export default function NewParcel() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [step, setStep] = useState(0);
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [corridorId, setCorridorId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'outbound' | 'return'>('outbound');
  const [pickup, setPickup] = useState<PickedAddress | null>(null);
  const [dropoff, setDropoff] = useState<PickedAddress | null>(null);
  const [title, setTitle] = useState('');
  const [size, setSize] = useState<'S' | 'M' | 'L'>('S');
  const [valueGbp, setValueGbp] = useState('');
  const [pricingMode, setPricingMode] = useState<'fixed' | 'auction'>('auction');
  const [contribGbp, setContribGbp] = useState('');
  const [ack, setAck] = useState(false);
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
      } catch {
        /* handled on submit */
      }
    })();
  }, []);

  const valuePennies = Math.round(parseFloat(valueGbp || '0') * 100);
  const contribPennies = Math.round(parseFloat(contribGbp || '0') * 100);
  const corridorName = corridors.find((c) => c.id === corridorId)?.display_name ?? '—';
  const SIZES = { S: { l: 30, w: 20, h: 10, g: 1000 }, M: { l: 45, w: 35, h: 20, g: 4000 }, L: { l: 60, w: 45, h: 35, g: 9000 } };

  const stepValid = [
    !!corridorId,
    !!pickup && !!dropoff,
    title.trim().length > 0 && valuePennies > 0,
    contribPennies > 0 && ack,
    true,
  ][step];

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const now = Date.now();
      const dim = SIZES[size];
      const parcel = await api.post<{ id: string }>('/parcels', token, {
        corridor_id: corridorId,
        direction,
        title: title.trim(),
        category: 'general',
        pickup: { postcode: pickup!.postcode, address_line: pickup!.address_line },
        dropoff: { postcode: dropoff!.postcode, address_line: dropoff!.address_line },
        length_cm: dim.l,
        width_cm: dim.w,
        height_cm: dim.h,
        weight_g: dim.g,
        piece_count: 1,
        declared_value_pennies: valuePennies,
        pricing_mode: pricingMode,
        max_contribution_pennies: contribPennies,
        pickup_window_start: new Date(now + 86400000).toISOString(),
        pickup_window_end: new Date(now + 3 * 86400000).toISOString(),
        prohibited_items_ack: true,
      });
      router.replace(`/parcel/${parcel.id}`);
    } catch (e) {
      const err = e as ApiError;
      setError(
        err?.body && typeof err.body === 'object'
          ? `Couldn’t post: ${JSON.stringify(err.body)}`
          : 'Could not post the parcel.',
      );
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else onSubmit();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64, paddingBottom: 48 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProgressBar step={step} total={STEPS.length} />

      {step === 0 && (
        <>
          <ScreenTitle title="Where to?" subtitle="Pick the intercity route and direction for your parcel." />
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
          <ScreenTitle title="Pickup & drop-off" subtitle="Enter UK postcodes — we validate and pin them on the map." />
          <AddressPicker label="Pickup" onChange={setPickup} />
          <AddressPicker label="Drop-off" onChange={setDropoff} />
        </>
      )}

      {step === 2 && (
        <>
          <ScreenTitle title="About the parcel" subtitle="A quick description, its size, and what it’s worth." />
          <Field label="What is it?">
            <Input value={title} onChangeText={setTitle} placeholder="e.g. Birthday gift" />
          </Field>
          <Field label="Size">
            <View style={{ flexDirection: 'row' }}>
              <Chip label="Small" active={size === 'S'} onPress={() => setSize('S')} />
              <Chip label="Medium" active={size === 'M'} onPress={() => setSize('M')} />
              <Chip label="Large" active={size === 'L'} onPress={() => setSize('L')} />
            </View>
          </Field>
          <Field label="Declared value (£)">
            <Input value={valueGbp} onChangeText={setValueGbp} placeholder="50.00" keyboardType="decimal-pad" />
          </Field>
        </>
      )}

      {step === 3 && (
        <>
          <ScreenTitle
            title="Your contribution"
            subtitle="This goes toward the traveller’s journey costs — it’s capped to their own fare, never a delivery fee."
          />
          <Field label="How is it set?">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Chip label="Travellers bid" active={pricingMode === 'auction'} onPress={() => setPricingMode('auction')} />
              <Chip label="Fixed amount" active={pricingMode === 'fixed'} onPress={() => setPricingMode('fixed')} />
            </View>
          </Field>
          <Field label={pricingMode === 'auction' ? 'Maximum contribution (£)' : 'Contribution (£)'}>
            <Input value={contribGbp} onChangeText={setContribGbp} placeholder="20.00" keyboardType="decimal-pad" />
          </Field>
          <Chip
            label={ack ? '☑  No prohibited items — open for inspection' : '☐  No prohibited items — open for inspection'}
            active={ack}
            onPress={() => setAck(!ack)}
          />
        </>
      )}

      {step === 4 && (
        <>
          <ScreenTitle title="Review & post" subtitle="Check the details — travellers will see this listing." />
          <Card>
            <SummaryRow label="Route" value={`${corridorName} · ${direction}`} />
            <SummaryRow label="Pickup" value={pickup?.postcode ?? '—'} />
            <SummaryRow label="Drop-off" value={dropoff?.postcode ?? '—'} />
            <SummaryRow label="Parcel" value={`${title || '—'} · ${size}`} />
            <SummaryRow label="Declared value" value={gbp(valuePennies)} />
            <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 6 }} />
            <SummaryRow
              label={pricingMode === 'auction' ? 'Max contribution' : 'Contribution'}
              value={gbp(contribPennies)}
              strong
            />
          </Card>
          <Text style={{ color: theme.muted, fontSize: 13, marginTop: 12, lineHeight: 19 }}>
            A traveller’s accepted contributions can never exceed their own verified journey cost — the platform enforces it.
          </Text>
        </>
      )}

      {error ? <Text style={{ color: theme.danger, marginTop: 16 }}>{error}</Text> : null}

      <StepNav
        onBack={step > 0 ? () => setStep(step - 1) : undefined}
        onNext={next}
        nextLabel={step === STEPS.length - 1 ? `Post parcel · ${gbp(contribPennies)}` : 'Continue'}
        busy={busy}
        disabled={!stepValid}
      />
    </ScrollView>
  );
}
