// Post a parcel: corridor + direction, pickup/dropoff (validated GB addresses),
// value and a cost-sharing contribution. Submits to POST /parcels.
import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { api, ApiError, gbp, type Corridor } from '../../src/lib/api';
import { AddressPicker, type PickedAddress } from '../../src/components/AddressPicker';
import { Button, Chip, Field, Input } from '../../src/components/ui';
import { theme } from '../../src/theme';

export default function NewParcel() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [corridorId, setCorridorId] = useState<string | null>(null);
  const [direction, setDirection] = useState<'outbound' | 'return'>('outbound');
  const [pickup, setPickup] = useState<PickedAddress | null>(null);
  const [dropoff, setDropoff] = useState<PickedAddress | null>(null);
  const [title, setTitle] = useState('');
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
  const canSubmit = corridorId && pickup && dropoff && title.trim() && valuePennies > 0 && contribPennies > 0 && ack;

  async function onSubmit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) return;
      const now = Date.now();
      const parcel = await api.post<{ id: string }>('/parcels', token, {
        corridor_id: corridorId,
        direction,
        title: title.trim(),
        category: 'general',
        pickup: { postcode: pickup!.postcode, address_line: pickup!.address_line },
        dropoff: { postcode: dropoff!.postcode, address_line: dropoff!.address_line },
        length_cm: 30,
        width_cm: 20,
        height_cm: 10,
        weight_g: 1000,
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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <Text style={{ color: theme.text, fontSize: 26, fontWeight: '800', marginBottom: 4 }}>Send a parcel</Text>
      <Text style={{ color: theme.muted, marginBottom: 24 }}>
        You contribute toward a traveller’s journey costs — capped to their fare.
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

      <AddressPicker label="Pickup" onChange={setPickup} />
      <AddressPicker label="Dropoff" onChange={setDropoff} />

      <Field label="What is it?">
        <Input value={title} onChangeText={setTitle} placeholder="e.g. Birthday gift" />
      </Field>
      <Field label="Declared value (£)">
        <Input value={valueGbp} onChangeText={setValueGbp} placeholder="50.00" keyboardType="decimal-pad" />
      </Field>

      <Field label="Pricing">
        <View style={{ flexDirection: 'row' }}>
          <Chip label="Auction (travellers bid)" active={pricingMode === 'auction'} onPress={() => setPricingMode('auction')} />
          <Chip label="Fixed" active={pricingMode === 'fixed'} onPress={() => setPricingMode('fixed')} />
        </View>
      </Field>
      <Field label={pricingMode === 'auction' ? 'Max contribution (£)' : 'Contribution (£)'}>
        <Input value={contribGbp} onChangeText={setContribGbp} placeholder="20.00" keyboardType="decimal-pad" />
      </Field>

      <Chip
        label={ack ? '☑  No prohibited items — unsealed for inspection' : '☐  No prohibited items — unsealed for inspection'}
        active={ack}
        onPress={() => setAck(!ack)}
      />

      {error ? <Text style={{ color: theme.danger, marginVertical: 12 }}>{error}</Text> : null}

      <View style={{ marginTop: 16 }}>
        <Button
          label={canSubmit ? `Post parcel${contribPennies ? ` · up to ${gbp(contribPennies)}` : ''}` : 'Complete the form'}
          onPress={onSubmit}
          busy={busy}
        />
      </View>
    </ScrollView>
  );
}
