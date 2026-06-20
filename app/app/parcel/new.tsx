// Send a parcel — a guided, validated, multi-step wizard (route -> addresses ->
// parcel -> contribution -> review). Cost-sharing framing throughout. Submits to
// POST /parcels. Built on the flow UI kit (components/flowkit.tsx).
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, ApiError, gbp, routeLabel, type Corridor } from '../../src/lib/api';
import { AddressPicker, type PickedAddress } from '../../src/components/AddressPicker';
import {
  Checkbox, Field, FlowScreen, Panel, Pill, ProgressDots, ScreenHeading,
  StepNav, SummaryRow, TextField, Divider,
} from '../../src/components/flowkit';
import { C } from '../../src/components/glass';

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

  // Public fetch so the wizard works logged out (browse-first); sign-in is only
  // required at the final Post step.
  useEffect(() => {
    api
      .getPublic<{ corridors: Corridor[] }>('/corridors')
      .then((d) => {
        setCorridors(d.corridors);
        setCorridorId(d.corridors[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  const valuePennies = Math.round(parseFloat(valueGbp || '0') * 100);
  const contribPennies = Math.round(parseFloat(contribGbp || '0') * 100);
  const corridorName = routeLabel(corridors.find((c) => c.id === corridorId)?.display_name ?? '—');
  const SIZES = { S: { l: 30, w: 20, h: 10, g: 1000 }, M: { l: 45, w: 35, h: 20, g: 4000 }, L: { l: 60, w: 45, h: 35, g: 9000 } };

  const stepValid = [
    !!corridorId,
    !!pickup && !!dropoff,
    title.trim().length > 0 && valuePennies > 0,
    contribPennies > 0 && ack,
    true,
  ][step];

  async function onSubmit() {
    const token = await getToken();
    if (!token) {
      // Auth-gate at commit: send them to sign in, then back to post.
      router.push('/sign-in');
      return;
    }
    setBusy(true);
    setError(null);
    try {
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
    <FlowScreen onBack={step > 0 ? () => setStep(step - 1) : () => router.back()}>
      <Stack.Screen options={{ headerShown: false }} />
      <ProgressDots step={step} total={STEPS.length} />

      <Panel>
      {step === 0 && (
        <>
          <ScreenHeading title="Where's it going?" subtitle="Choose the route your parcel will travel, and which way." />
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
          <ScreenHeading title="Pickup & drop-off" subtitle="Enter the UK postcodes — we check them and pin them on the map." />
          <AddressPicker label="Pickup" onChange={setPickup} />
          <AddressPicker label="Drop-off" onChange={setDropoff} />
        </>
      )}

      {step === 2 && (
        <>
          <ScreenHeading title="About the parcel" subtitle="A quick description, its size, and what it's worth." />
          <Field label="What is it?">
            <TextField value={title} onChangeText={setTitle} placeholder="e.g. Birthday gift" />
          </Field>
          <Field label="Size">
            <View style={{ flexDirection: 'row' }}>
              <Pill label="Small" active={size === 'S'} onPress={() => setSize('S')} />
              <Pill label="Medium" active={size === 'M'} onPress={() => setSize('M')} />
              <Pill label="Large" active={size === 'L'} onPress={() => setSize('L')} />
            </View>
          </Field>
          <Field label="What's it worth? (£)">
            <TextField value={valueGbp} onChangeText={setValueGbp} placeholder="50.00" keyboardType="decimal-pad" />
          </Field>
        </>
      )}

      {step === 3 && (
        <>
          <ScreenHeading
            title="Your contribution"
            subtitle="You share part of your Buddy's journey cost — capped so it never goes above what the trip really costs."
          />
          <Field label="How is it set?">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Pill label="Buddies bid" active={pricingMode === 'auction'} onPress={() => setPricingMode('auction')} />
              <Pill label="Set a fixed amount" active={pricingMode === 'fixed'} onPress={() => setPricingMode('fixed')} />
            </View>
          </Field>
          <Field label={pricingMode === 'auction' ? 'Most you would share (£)' : 'Your contribution (£)'}>
            <TextField value={contribGbp} onChangeText={setContribGbp} placeholder="20.00" keyboardType="decimal-pad" />
          </Field>
          <View style={{ marginTop: 4 }}>
            <Checkbox checked={ack} onToggle={() => setAck(!ack)} label="I've sealed my parcel and declare there are no prohibited items inside." />
          </View>
        </>
      )}

      {step === 4 && (
        <>
          <ScreenHeading title="Review & post" subtitle="Check the details — Buddies on your route will see this." />
          <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 16, backgroundColor: 'rgba(255,255,255,0.5)' }}>
            <SummaryRow label="Route" value={`${corridorName} · ${direction}`} />
            <SummaryRow label="Pickup" value={pickup?.postcode ?? '—'} />
            <SummaryRow label="Drop-off" value={dropoff?.postcode ?? '—'} />
            <SummaryRow label="Parcel" value={`${title || '—'} · ${size}`} />
            <SummaryRow label="Value" value={gbp(valuePennies)} />
            <Divider />
            <SummaryRow label={pricingMode === 'auction' ? 'Most you would share' : 'Your contribution'} value={gbp(contribPennies)} strong />
          </View>
          <Text style={{ color: C.muted, fontSize: 13, marginTop: 12, lineHeight: 19 }}>
            Your Buddy's contributions are always capped to their own journey cost — so you never overpay.
          </Text>
        </>
      )}

      {error ? <Text style={{ color: C.coralStatus, marginTop: 16 }}>{error}</Text> : null}

      <StepNav
        onBack={step > 0 ? () => setStep(step - 1) : undefined}
        onNext={next}
        nextLabel={step === STEPS.length - 1 ? `Post parcel · ${gbp(contribPennies)}` : 'Continue'}
        busy={busy}
        disabled={!stepValid}
      />
      </Panel>
    </FlowScreen>
  );
}
